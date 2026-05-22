import { SETTINGS, isKilled } from '../config.js';

export function startFacebookProtection() {
    window.__GHOSTIFY_FACEBOOK_PROTECTION__ = true;
}

export function getFacebookSpoofState() {
    if (SETTINGS.msgSeen && !isKilled('msgSeen')) {
        return 'unfocused';
    }

    return null;
}
