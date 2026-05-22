import { isInstagram, SETTINGS, isKilled } from '../config.js';

export function startInstagramProtection() {
    return isInstagram;
}

export function getInstagramSpoofState() {
    const seenEnabled = SETTINGS.igSeen && !isKilled('igSeen');
    const storyEnabled = SETTINGS.igStory && !isKilled('igStory');

    if (!seenEnabled && !storyEnabled) return null;

    if (storyEnabled && isStorySurface()) {
        return 'unfocused';
    }

    if (seenEnabled && !isDirectSurface()) {
        return 'unfocused';
    }

    return null;
}

function isStorySurface() {
    return window.location.pathname.startsWith('/stories/');
}

function isDirectSurface() {
    const path = window.location.pathname;
    return path === '/direct/' || path.startsWith('/direct/');
}
