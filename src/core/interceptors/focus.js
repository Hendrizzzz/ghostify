import { isFacebookDotCom, isFacebookMessengerProxy, isMessengerDotCom, isInstagram } from '../../config.js';
import { getFacebookSpoofState } from '../../platforms/facebook.js';
import { getInstagramSpoofState } from '../../platforms/instagram.js';
import { getMessengerSpoofState } from '../../platforms/messenger.js';

const FOCUS_EVENTS = ['visibilitychange', 'webkitvisibilitychange', 'blur', 'focus', 'focusin', 'focusout'];

function shouldSpoofVisibility() {
    if (isMessengerDotCom || isFacebookMessengerProxy) {
        const state = getMessengerSpoofState();
        if (state !== null) return state;
    }

    if (isFacebookDotCom) {
        const state = getFacebookSpoofState();
        if (state !== null) return state;
    }

    if (isInstagram) {
        const state = getInstagramSpoofState();
        if (state !== null) return state;
    }

    return false;
}

export function hookVisibility() {
    if (window.__GHOSTIFY_VISIBILITY_HOOKED__) return;
    window.__GHOSTIFY_VISIBILITY_HOOKED__ = true;

    const originalHasFocus = document.hasFocus.bind(document);
    const originalVisibilityState = getPropertyDescriptor('visibilityState');
    const originalHidden = getPropertyDescriptor('hidden');
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
    const wrappedListeners = new WeakMap();

    Object.defineProperty(document, 'hasFocus', {
        value: function () {
            const spoof = shouldSpoofVisibility();
            if (spoof === 'hidden' || spoof === 'unfocused' || spoof === 'unfocused-passive') return false;
            return originalHasFocus();
        },
        configurable: true
    });

    Object.defineProperty(document, 'visibilityState', {
        get: function () {
            const spoof = shouldSpoofVisibility();
            if (spoof === 'hidden') return 'hidden';
            return originalVisibilityState?.get ? originalVisibilityState.get.call(document) : 'visible';
        },
        configurable: true
    });

    Object.defineProperty(document, 'hidden', {
        get: function () {
            const spoof = shouldSpoofVisibility();
            if (spoof === 'hidden') return true;
            return originalHidden?.get ? originalHidden.get.call(document) : false;
        },
        configurable: true
    });

    EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (!FOCUS_EVENTS.includes(type) || !listener) {
            return originalAddEventListener.call(this, type, listener, options);
        }

        const wrapped = getWrappedListener(type, listener, wrappedListeners);
        return originalAddEventListener.call(this, type, wrapped, options);
    };

    EventTarget.prototype.removeEventListener = function (type, listener, options) {
        const wrapped = FOCUS_EVENTS.includes(type) ? findWrappedListener(type, listener, wrappedListeners) : null;
        return originalRemoveEventListener.call(this, type, wrapped || listener, options);
    };
}

function getPropertyDescriptor(prop) {
    let proto = Document.prototype;
    while (proto) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
        if (descriptor) return descriptor;
        proto = Object.getPrototypeOf(proto);
    }
    return null;
}

function getWrappedListener(type, listener, wrappedListeners) {
    let typeMap = wrappedListeners.get(listener);
    if (!typeMap) {
        typeMap = new Map();
        wrappedListeners.set(listener, typeMap);
    }

    if (typeMap.has(type)) return typeMap.get(type);

    const wrapped = function (event) {
        const spoof = shouldSpoofVisibility();
        if (spoof) {
            const suppressFocusEvents = spoof === 'hidden' || spoof === 'unfocused';
            if (suppressFocusEvents && (type === 'blur' || type === 'focus' || type === 'focusin' || type === 'focusout')) {
                if (this === window || this === document || (event && (event.target === window || event.target === document))) {
                    return;
                }
            } else if (spoof === 'hidden') {
                return;
            }
        }

        if (typeof listener === 'function') {
            return listener.call(this, event);
        }

        if (listener && typeof listener.handleEvent === 'function') {
            return listener.handleEvent.call(listener, event);
        }
    };

    typeMap.set(type, wrapped);
    return wrapped;
}

function findWrappedListener(type, listener, wrappedListeners) {
    if (!listener) return null;
    return wrappedListeners.get(listener)?.get(type) || null;
}
