(() => {
  // src/content.js
  var GITHUB_CONFIG_URL = "https://raw.githubusercontent.com/Hendrizzzz/Ghostify/refs/heads/main/dist/config/patterns.json";
  var FALLBACK_CONFIG = {
    version: "0.0.0",
    killSwitch: [],
    patterns: {
      igTyping: ["indicate_activity", "typing_indicator"],
      igSeen: ["mark_read", "mark_seen", "thread_seen", "DirectMarkAsSeen"],
      igStory: ["StoriesUpdateSeenMutation", "reelMediaSeen"],
      msgTyping: ["typing_indicator"],
      msgSeen: ["mark_read", "mark_seen", "thread_seen", "DirectMarkAsSeen"],
      msgStory: ["stories_update_seen", "StoriesUpdateSeenMutation"]
    }
  };
  var DEFAULT_SETTINGS = {
    igTyping: true,
    igSeen: true,
    igStory: true,
    msgTyping: true,
    msgSeen: true,
    msgStory: true
  };
  (async function init() {
    let config = await getStoredConfig();
    sendConfigToGhost(config);
    syncUserSettings();
    if (GITHUB_CONFIG_URL) {
      fetchRemoteConfig();
    } else {
      fetchLocalConfig();
    }
  })();
  function getStoredConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["ghostifyConfig"], (result) => {
        resolve(result.ghostifyConfig || FALLBACK_CONFIG);
      });
    });
  }
  async function fetchRemoteConfig() {
    try {
      const response = await fetch(GITHUB_CONFIG_URL, { cache: "no-cache" });
      if (response.ok) {
        const freshConfig = await response.json();
        chrome.storage.local.set({ ghostifyConfig: freshConfig });
        sendConfigToGhost(freshConfig);
      }
    } catch (e) {
    }
  }
  async function fetchLocalConfig() {
    try {
      const response = await fetch(chrome.runtime.getURL("config/patterns.json"));
      if (response.ok) {
        const localConfig = await response.json();
        chrome.storage.local.set({ ghostifyConfig: localConfig });
        sendConfigToGhost(localConfig);
      }
    } catch (e) {
    }
  }
  function sendConfigToGhost(config) {
    window.postMessage({
      type: "GHOSTIFY_CONFIG_UPDATE",
      config
    }, "*");
  }
  function syncUserSettings() {
    function sendSettingsToPage(settings) {
      window.postMessage({
        type: "GHOSTIFY_SETTINGS_UPDATE",
        settings
      }, "*");
    }
    function loadAndSend() {
      chrome.storage.local.get(["ghostifySettings"], (result) => {
        const settings = result.ghostifySettings || DEFAULT_SETTINGS;
        sendSettingsToPage(settings);
      });
    }
    loadAndSend();
    setTimeout(loadAndSend, 500);
    setTimeout(loadAndSend, 1500);
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.ghostifySettings) {
        const newSettings = changes.ghostifySettings.newValue;
        sendSettingsToPage(newSettings);
      }
    });
  }
})();
