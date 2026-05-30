import { SETTINGS, isKilled } from '../config.js';

const REQUEST_NATIVE_GRACE_MS = 15000;
const ROOT_NATIVE_GRACE_MS = 30000;
const CHAT_OPEN_NATIVE_GRACE_MS = 4000;

export function startFacebookProtection() {
    if (window.__GHOSTIFY_FACEBOOK_PROTECTION__) return;
    window.__GHOSTIFY_FACEBOOK_PROTECTION__ = true;

    if (isFacebookFeedRootRoute()) {
        activateRootNativeGrace(Date.now() + ROOT_NATIVE_GRACE_MS);
    }

    const markRequestIntent = (event) => {
        if (isFacebookMessageRequestNavigationTarget(event?.target)) {
            const until = Date.now() + REQUEST_NATIVE_GRACE_MS;
            activateRequestNativeGrace(until);
        }
    };
    const markConversationOpenIntent = (event) => {
        if (isFacebookMessageRequestNavigationTarget(event?.target)) return;
        if (isFacebookFeedConversationNavigationTarget(event?.target)) {
            activateChatOpenNativeGrace(Date.now() + CHAT_OPEN_NATIVE_GRACE_MS);
        }
    };

    document.addEventListener('pointerdown', markRequestIntent, true);
    document.addEventListener('pointerdown', markConversationOpenIntent, true);
    document.addEventListener('click', markRequestIntent, true);
    document.addEventListener('click', markConversationOpenIntent, true);
    document.addEventListener('keydown', (event) => {
        if (event?.key !== 'Enter' && event?.key !== ' ') return;
        markRequestIntent(event);
        markConversationOpenIntent(event);
    }, true);
}

export function getFacebookSpoofState() {
    if (hasRecentMessageRequestIntent()) return null;
    if (isFacebookMessageRequestSurface()) return null;

    if (SETTINGS.msgSeen && !isKilled('msgSeen')) {
        if (isFacebookRestoredMiniChatLoadingSurface()) return null;
        if (hasRecentChatOpenIntent()) return null;
        if (isFacebookFeedMessengerSurface()) return 'unfocused-passive';
        if (isFacebookFeedRootSurface()) return hasRootNativeGrace() ? null : 'unfocused-passive';
        if (!isFacebookMessagingSurface()) return null;
        return 'unfocused';
    }

    return null;
}

function activateRequestNativeGrace(until) {
    window.__GHOSTIFY_MESSAGE_REQUEST_FOCUS_UNTIL__ = until;
    window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ = until;
    emitNativeFocusSignals();
}

function activateRootNativeGrace(until) {
    window.__GHOSTIFY_FACEBOOK_ROOT_NATIVE_UNTIL__ = Math.max(
        Number(window.__GHOSTIFY_FACEBOOK_ROOT_NATIVE_UNTIL__ || 0),
        until
    );
    emitNativeFocusSignals();
}

function activateChatOpenNativeGrace(until) {
    window.__GHOSTIFY_FACEBOOK_CHAT_OPEN_FOCUS_UNTIL__ = Math.max(
        Number(window.__GHOSTIFY_FACEBOOK_CHAT_OPEN_FOCUS_UNTIL__ || 0),
        until
    );
    emitNativeFocusSignals();
}

function hasRecentMessageRequestIntent() {
    return Math.max(
        Number(window.__GHOSTIFY_MESSAGE_REQUEST_FOCUS_UNTIL__ || 0),
        Number(window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ || 0)
    ) > Date.now();
}

function hasRecentChatOpenIntent() {
    return Number(window.__GHOSTIFY_FACEBOOK_CHAT_OPEN_FOCUS_UNTIL__ || 0) > Date.now();
}

function hasRootNativeGrace() {
    return isFacebookFeedRootRoute() &&
        Number(window.__GHOSTIFY_FACEBOOK_ROOT_NATIVE_UNTIL__ || 0) > Date.now();
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

function isFacebookFeedConversationNavigationTarget(target) {
    if (!isFacebookFeedRootRoute()) return false;
    if (!hasDomElement('[role="dialog"][aria-label="Messenger"]')) return false;

    const element = getClosestRequestElement(target);
    if (!element) return false;

    const href = getElementAttribute(element, 'href');
    const label = getElementContextText(element).toLowerCase();
    if (!label && !href) return false;

    return href.includes('/messages/t/') ||
        href.includes('/messages/e2ee/t/') ||
        label.includes('unread message:') ||
        label.includes('active now') ||
        /\b(?:now|\d+\s*[mhdw])\b/.test(label);
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

function getElementContextText(element) {
    const parts = [];
    let current = element;
    for (let depth = 0; current && depth < 5; depth += 1) {
        parts.push(
            getElementAttribute(current, 'aria-label'),
            getElementAttribute(current, 'title'),
            current.innerText,
            current.textContent,
            getElementAttribute(current, 'href')
        );
        current = current.parentElement;
    }
    return parts.filter(Boolean).join(' ');
}

function isFacebookMessagingSurface() {
    const path = String(window.location?.pathname || '').toLowerCase();
    const search = String(window.location?.search || '').toLowerCase();
    const hash = String(window.location?.hash || '').toLowerCase();

    if (path.startsWith('/messages') || path.startsWith('/messenger')) return true;
    if (search.includes('sk=messages') || hash.includes('messages')) return true;
    if (isFacebookFeedMessengerSurface()) return true;

    return false;
}

function isFacebookFeedRootSurface() {
    if (!isFacebookFeedRootRoute()) return false;
    if (isFacebookFeedMessengerSurface()) return false;
    return true;
}

function isFacebookFeedRootRoute() {
    const path = String(window.location?.pathname || '').toLowerCase();
    const search = String(window.location?.search || '').toLowerCase();
    const hash = String(window.location?.hash || '').toLowerCase();

    if (path !== '/' && path !== '/home.php') return false;
    if (search.includes('sk=messages') || hash.includes('messages')) return false;
    return true;
}

function isFacebookFeedMessengerSurface() {
    const hasMessengerPopover =
        hasDomElement('[role="dialog"][aria-label="Messenger"]') &&
        hasDomElement('[role="grid"][aria-label="Chats"]');
    if (hasMessengerPopover) return true;

    const hasMiniChatChrome =
        hasDomElement('[aria-label="Minimize chat"]') ||
        hasDomElement('[aria-label="Close chat"]');
    if (!hasMiniChatChrome) return false;

    return hasDomElement('[role="textbox"][contenteditable="true"]') ||
        hasDomElement('[aria-label^="Write to"]') ||
        hasDomElement('[aria-label^="Messages in conversation"]') ||
        hasDomElement('[aria-label^="Conversation titled"]');
}

function isFacebookRestoredMiniChatLoadingSurface() {
    const log = getDomElement('[aria-label^="Messages in conversation"]');
    if (!log) return false;

    const text = String(log.innerText || log.textContent || '').replace(/\s+/g, ' ').trim();
    return /^Loading(?:\.{3})?$/i.test(text);
}

function hasDomElement(selector) {
    return !!getDomElement(selector);
}

function getDomElement(selector) {
    try {
        return typeof document?.querySelector === 'function' ? document.querySelector(selector) : null;
    } catch (e) {
        return null;
    }
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
