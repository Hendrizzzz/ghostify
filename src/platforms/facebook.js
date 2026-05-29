import { SETTINGS, isKilled } from '../config.js';

export function startFacebookProtection() {
    window.__GHOSTIFY_FACEBOOK_PROTECTION__ = true;
}

export function getFacebookSpoofState() {
    if (isFacebookMessageRequestSurface()) return null;
    if (!isFacebookMessagingSurface()) return null;

    if (SETTINGS.msgSeen && !isKilled('msgSeen')) {
        return 'unfocused';
    }

    return null;
}

function isFacebookMessagingSurface() {
    const path = String(window.location?.pathname || '').toLowerCase();
    const search = String(window.location?.search || '').toLowerCase();
    const hash = String(window.location?.hash || '').toLowerCase();

    if (path.startsWith('/messages') || path.startsWith('/messenger')) return true;
    if (search.includes('sk=messages') || hash.includes('messages')) return true;

    return false;
}

function isFacebookMessageRequestSurface() {
    const path = String(window.location?.pathname || '').toLowerCase();
    const search = String(window.location?.search || '').toLowerCase();
    const hash = String(window.location?.hash || '').toLowerCase();
    const route = `${path} ${search} ${hash}`;

    return route.includes('/messages/requests') ||
        route.includes('/messages/message-requests') ||
        route.includes('/messages/message_requests') ||
        route.includes('folder=message_requests') ||
        route.includes('message_requests');
}
