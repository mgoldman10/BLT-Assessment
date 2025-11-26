/**
 * Service to handle sending email notifications from the application.
 */

// PASTE YOUR FORMSPREE URL HERE inside the quotes
const EMAIL_API_ENDPOINT = 'https://formspree.io/f/mqkrvjwb'; 

export const sendAssessmentNotification = async (
  participantName: string,
  companyName: string,
  resultCode: string,
  recipientEmail: string = 'mike@mike-goldman.com'
): Promise<boolean> => {
  
  // Fix: Cast to string to avoid TypeScript error TS2367
  if ((EMAIL_API_ENDPOINT as string) === 'YOUR_ENDPOINT_URL_HERE') {
    console.warn("Email API Endpoint not configured. See services/emailService.ts");
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    return false; 
  }

  try {
    const response = await fetch(EMAIL_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: `New Assessment: ${participantName} - ${companyName}`,
        participant: participantName,
        company: companyName,
        date: new Date().toLocaleDateString(),
        resultCode: resultCode,
        recipient: recipientEmail, 
        type: 'ASSESSMENT_RESULT',
        _replyto: 'no-reply@breakthrough-assessment.app' 
      })
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

export const sendUserInvite = async (
    name: string,
    email: string,
    role: string,
    passwordTemp: string
): Promise<boolean> => {
  // Fix: Cast to string to avoid TypeScript error TS2367
  if ((EMAIL_API_ENDPOINT as string) === 'YOUR_ENDPOINT_URL_HERE') {
      console.warn("Email not configured");
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true; // Simulate success
  }

  try {
      await fetch(EMAIL_API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: `Invitation to Breakthrough Assessment Admin`,
            name,
            email,
            role,
            password: passwordTemp,
            loginUrl: window.location.origin,
            type: 'USER_INVITE'
          })
      });
      return true;
  } catch { return false; }
};
