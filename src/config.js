export const SETTINGS = {
    msgSeen: true,
    igSeen: true,
    igTyping: true,
    igStory: false
};

export const IG_BLOCKED_STORY_URLS = new Set();
export const IG_BLOCKED_UNSENT_URLS = new Set();
export const KILLED_FEATURES = new Set();

const hostname = window.location.hostname;
export const isFacebookDotCom = hostname.includes('facebook');
export const isMessengerDotCom = hostname.includes('messenger');
export const isMessenger = isFacebookDotCom || isMessengerDotCom;
export const isInstagram = hostname.includes('instagram');

export function isKilled(feature) {
    return KILLED_FEATURES.has(feature);
}

export function isDebugMode() {
    return localStorage.getItem('GHOSTIFY_DEBUG') === 'true';
}
