// Netlify Serverless Function for the admin "AI-generate a template" feature.
// Admin-only: the caller must send a valid login token for an ADMIN or
// SUPER_ADMIN. The Gemini key lives only in the server env var GEMINI_API_KEY.

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

const MODEL = 'gemini-2.5-flash';
const UNAVAILABLE = 'AI template generation is temporarily unavailable. Please try again later.';

const json = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) });

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

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }
  if (!(await isAdmin(event))) {
    return json(401, { error: 'Please log in again to generate templates.' });
  }

  try {
    const { topic } = JSON.parse(event.body || '{}');
    const cleanTopic = typeof topic === 'string' ? topic.trim().slice(0, 300) : '';
    if (!cleanTopic) {
      return json(400, { error: 'Please enter a topic.' });
    }

    // Key goes in a header (not the URL), so it never appears in request logs.
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY || '' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'You are an expert leadership coach and organizational psychologist creating professional team assessments. Generate a JSON response.' }] },
        contents: [{ parts: [{ text: `Create a professional team assessment template about: "${cleanTopic}".
    Requirements:
    1. Assessment Name should be professional.
    2. Create 5 to 7 distinct categories (pillars) relevant to the topic.
    3. Each category MUST have exactly 5 questions.
    4. Questions must be clear statements that a team member would rate on a scale (0=Strongly Disagree to 4=Strongly Agree).
    5. Tone: Professional, corporate, growth-oriented.` }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING', description: 'Professional title for the assessment' },
              categories: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING', description: 'Name of the pillar/category' },
                    questions: { type: 'ARRAY', items: { type: 'STRING', description: 'A statement to be rated 0-4' } },
                  },
                  required: ['name', 'questions'],
                },
              },
            },
            required: ['name', 'categories'],
          },
        },
      }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Log only Google's status, never the request (it carries the key).
      console.error('Gemini template error:', res.status, result?.error?.status);
      return json(502, { error: UNAVAILABLE });
    }
    const text = (result.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    return json(200, JSON.parse(text));
  } catch (error) {
    console.error('Error generating template:', error.message);
    return json(500, { error: UNAVAILABLE });
  }
};
