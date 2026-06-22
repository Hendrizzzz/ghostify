import { isInstagram, SETTINGS, isKilled } from '../config.js';

export function startInstagramProtection() {
    if (!isInstagram || window.__GHOSTIFY_INSTAGRAM_PROTECTION__) return;
    window.__GHOSTIFY_INSTAGRAM_PROTECTION__ = true;
}

export function getInstagramSpoofState() {
    const seenEnabled = SETTINGS.igSeen && !isKilled('igSeen');
    const storyEnabled = SETTINGS.igStory && !isKilled('igStory');

    if (!seenEnabled && !storyEnabled) return null;

    if (storyEnabled && isStorySurface()) {
        return 'unfocused';
    }

    if (isMediaPlaybackSurface()) return null;

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

function isMediaPlaybackSurface() {
    const path = String(window.location?.pathname || '').toLowerCase();
    return path === '/' ||
        path === '/reel' ||
        path.startsWith('/reel/') ||
        path === '/reels' ||
        path.startsWith('/reels/') ||
        path === '/p' ||
        path.startsWith('/p/') ||
        path === '/tv' ||
        path.startsWith('/tv/') ||
        path === '/explore' ||
        path.startsWith('/explore/');
}
