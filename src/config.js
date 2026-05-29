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
const pathname = window.location.pathname.toLowerCase();

function isHost(domain) {
    return hostname === domain || hostname.endsWith(`.${domain}`);
}

export const isFacebookDotCom = isHost('facebook.com');
export const isMessengerDotCom = isHost('messenger.com');
export const isFacebookMessengerProxy = hostname === 'www.fbsbx.com' && pathname.startsWith('/maw_proxy_page');
export const isMessenger = isFacebookDotCom || isMessengerDotCom || isFacebookMessengerProxy;
export const isInstagram = isHost('instagram.com');

export function isKilled(feature) {
    return KILLED_FEATURES.has(feature);
}

export function markSettingsReady() {
    SETTINGS_READY = true;
}
