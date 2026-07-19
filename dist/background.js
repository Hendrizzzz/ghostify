(() => {
  // src/settings/defaults.js
  var FREE_PRIVACY_SETTING_KEYS = Object.freeze([
    "igTyping",
    "igSeen",
    "igStory",
    "msgTyping",
    "msgSeen",
    "msgStory"
  ]);
  var DEFAULT_PRIVACY_SETTINGS = Object.freeze({
    igTyping: true,
    igSeen: true,
    igStory: true,
    msgTyping: true,
    msgSeen: true,
    msgStory: true
  });
  var DEFAULT_MODULE_FLAGS = Object.freeze({
    ghostMode: true
  });

  // src/settings/storage.js
  var GHOSTIFY_SETTINGS_STORAGE_KEY = "ghostifySettings";
  function normalizePrivacySettings(settings) {
    const normalized = { ...DEFAULT_PRIVACY_SETTINGS };
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return normalized;
    }
    for (const key of FREE_PRIVACY_SETTING_KEYS) {
      if (typeof settings[key] === "boolean") {
        normalized[key] = settings[key];
      }
    }
    return normalized;
  }

  // src/background.js
  var LEGACY_RUNTIME_CONFIG_STORAGE_KEY = "ghostifyConfig";
  var DYNAMIC_RULE_IDS = {
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
  var LEGACY_DYNAMIC_RULE_IDS = [1, 2, 1002, 1003, 1004];
  var CURRENT_DYNAMIC_RULE_IDS = [
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
  var INSTAGRAM_STORY_SEEN_RULE = {
    id: DYNAMIC_RULE_IDS.instagramStorySeen,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: "||instagram.com/api/v1/stories/reel/seen",
      resourceTypes: ["xmlhttprequest", "ping", "other"]
    }
  };
  var MESSENGER_TYPING_RULES = [
    createBlockRule(DYNAMIC_RULE_IDS.facebookTypingMessaging, "||facebook.com/ajax/messaging/typ.php"),
    createBlockRule(DYNAMIC_RULE_IDS.facebookTypingChat, "||facebook.com/ajax/chat/typ.php"),
    createBlockRule(DYNAMIC_RULE_IDS.facebookTypingMercury, "||facebook.com/ajax/mercury/typ.php"),
    createBlockRule(DYNAMIC_RULE_IDS.messengerTypingMessaging, "||messenger.com/ajax/messaging/typ.php"),
    createBlockRule(DYNAMIC_RULE_IDS.messengerTypingChat, "||messenger.com/ajax/chat/typ.php"),
    createBlockRule(DYNAMIC_RULE_IDS.messengerTypingMercury, "||messenger.com/ajax/mercury/typ.php")
  ];
  syncDynamicPrivacyRulesFromStorage();
  chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.remove(LEGACY_RUNTIME_CONFIG_STORAGE_KEY);
    syncDynamicPrivacyRulesFromStorage();
  });
  chrome.runtime.onStartup.addListener(syncDynamicPrivacyRulesFromStorage);
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[GHOSTIFY_SETTINGS_STORAGE_KEY]) return;
    syncDynamicPrivacyRules(normalizePrivacySettings(changes[GHOSTIFY_SETTINGS_STORAGE_KEY].newValue)).catch(() => {
    });
  });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GHOSTIFY_PING") {
      sendResponse({ status: "alive" });
    }
    return true;
  });
  function syncDynamicPrivacyRulesFromStorage() {
    chrome.storage.local.get([GHOSTIFY_SETTINGS_STORAGE_KEY], (result) => {
      syncDynamicPrivacyRules(normalizePrivacySettings(result[GHOSTIFY_SETTINGS_STORAGE_KEY])).catch(() => {
      });
    });
  }
  async function syncDynamicPrivacyRules(settings) {
    var _a;
    if (!((_a = chrome.declarativeNetRequest) == null ? void 0 : _a.updateDynamicRules)) return;
    const addRules = [];
    if (settings.igStory !== false) {
      addRules.push(INSTAGRAM_STORY_SEEN_RULE);
    }
    if (settings.msgTyping !== false) {
      addRules.push(...MESSENGER_TYPING_RULES);
    }
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [.../* @__PURE__ */ new Set([...LEGACY_DYNAMIC_RULE_IDS, ...CURRENT_DYNAMIC_RULE_IDS])],
      addRules
    });
  }
  function createBlockRule(id, urlFilter) {
    return {
      id,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter,
        resourceTypes: ["xmlhttprequest", "ping", "other"]
      }
    };
  }
})();
