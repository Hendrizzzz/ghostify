const DEFAULT_SETTINGS = {
    igStory: true,
    igTyping: true,
    msgTyping: true,
    msgSeen: true
};

const DYNAMIC_RULE_IDS = {
    instagramStorySeen: 1001,
    instagramBanzai: 1002,
    instagramFalco: 1003,
    instagramDirectTyping: 1004,
    facebookTypingMessaging: 1101,
    facebookTypingChat: 1102,
    facebookTypingMercury: 1103,
    messengerTypingMessaging: 1104,
    messengerTypingChat: 1105,
    messengerTypingMercury: 1106,
    facebookChangeReadStatus: 1107,
    messengerChangeReadStatus: 1108
};

const LEGACY_DYNAMIC_RULE_IDS = [1, 2, 1002, 1003, 1004];
const CURRENT_DYNAMIC_RULE_IDS = [
    DYNAMIC_RULE_IDS.instagramStorySeen,
    DYNAMIC_RULE_IDS.facebookTypingMessaging,
    DYNAMIC_RULE_IDS.facebookTypingChat,
    DYNAMIC_RULE_IDS.facebookTypingMercury,
    DYNAMIC_RULE_IDS.messengerTypingMessaging,
    DYNAMIC_RULE_IDS.messengerTypingChat,
    DYNAMIC_RULE_IDS.messengerTypingMercury,
    DYNAMIC_RULE_IDS.facebookChangeReadStatus,
    DYNAMIC_RULE_IDS.messengerChangeReadStatus
];

const INSTAGRAM_STORY_SEEN_RULE = {
    id: DYNAMIC_RULE_IDS.instagramStorySeen,
    priority: 1,
    action: { type: 'block' },
    condition: {
        urlFilter: '||instagram.com/api/v1/stories/reel/seen',
        resourceTypes: ['xmlhttprequest', 'ping', 'other']
    }
};

const MESSENGER_TYPING_RULES = [
    createBlockRule(DYNAMIC_RULE_IDS.facebookTypingMessaging, '||facebook.com/ajax/messaging/typ.php'),
    createBlockRule(DYNAMIC_RULE_IDS.facebookTypingChat, '||facebook.com/ajax/chat/typ.php'),
    createBlockRule(DYNAMIC_RULE_IDS.facebookTypingMercury, '||facebook.com/ajax/mercury/typ.php'),
    createBlockRule(DYNAMIC_RULE_IDS.messengerTypingMessaging, '||messenger.com/ajax/messaging/typ.php'),
    createBlockRule(DYNAMIC_RULE_IDS.messengerTypingChat, '||messenger.com/ajax/chat/typ.php'),
    createBlockRule(DYNAMIC_RULE_IDS.messengerTypingMercury, '||messenger.com/ajax/mercury/typ.php')
];

syncDynamicPrivacyRulesFromStorage();

chrome.runtime.onInstalled.addListener(syncDynamicPrivacyRulesFromStorage);
chrome.runtime.onStartup.addListener(syncDynamicPrivacyRulesFromStorage);

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.ghostifySettings) return;
    syncDynamicPrivacyRules(normalizeSettings(changes.ghostifySettings.newValue)).catch(() => { });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GHOSTIFY_PING') {
        sendResponse({ status: 'alive' });
    }
    return true;
});

function syncDynamicPrivacyRulesFromStorage() {
    chrome.storage.local.get(['ghostifySettings'], (result) => {
        syncDynamicPrivacyRules(normalizeSettings(result.ghostifySettings)).catch(() => { });
    });
}

function normalizeSettings(settings) {
    return Object.assign({}, DEFAULT_SETTINGS, settings || {});
}

async function syncDynamicPrivacyRules(settings) {
    if (!chrome.declarativeNetRequest?.updateDynamicRules) return;

    const addRules = [];
    if (settings.igStory !== false) {
        addRules.push(INSTAGRAM_STORY_SEEN_RULE);
    }
    if (settings.msgTyping !== false) {
        addRules.push(...MESSENGER_TYPING_RULES);
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [...new Set([...LEGACY_DYNAMIC_RULE_IDS, ...CURRENT_DYNAMIC_RULE_IDS])],
        addRules
    });
}

function createBlockRule(id, urlFilter) {
    return {
        id,
        priority: 1,
        action: { type: 'block' },
        condition: {
            urlFilter,
            resourceTypes: ['xmlhttprequest', 'ping', 'other']
        }
    };
}
