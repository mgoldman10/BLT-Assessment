// Reports participant-side failures (assessment couldn't load or save) to our own
// site rather than Google's database, so the report gets through even when the
// participant's network is blocking the database. Never sends names, emails, or
// answers. Fire-and-forget: a failed report must never affect the participant.
export const reportParticipantError = (
    stage: 'load' | 'submit',
    details: { companyId?: string | null; companyName?: string | null; error: unknown }
): void => {
    try {
        const message = details.error instanceof Error ? details.error.message : String(details.error);
        fetch('/.netlify/functions/logParticipantError', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({
                stage,
                companyId: details.companyId || null,
                companyName: details.companyName || null,
                message,
                url: window.location.href,
                userAgent: navigator.userAgent,
                online: navigator.onLine
            })
        }).catch(() => {});
    } catch (e) {
        // Reporting is best-effort only.
    }
};
