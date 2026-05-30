import { SETTINGS, isFacebookMessengerProxy, isKilled } from '../config.js';

const REQUEST_NATIVE_GRACE_MS = 15000;

export function startMessengerProtection() {
    if (window.__GHOSTIFY_MESSENGER_PROTECTION__) return;
    window.__GHOSTIFY_MESSENGER_PROTECTION__ = true;

    const markRequestIntent = (event) => {
        if (isMessageRequestNavigationTarget(event?.target)) {
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

export function getMessengerSpoofState() {
    if (hasRecentMessageRequestIntent()) return null;
    if (isMessengerMessageRequestSurface()) return null;

    if (SETTINGS.msgSeen && !isKilled('msgSeen')) {
        if (isFacebookMessengerProxy) return 'unfocused-passive';
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

function isMessageRequestNavigationTarget(target) {
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

    return href.includes('/requests') ||
        href.includes('message_requests') ||
        href.includes('message-requests') ||
        label.includes('message requests') ||
        label.includes('message_requests') ||
        label.includes('message-requests') ||
        /^requests(?:\s|[^\w\s]|$)/.test(label.trim());
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

function isMessengerMessageRequestSurface() {
    const path = String(window.location?.pathname || '').toLowerCase();
    const search = String(window.location?.search || '').toLowerCase();
    const hash = String(window.location?.hash || '').toLowerCase();
    const route = `${path} ${search} ${hash}`;

    return path.startsWith('/requests') ||
        path.startsWith('/message-requests') ||
        path.startsWith('/message_requests') ||
        route.includes('folder=message_requests') ||
        route.includes('message_requests') ||
        route.includes('message-requests');
}
