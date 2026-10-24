// Netlify Serverless Function to record participant-side failures
// (assessment couldn't load or save). The browser calls this on our own domain,
// which still works when a network blocks Google's database. Writes with the
// Admin SDK, so no Firestore rule change is needed and participants can't read it.

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

// Keep stored fields short and plain so the log can't be used to store junk.
const clip = (value, max) => (typeof value === 'string' ? value.slice(0, max) : null);

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: '' };
  }
  if ((event.body || '').length > 5000) {
    return { statusCode: 413, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    await admin.firestore().collection('participantErrors').add({
      stage: body.stage === 'submit' ? 'submit' : 'load',
      companyId: clip(body.companyId, 100),
      companyName: clip(body.companyName, 200),
      message: clip(body.message, 500),
      url: clip(body.url, 1000),
      userAgent: clip(body.userAgent, 300),
      online: body.online === true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { statusCode: 204, body: '' };
  } catch (error) {
    console.error('Error recording participant error:', error.message);
    return { statusCode: 500, body: '' };
  }
};
