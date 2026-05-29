import { SETTINGS, isKilled } from '../config.js';

const REQUEST_NATIVE_GRACE_MS = 15000;

export function startFacebookProtection() {
    if (window.__GHOSTIFY_FACEBOOK_PROTECTION__) return;
    window.__GHOSTIFY_FACEBOOK_PROTECTION__ = true;

    const markRequestIntent = (event) => {
        if (isFacebookMessageRequestNavigationTarget(event?.target)) {
            const until = Date.now() + REQUEST_NATIVE_GRACE_MS;
            activateRequestNativeGrace(until);
        }
    };

    document.addEventListener('pointerdown', markRequestIntent, true);
    document.addEventListener('click', markRequestIntent, true);
    document.addEventListener('keydown', (event) => {
        if (event?.key !== 'Enter' && event?.key !== ' ') return;
        markRequestIntent(event);
    }, true);
}

export function getFacebookSpoofState() {
    if (hasRecentMessageRequestIntent()) return null;
    if (isFacebookMessageRequestSurface()) return null;
    if (!isFacebookMessagingSurface()) return null;

    if (SETTINGS.msgSeen && !isKilled('msgSeen')) {
        return 'unfocused';
    }

    return null;
}

function activateRequestNativeGrace(until) {
    window.__GHOSTIFY_MESSAGE_REQUEST_FOCUS_UNTIL__ = until;
    window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ = until;
    emitNativeFocusSignals();
}

function hasRecentMessageRequestIntent() {
    return Math.max(
        Number(window.__GHOSTIFY_MESSAGE_REQUEST_FOCUS_UNTIL__ || 0),
        Number(window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ || 0)
    ) > Date.now();
}

function emitNativeFocusSignals() {
    dispatchEventSafe(window, 'focus');
    dispatchEventSafe(document, 'visibilitychange');
    dispatchEventSafe(document, 'webkitvisibilitychange');
    dispatchEventSafe(document, 'focusin');
}

function dispatchEventSafe(target, type) {
    try {
        if (!target || typeof target.dispatchEvent !== 'function') return;
        const event = typeof Event === 'function'
            ? new Event(type, { bubbles: type === 'focusin', cancelable: false })
            : { type, target };
        target.dispatchEvent(event);
    } catch (e) { }
}

function isFacebookMessageRequestNavigationTarget(target) {
    const element = getClosestRequestElement(target);
    if (!element) return false;

    const href = getElementAttribute(element, 'href');
    const label = [
        getElementAttribute(element, 'aria-label'),
        getElementAttribute(element, 'title'),
        element.innerText,
        element.textContent,
        href
    ].filter(Boolean).join(' ').toLowerCase();

    return href.includes('/messages/requests') ||
        href.includes('/messages/message-requests') ||
        href.includes('/messages/message_requests') ||
        href.includes('folder=message_requests') ||
        label.includes('message requests') ||
        label.includes('message_requests') ||
        label.includes('message-requests');
}

function getClosestRequestElement(target) {
    if (!target || typeof target !== 'object') return null;
    if (typeof target.closest === 'function') {
        return target.closest('a,button,[role="link"],[role="button"],[aria-label]') || target;
    }
    return target;
}

function getElementAttribute(element, name) {
    try {
        return String(element?.getAttribute?.(name) || '');
    } catch (e) {
        return '';
    }
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
