// Netlify Serverless Function to save a website-mode ("public") assessment.
// Since the Dec 31, 2025 security rules, anonymous visitors can't create a
// company directly, so website submissions silently failed. This function
// validates the submission, creates the "From Website" company with the
// response (Admin SDK), and sends the Zapier notification marked
// source: "Website". Invited participants never come through here.

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

// Website mode always uses the 35-question BLT (same as before).
const PUBLIC_TEMPLATE_ID = 'default-strategy';
// Spam protection: at most this many submissions per connection per hour.
const MAX_PER_HOUR = 5;

const json = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) });
const cleanText = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// Counts submissions per (hashed) IP address in a rolling one-hour window.
const underRateLimit = async (db, ip) => {
  const key = crypto.createHash('sha256').update(ip || 'unknown').digest('hex');
  const ref = db.collection('publicSubmitLimits').doc(key);
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
    const companyName = cleanText(body.companyName, 200);
    const r = body.response || {};
    const response = {
      id: cleanText(r.id, 40),
      firstName: cleanText(r.firstName, 100),
      lastName: cleanText(r.lastName, 100),
      email: cleanText(r.email, 200),
      timestamp: Date.now(),
      answers: {},
    };

    if (!companyName || !response.firstName || !response.lastName ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(response.email) || !/^[a-z0-9]{8,40}$/.test(response.id)) {
      return json(400, { error: 'Missing or invalid details' });
    }

    const db = admin.firestore();
    const template = (await db.collection('templates').doc(PUBLIC_TEMPLATE_ID).get()).data();
    const questionIds = (template?.categories || []).flatMap(c => c.questions.map(q => q.id));
    // Every question must be answered with a score of 0-4, and nothing else.
    for (const id of questionIds) {
      const value = r.answers?.[id];
      if (!Number.isInteger(value) || value < 0 || value > 4) {
        return json(400, { error: 'Incomplete answers' });
      }
      response.answers[id] = value;
    }
    if (!questionIds.length || Object.keys(r.answers || {}).length !== questionIds.length) {
      return json(400, { error: 'Incomplete answers' });
    }

    // The company ID is the participant's response ID, so a retry after a slow
    // confirmation finds the existing company instead of creating a duplicate.
    const companyId = response.id;
    const ref = db.collection('companies').doc(companyId);
    const existing = await ref.get();
    if (existing.exists) {
      return json(200, { companyId, companyName: existing.data().name });
    }

    const ip = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'];
    if (!(await underRateLimit(db, ip))) {
      return json(429, { error: 'Too many submissions' });
    }

    await ref.create({
      id: companyId,
      name: companyName,
      templateId: PUBLIC_TEMPLATE_ID,
      tags: ['From Website'],
      createdAt: response.timestamp,
      lastActivity: response.timestamp,
      responses: [response],
    });

    // Zapier notification (website submissions only). Best-effort: the
    // submission is already saved, so a notification failure doesn't fail it.
    try {
      const settings = (await db.collection('settings').doc('global_settings').get()).data() || {};
      if (settings.webhookUrl) {
        const origin = process.env.URL || 'https://mg-assessment.netlify.app';
        const reportParams = new URLSearchParams({ mode: 'view_result', company: companyName, companyId });
        const shareParams = new URLSearchParams({ company: companyName, type: 'BLT-Extended', companyId });
        // Same fields (and plain-text JSON body) as before, plus source for the Zap's filter.
        await fetch(settings.webhookUrl, {
          method: 'POST',
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            firstName: response.firstName,
            lastName: response.lastName,
            email: response.email,
            company: companyName,
            date: new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
            reportUrl: `${origin}/?${reportParams.toString()}`,
            assessmentType: template.name,
            shareUrl: `${origin}/?${shareParams.toString()}`,
            source: 'Website',
          }),
        });
      }
    } catch (error) {
      console.error('Error sending website notification:', error.message);
    }

    return json(200, { companyId, companyName });
  } catch (error) {
    console.error('Error saving public assessment:', error.message);
    return json(500, { error: 'Could not save' });
  }
};
