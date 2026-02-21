import { isFacebookDotCom, isMessengerDotCom, isInstagram, isDebugMode } from '../../config.js';
import { getFacebookSpoofState } from '../../platforms/facebook.js';
import { getInstagramSpoofState } from '../../platforms/instagram.js';
import { getMessengerSpoofState } from '../../platforms/messenger.js';

function shouldSpoofVisibility() {
    if (isMessengerDotCom) {
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
    const originalHasFocus = document.hasFocus.bind(document);

    Object.defineProperty(document, 'hasFocus', {
        value: function () {
            const spoof = shouldSpoofVisibility();
            if (spoof === 'hidden' || spoof === 'unfocused') return false;
            return originalHasFocus();
        }
    });

    Object.defineProperty(document, 'visibilityState', {
        get: function () {
            const spoof = shouldSpoofVisibility();
            if (spoof === 'hidden') return 'hidden';
            return 'visible';
        }
    });

    Object.defineProperty(document, 'hidden', {
        get: function () {
            const spoof = shouldSpoofVisibility();
            if (spoof === 'hidden') return true;
            return false;
        }
    });

    const origAddEvt = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, opt) {
        if (['visibilitychange', 'webkitvisibilitychange', 'blur', 'focus', 'focusin', 'focusout'].includes(type)) {
            const wrappedListener = function (e) {
                const spoof = shouldSpoofVisibility();
                if (spoof) {
                    if (spoof === 'video') {
                        if (type === 'blur' || type === 'focus' || type === 'focusin' || type === 'focusout') {
                            if (this === window || this === document || (e && (e.target === window || e.target === document))) {
                                return;
                            }
                        }
                        return listener.call(this, e);
                    }

                    if (type === 'blur' || type === 'focus' || type === 'focusin' || type === 'focusout') {
                        if (this === window || this === document || (e && (e.target === window || e.target === document))) {
                            if (isDebugMode()) console.log(`👻 [EVENT BLOCK] ${type} on window/document swallowed.`);
                            return;
                        }
                    } else {
                        if (isDebugMode()) console.log(`👻 [EVENT BLOCK] ${type} swallowed.`);
                        return;
                    }
                }
                return listener.call(this, e);
            };
            return origAddEvt.call(this, type, wrappedListener, opt);
        }
        return origAddEvt.call(this, type, listener, opt);
    };
}
