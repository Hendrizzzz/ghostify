async function removeCSPHeaders() {
    const hostPatterns = [
        "^https?://.*\\.facebook\\.com/.*",
        "^https?://.*\\.messenger\\.com/.*"
    ];

    try {
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const existingRuleIds = existingRules.map(r => r.id);

        const newRules = hostPatterns.map((pattern, index) => ({
            id: index + 1,
            priority: 1,
            action: {
                type: "modifyHeaders",
                responseHeaders: [
                    { header: "Content-Security-Policy", operation: "remove" },
                    { header: "Content-Security-Policy-Report-Only", operation: "remove" }
                ]
            },
            condition: {
                regexFilter: pattern,
                resourceTypes: ["main_frame", "sub_frame"]
            }
        }));

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRuleIds,
            addRules: newRules
        });
    } catch (e) {
    }
}

async function registerMessengerPatch() {
    try {
        try {
            await chrome.scripting.unregisterContentScripts({
                ids: ['ghostify-messenger-patch']
            });
        } catch (e) {
        }

        await chrome.scripting.registerContentScripts([{
            id: 'ghostify-messenger-patch',
            js: ['js/messenger_patch.js'],
            matches: [
                'https://www.messenger.com/*',
                'https://web.facebook.com/*',
                'https://www.facebook.com/*',
                '*://*.messenger.com/*',
                '*://*.facebook.com/*'
            ],
            runAt: 'document_start',
            world: 'MAIN'
        }]);
    } catch (e) {
    }
}

chrome.runtime.onInstalled.addListener(() => {
    removeCSPHeaders();
    registerMessengerPatch();
});

chrome.runtime.onStartup.addListener(() => {
    removeCSPHeaders();
    registerMessengerPatch();
});

removeCSPHeaders();
registerMessengerPatch();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GHOSTIFY_PING') {
        sendResponse({ status: 'alive' });
    }
    return true;
});
