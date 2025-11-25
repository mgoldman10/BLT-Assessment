
/**
 * Service to handle sending email notifications from the application.
 */

const EMAIL_API_ENDPOINT = 'YOUR_ENDPOINT_URL_HERE'; // e.g. 'https://formspree.io/f/xyzk....'

export const sendAssessmentNotification = async (
  participantName: string,
  companyName: string,
  resultCode: string,
  recipientEmail: string = 'mike@mike-goldman.com'
): Promise<boolean> => {
  
  if (EMAIL_API_ENDPOINT === 'YOUR_ENDPOINT_URL_HERE') {
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
  if (EMAIL_API_ENDPOINT === 'YOUR_ENDPOINT_URL_HERE') {
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
