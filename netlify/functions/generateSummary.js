// Netlify Serverless Function that writes a report's Executive Summary.
// Gemini used to be called from the browser, which put the API key in the
// site's public code (it was scraped and abused, Nov 2026). The key now lives
// only in the server env var GEMINI_API_KEY. The prompt and model are fixed
// here, so this endpoint can only ever produce an executive summary.

const crypto = require('crypto');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Uses environment variables for credentials
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const MODEL = 'gemini-3.6-flash';
// Report viewers (not logged in): at most this many summaries per connection per hour.
// Logged-in admins aren't limited, so batch printing many reports still works.
const MAX_PER_HOUR = 30;
const UNAVAILABLE = 'The AI summary is temporarily unavailable. Please try again later.';

const json = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) });
const clip = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const list = (value, max) => (Array.isArray(value) ? value.slice(0, max) : []);

// True when the request carries a valid login token for an ADMIN or SUPER_ADMIN.
const isAdmin = async (event) => {
  const match = (event.headers.authorization || '').match(/^Bearer (.+)$/);
  if (!match) return false;
  try {
    const { uid } = await admin.auth().verifyIdToken(match[1]);
    const user = await admin.firestore().collection('users').doc(uid).get();
    return user.exists && ['ADMIN', 'SUPER_ADMIN'].includes(user.data().role);
  } catch (error) {
    return false;
  }
};

// Counts summaries per (hashed) IP address in a rolling one-hour window.
const underRateLimit = async (db, ip) => {
  const key = crypto.createHash('sha256').update(ip || 'unknown').digest('hex');
  const ref = db.collection('aiSummaryLimits').doc(key);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? snap.data() : null;
    if (!data || now - data.windowStart > 60 * 60 * 1000) {
      tx.set(ref, { windowStart: now, count: 1 });
      return true;
    }
    if (data.count >= MAX_PER_HOUR) return false;
    tx.update(ref, { count: data.count + 1 });
    return true;
  });
};

const buildPrompt = (data) => `
    Analyze the leadership assessment data for "${data.companyName}".
    Total Respondents: ${data.respondentCount}.

    Data Context:
    - Pillars: ${data.pillarScores.map(p => `${p.name} (${p.score.toFixed(1)})`).join(', ')}
    - Identified Strengths: ${data.topStrengths.map(s => `${s.label}: "${s.text}"`).join('; ')}
    - Identified Gaps: ${data.criticalGaps.map(g => `${g.label}: "${g.text}"`).join('; ')}
    - Split Votes (Misalignment): ${data.misalignments.map(m => `${m.label}: "${m.text}" (${m.varianceDescription})`).join('; ')}

    Task:
    Write a Professional Executive Summary to fit on the bottom of a one-page report.
    Output ONLY these 3 sections using Markdown headers:

    ### Key Strengths
    (Identify 3-5 overall themes or patterns where the team is excelling. Synthesize the data into broader concepts rather than just listing specific questions. Write 2-3 sentences per bullet point to provide depth.)

    ### Critical Gaps
    (Identify 3-5 overall themes or patterns where the team is struggling. Synthesize the low scores into broader systemic issues (e.g. "Lack of Strategic Clarity" instead of just "Question 5 is low"). Write 2-3 sentences per bullet point.)

    ### Areas of Misalignment
    ${data.respondentCount === 1
        ? "(Write 'N/A' because there is only 1 respondent, so misalignment is impossible to measure.)"
        : "(Provide 2-3 bullet points highlighting where the team is split. If no major splits, note that the team is aligned. Write about 2 sentences per bullet.)"
    }

    Constraint: Do not include an intro or conclusion. Use Markdown headers exactly as written above.
    `;

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }
  if ((event.body || '').length > 20000) {
    return json(413, { error: 'Too large' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    // Rebuild the input from known fields only, with length limits, so the
    // prompt can't be stuffed with someone else's content.
    const data = {
      companyName: clip(body.companyName, 200),
      respondentCount: Number.isInteger(body.respondentCount) ? body.respondentCount : 0,
      pillarScores: list(body.pillarScores, 12).map(p => ({ name: clip(p?.name, 200), score: Number(p?.score) })),
      topStrengths: list(body.topStrengths, 5).map(s => ({ text: clip(s?.text, 500), label: clip(s?.label, 200) })),
      criticalGaps: list(body.criticalGaps, 5).map(g => ({ text: clip(g?.text, 500), label: clip(g?.label, 200) })),
      misalignments: list(body.misalignments, 3).map(m => ({
        text: clip(m?.text, 500), varianceDescription: clip(m?.varianceDescription, 100), label: clip(m?.label, 200),
      })),
    };
    if (!data.companyName || data.respondentCount < 1 || data.respondentCount > 10000 || !data.pillarScores.length ||
        data.pillarScores.some(p => !p.name || !Number.isFinite(p.score) || p.score < 0 || p.score > 4)) {
      return json(400, { error: 'Missing or invalid report data' });
    }

    if (!(await isAdmin(event))) {
      const ip = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'];
      if (!(await underRateLimit(admin.firestore(), ip))) {
        return json(429, { error: 'Too many summaries' });
      }
    }

    // Key goes in a header (not the URL), so it never appears in request logs.
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY || '' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(data) }] }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Log only Google's status, never the request (it carries the key).
      console.error('Gemini summary error:', res.status, result?.error?.status);
      return json(res.status === 429 ? 429 : 502, { error: UNAVAILABLE });
    }
    const summary = (result.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    return json(200, { summary });
  } catch (error) {
    console.error('Error generating summary:', error.message);
    return json(500, { error: UNAVAILABLE });
  }
};
