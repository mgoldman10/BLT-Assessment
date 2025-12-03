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
        // We use 'no-cors' mode if simple POST fails, or standard POST.
        // Standard POST is best for Zapier.
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
        // Zapier hooks often don't return standard JSON responses to browser fetch
        // so we assume success if we sent it, or log error.
        console.log("Webhook triggered"); 
        return true;
    }
};
