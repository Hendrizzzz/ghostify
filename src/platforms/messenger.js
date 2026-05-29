import { SETTINGS, isKilled } from '../config.js';

export function getMessengerSpoofState() {
    if (isMessengerMessageRequestSurface()) return null;

    if (SETTINGS.msgSeen && !isKilled('msgSeen')) {
        return 'unfocused';
    }

    return null;
}

function isMessengerMessageRequestSurface() {
    const path = String(window.location?.pathname || '').toLowerCase();
    return path.startsWith('/requests') ||
        path.startsWith('/message-requests') ||
        path.startsWith('/message_requests');
}
