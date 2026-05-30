const FALLBACK_CONFIG = {
    version: "2.0.1",
    killSwitch: [],
    patterns: {
        igTyping: ['indicate_activity', 'typing_indicator', 'activity_indicator', 'is_typing', 'direct_v2/threads/broadcast/typing', 'direct_v2/threads/typing', 'sendtypingindicator', 'send_typing_indicator', 'typing_on', 'is_composing'],
        igSeen: ['mark_read', 'mark_seen', 'thread_seen', 'DirectMarkAsSeen', 'MarkAsSeen', 'DirectThreadMarkItemsSeen', 'PolarisDirectMarkAsSeenMutation', 'DirectSeenMutation', 'usePolarisMarkThreadSeenMutation', 'useigdmarkthreadasreadmutation'],
        igStory: ['StoriesUpdateSeenMutation', 'PolarisStoriesSeenMutation', 'usePolarisStoriesV3SeenMutation', 'reelMediaSeen', 'storiesUpdateSeen', 'SeenStoriesUpdateMutation', 'PolarisAPIReelSeenMutation', 'xdt_mark_story_reel_seen', '26997980659837802', 'PolarisAPIForceStorySeenMutation', 'xdt_api__v1__stories__reel__seen', '9647304595318258', 'api/v1/stories/reel/seen', 'stories/reel/seen', 'mark_story_seen', 'update_seen_for_reel', 'reel_seen', 'stories_update_seen', 'mark_story_read'],
        msgTyping: ['indicate_activity', 'typing_indicator', 'activity_indicator', 'is_typing', 'istyping', 'sendtypingindicator', 'send_typing_indicator', 'sendchatstate', 'send_chat_state', 'ajax/messaging/typ.php', 'ajax/chat/typ.php', 'ajax/mercury/typ.php', 'thread_typing', 'orca_typing_notifications', 'is_composing', 'iscomposing', 'composing', 'chat_state', 'chatstate', 'typing_status', 'typingstate', 'securetypingstate', 'mawsecuretypingstate', 'typingindicatorstoredprocedure', 'send_type'],
        msgSeen: ['mark_read', 'mark_seen', 'thread_seen', 'DirectMarkAsSeen', 'MarkAsSeen', 'DirectThreadMarkItemsSeen', 'PolarisDirectMarkAsSeenMutation', 'DirectSeenMutation', 'seenByViewer', 'updateLastSeenAt', 'updateLastReadWatermark', 'sendReadReceipt', 'LSSendReadReceipt', 'readReceipt', 'read_receipt', 'readReceiptMutation', 'LSUpdateThreadReadWatermark', 'LSUpdateLastReadWatermark', 'last_read_watermark', 'lastReadWatermark', 'read_watermark', 'readWatermark', 'shouldSendReadReceipt', 'should_send_read_receipt', 'LSMarkThreadRead', 'MWMarkThreadRead', 'markAsRead', 'change_read_status'],
        msgStory: ['StoriesUpdateSeenMutation', 'PolarisStoriesSeenMutation', 'usePolarisStoriesV3SeenMutation', 'reelMediaSeen', 'storiesUpdateSeen', 'SeenStoriesUpdateMutation', 'mark_story_seen', 'update_seen_for_reel', 'reel_seen', 'viewer_seen', 'stories_update_seen', 'mark_story_read']
    }
};

const DEFAULT_SETTINGS = {
    igTyping: true,
    igSeen: true,
    igStory: true,
    msgTyping: true,
    msgSeen: true,
    msgStory: true
};

(async function init() {
    syncUserSettings();
    let config = await fetchLocalConfig() || await getStoredConfig();
    sendConfigToGhost(config);
})();

function getStoredConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['ghostifyConfig'], (result) => {
            resolve(result.ghostifyConfig || FALLBACK_CONFIG);
        });
    });
}

async function fetchLocalConfig() {
    try {
        const response = await fetch(chrome.runtime.getURL('config/patterns.json'));
        if (response.ok) {
            const localConfig = await response.json();
            chrome.storage.local.set({ ghostifyConfig: localConfig });
            return localConfig;
        }
    } catch (e) { }
    return null;
}

function sendConfigToGhost(config) {
    const postConfig = () => {
        window.postMessage({
            type: 'GHOSTIFY_CONFIG_UPDATE',
            source: 'GHOSTIFY_EXTENSION',
            config: config
        }, '*');
    };

    postConfig();
    setTimeout(postConfig, 500);
    setTimeout(postConfig, 1500);
}

function syncUserSettings() {
    function sendSettingsToPage(settings) {
        window.postMessage({
            type: 'GHOSTIFY_SETTINGS_UPDATE',
            source: 'GHOSTIFY_EXTENSION',
            settings: settings
        }, '*');
    }

    function loadAndSend() {
        chrome.storage.local.get(['ghostifySettings'], (result) => {
            const settings = result.ghostifySettings || DEFAULT_SETTINGS;
            sendSettingsToPage(settings);
        });
    }

    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (!event.data || event.data.source !== 'GHOSTIFY_PAGE') return;
        if (event.data.type === 'GHOSTIFY_SETTINGS_REQUEST') {
            loadAndSend();
        }
    });

    loadAndSend();

    setTimeout(loadAndSend, 500);
    setTimeout(loadAndSend, 1500);

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.ghostifySettings) {
            const newSettings = changes.ghostifySettings.newValue;
            sendSettingsToPage(newSettings);
        }
    });
}
