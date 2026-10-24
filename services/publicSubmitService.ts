import { ParticipantResponse } from '../types';

// Website-mode submissions go through our server, which creates the
// "From Website" company and sends the Zapier notification. Throws on failure
// so the participant sees "Submission Failed" with Try Again.
export const submitPublicAssessment = async (
    companyName: string,
    response: ParticipantResponse
): Promise<{ companyId: string; companyName: string }> => {
    const res = await fetch('/.netlify/functions/submitPublicAssessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, response })
    });
    if (res.status === 429) throw new Error('Too many submissions from this network. Please try again in an hour.');
    if (!res.ok) throw new Error(`Submit failed (HTTP ${res.status})`);
    return res.json();
};
