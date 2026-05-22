export const SETTINGS = {
    igTyping: true,
    igSeen: true,
    igStory: true,
    msgTyping: true,
    msgSeen: true,
    msgStory: true
};

export const KILLED_FEATURES = new Set();
export let SETTINGS_READY = false;

const hostname = window.location.hostname.toLowerCase();

function isHost(domain) {
    return hostname === domain || hostname.endsWith(`.${domain}`);
}

export const isFacebookDotCom = isHost('facebook.com');
export const isMessengerDotCom = isHost('messenger.com');
export const isMessenger = isFacebookDotCom || isMessengerDotCom;
export const isInstagram = isHost('instagram.com');

export function isKilled(feature) {
    return KILLED_FEATURES.has(feature);
}

export function markSettingsReady() {
    SETTINGS_READY = true;
}
