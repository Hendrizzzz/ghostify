import { isInstagram, SETTINGS, isKilled } from '../config.js';

let isScrolling = false;
let scrollTimeout = null;

export function startInstagramProtection() {
    if (!isInstagram) return;

    window.addEventListener('scroll', () => {
        isScrolling = true;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            isScrolling = false;
        }, 150);
    }, true);
}

export function getInstagramSpoofState() {
    if (!SETTINGS.igSeen || isKilled('igSeen')) return null;

    if (isScrolling) {
        return false;
    }
    return 'unfocused';
}
