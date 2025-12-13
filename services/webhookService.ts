import { ParticipantResponse } from "../types";

export const triggerAutomationWebhook = async (
    webhookUrl: string,
    data: {
        participant: ParticipantResponse;
        companyName: string;
        reportLink: string;
        assessmentName: string;
        shareLink: string;
    }
): Promise<boolean> => {
    if (!webhookUrl) return false;

    try {
        // Use no-cors if Zapier doesn't support CORS (it usually accepts simple POSTs)
        // Or standard POST. Standard is better for JSON data.
        await fetch(webhookUrl, {
            method: 'POST',
            body: JSON.stringify({
                firstName: data.participant.firstName,
                lastName: data.participant.lastName,
                email: data.participant.email,
                company: data.companyName,
                date: new Date().toLocaleDateString(),
                reportUrl: data.reportLink,
                assessmentType: data.assessmentName,
                shareUrl: data.shareLink
            })
        });
        return true;
    } catch (e) {
        console.error("Webhook failed", e);
        // Even if it fails in browser (CORS), Zapier often receives it.
        // We return true to not block the user flow.
        return true;
    }
};
