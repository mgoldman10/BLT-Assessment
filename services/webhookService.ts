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
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firstName: data.participant.firstName,
                lastName: data.participant.lastName,
                email: data.participant.email,
                company: data.companyName,
                date: new Date().toLocaleDateString(),
                reportUrl: data.reportLink,
                assessmentType: data.assessmentName,
                shareUrl: data.shareLink,
                // Send summarized answers or score if needed later
            })
        });
        return true;
    } catch (e) {
        console.error("Webhook failed", e);
        return false;
    }
};
