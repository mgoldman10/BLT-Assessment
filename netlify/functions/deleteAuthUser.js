// Netlify Serverless Function to delete Firebase Auth user
// This uses Firebase Admin SDK which requires server-side execution

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

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    // Parse request body
    const { userId } = JSON.parse(event.body || '{}');

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'userId is required' }),
      };
    }

    // Delete user from Firebase Authentication
    await admin.auth().deleteUser(userId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: `User ${userId} deleted from Firebase Auth` 
      }),
    };
  } catch (error) {
    console.error('Error deleting Firebase Auth user:', error);

    // If user doesn't exist, that's okay (may have been already deleted)
    if (error.code === 'auth/user-not-found') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'User not found in Firebase Auth (may have been already deleted)' 
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to delete user from Firebase Auth',
        message: error.message 
      }),
    };
  }
};
