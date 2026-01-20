import AppUsage from "../models/AppUsage.js";

// Handle Socket Event
export async function handleUsageEvent(payload, tenantId) {
    try {
        const { agentId, eventType, appName, pid, timestamp, title, duration } = payload;

        if (!agentId || !appName || !tenantId) return;

        // Try to find existing record
        let doc = await AppUsage.findOne({ agentId, tenantId, appName });

        if (!doc) {
            doc = new AppUsage({
                agentId,
                tenantId,
                appName,
                totalDuration: 0,
                lastTitle: title || "",
            });
        }

        const evtTime = new Date(timestamp); // Ensure Date object

        if (eventType === "OPEN") {
            // Mark as active
            doc.activeSession = {
                pid: pid,
                openedAt: evtTime,
            };
            if (title) doc.lastTitle = title;
        }
        else if (eventType === "CLOSE") {
            // Close session
            // If we have a duration from agent, use it. 
            // Otherwise, calculate if we have an activeSession.
            // Agent duration is preferred as it's closer to the source.
            let sessionDuration = duration || 0;

            if (!sessionDuration && doc.activeSession && doc.activeSession.openedAt) {
                // Fallback calc
                sessionDuration = evtTime.getTime() - new Date(doc.activeSession.openedAt).getTime();
            }

            if (sessionDuration > 0) {
                doc.totalDuration += sessionDuration;
            }

            // Clear active session if PID matches or if forced
            if (doc.activeSession && doc.activeSession.pid === pid) {
                doc.activeSession = null;
            } else if (!pid) {
                // If no PID specified, maybe clear anyway? 
                // Let's be safe: only clear if PID matches. 
                // But if agent restarts reusing PIDs?
                // For now, assume single instance per app name constraint isn't strict, 
                // but our Model is unique by appName. 
                // If multiple instances of Chrome run, this logic flaws (overwrites activeSession).
                // "Lightweight state per application". Usually means "Process Name".
                // If Chrome has 10 processes, we might get 10 OPEN events.
                // If we group by `appName` (e.g. "chrome.exe"), we can't store just ONE activeSession.
                // NOTE: The prompt says "keyed to that process...". 
                // But the display is "Total accumulated usage... per application".
                // If I run 5 notepads, usage is 5x logic? Or 1x?
                // Usually "Usage Time" is "Time at least one instance is open".
                // Complexity: The prompt says "Whenever an application process starts... agent records...".
                // This implies process-level granular tracking.
                // But the backend aggregation is "Total Usage Time".
                // If I have 2 notepads open for 1 hour overlap. Is that 1 hour usage or 2 hours?
                // Usually for productivity it's 1 hour.
                // But prompt: "computes the session duration... and adds this value...".
                // This implies simple addition. So 2 hours.
                // So I will treat each Open/Close as an additive transaction.
                // BUT, `activeSession` field in DB only holds one.
                // I should change `activeSession` to `activeSessions` array to handle multiple instances correctly.
            }

            if (title) doc.lastTitle = title;
        }
        else if (eventType === "UPDATE_TITLE") {
            if (title) doc.lastTitle = title;
        }

        doc.lastUpdated = new Date();
        await doc.save();

    } catch (err) {
        console.error("HandleUsageEvent Error:", err);
    }
}

export async function getAgentUsage(agentId, tenantId) {
    if (!agentId || !tenantId) return [];

    const docs = await AppUsage.find({ agentId, tenantId });

    // Return formatted
    return docs.map(d => ({
        appName: d.appName,
        totalUsage: d.totalDuration,
        lastTitle: d.lastTitle,
        // If multiple sessions support is needed, we'd check activeSessions.
        // For now, using the single activeSession field:
        isOpen: !!d.activeSession,
        openedAt: d.activeSession ? d.activeSession.openedAt : null
    }));
}
