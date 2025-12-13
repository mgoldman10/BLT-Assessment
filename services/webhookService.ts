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

  const payload = {
    firstName: data.participant.firstName,
    lastName: data.participant.lastName,
    email: data.participant.email,
    company: data.companyName,
    date: new Date().toISOString(),
    reportUrl: data.reportLink,
    assessmentType: data.assessmentName,
    shareUrl: data.shareLink
  };

  // Try sendBeacon first (fire-and-forget, useful if called during page unload)
  try {
    if (navigator && typeof (navigator as any).sendBeacon === 'function') {
      const ok = (navigator as any).sendBeacon(webhookUrl, JSON.stringify(payload));
      if (ok) return true;
      // if sendBeacon returned false, fall through to fetch
    }
  } catch (e) {
    // ignore and continue to fetch fallback
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // CORS mode - leave default for same-origin or allow-cors for cross origin
      mode: 'cors',
      body: JSON.stringify(payload),
      credentials: 'omit'
    });

    // If Zapier returns 2xx -> success
    if (res.ok) return true;

    // non-2xx returned; print body for debugging
    try {
      const text = await res.text();
      console.warn('Webhook returned non-OK status', res.status, text);
    } catch (e) { /* noop */ }

    return false;
  } catch (e) {
    console.error('Webhook failed (network or CORS)', e);
    // Return false to indicate failure so caller can log or retry
    return false;
  }
};
