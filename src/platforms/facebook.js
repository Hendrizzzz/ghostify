import { isFacebookDotCom, SETTINGS, isKilled } from '../config.js';

let inVideoArea = false;
let isAnyVideoPlaying = false;
let inChatHover = false;
let allowFocusUntil = 0;
let lastSpoofLog = 0;

export function startFacebookProtection() {
    if (!isFacebookDotCom) return;

    setInterval(() => {
        if (!SETTINGS.msgSeen || isKilled('msgSeen')) return;
        let playing = false;
        const videos = document.getElementsByTagName('video');
        for (let i = 0; i < videos.length; i++) {
            if (!videos[i].paused && !videos[i].ended && videos[i].currentTime > 0) {
                playing = true;
                break;
            }
        }
        isAnyVideoPlaying = playing;
    }, 200);

    const originalPlay = window.HTMLMediaElement.prototype.play;
    window.HTMLMediaElement.prototype.play = function () {
        if (SETTINGS.msgSeen && !isKilled('msgSeen')) {
            isAnyVideoPlaying = true;
            allowFocusUntil = Date.now() + 1500;
        }
        return originalPlay.apply(this, arguments);
    };

    const trackInteraction = (e) => {
        if (!SETTINGS.msgSeen || isKilled('msgSeen')) return;
        let path = e.composedPath ? e.composedPath() : [];
        let hoveringVid = false;
        let hoveringChat = false;

        for (let i = 0; i < path.length; i++) {
            let el = path[i];
            if (el.nodeType === 1) {
                if (!hoveringVid && (el.tagName === 'VIDEO' || el.getAttribute('data-video-id'))) {
                    hoveringVid = true;
                }

                if (!hoveringChat) {
                    let style = window.getComputedStyle(el);
                    if (style.position === 'fixed' && el.getBoundingClientRect().top > window.innerHeight / 2 && el.getBoundingClientRect().width < 450) {
                        hoveringChat = true;
                    }
                    let dataPagelet = el.getAttribute('data-pagelet');
                    let role = el.getAttribute('role');
                    let ariaLabel = el.getAttribute('aria-label');
                    let dataTestid = el.getAttribute('data-testid');

                    if (dataPagelet && (dataPagelet.includes('Chat') || dataPagelet.includes('MWJewel') || dataPagelet.includes('Messenger'))) {
                        hoveringChat = true;
                    }
                    if (role === 'dialog' || role === 'complementary' || role === 'button') {
                        if (ariaLabel && (ariaLabel.includes('Messenger') || ariaLabel.includes('Chat') || ariaLabel.includes('conversation'))) {
                            hoveringChat = true;
                        }
                    }
                    if (dataTestid && dataTestid.includes('messenger')) {
                        hoveringChat = true;
                    }
                }
            }
        }

        if (!hoveringVid && !hoveringChat) {
            const videos = document.getElementsByTagName('video');
            for (let i = 0; i < videos.length; i++) {
                const vid = videos[i];

                let container = vid;
                for (let j = 0; j < 4; j++) {
                    if (container.parentElement) container = container.parentElement;
                }

                const rect = container.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    if (e.clientX >= rect.left - 150 && e.clientX <= rect.right + 150 &&
                        e.clientY >= rect.top - 150 && e.clientY <= rect.bottom + 150) {
                        hoveringVid = true;
                        break;
                    }
                }
            }
        }

        inVideoArea = hoveringVid;
        inChatHover = hoveringVid ? false : hoveringChat;

        if (e.type === 'mousedown') {
            if (hoveringVid || !hoveringChat) {
                allowFocusUntil = Date.now() + 1500;
            } else {
                allowFocusUntil = 0;
            }
        }
    };

    window.addEventListener('mouseover', trackInteraction, { capture: true, passive: true });
    window.addEventListener('mousedown', trackInteraction, { capture: true, passive: true });
}

function isFacebookChatFocused() {
    if (inChatHover) return true;
    if (window.location.pathname.startsWith('/messages')) return true;

    let el = document.activeElement;
    while (el) {
        if (el.nodeType === 1) {
            let style = window.getComputedStyle(el);
            if (style.position === 'fixed' && el.getBoundingClientRect().top > window.innerHeight / 2 && el.getBoundingClientRect().width < 450) return true;

            let dataPagelet = el.getAttribute('data-pagelet');
            let ariaLabel = el.getAttribute('aria-label');
            if (dataPagelet && (dataPagelet.includes('Chat') || dataPagelet.includes('MWJewel') || dataPagelet.includes('Messenger'))) return true;

            let role = el.getAttribute('role');
            if (role === 'dialog' || role === 'complementary') {
                if (ariaLabel && (ariaLabel.includes('Messenger') || ariaLabel.includes('Chat') || ariaLabel.includes('conversation'))) return true;
            }
        }
        el = el.parentElement;
    }
    return false;
}

export function getFacebookSpoofState() {
    if (!SETTINGS.msgSeen || isKilled('msgSeen')) return null;

    if (isFacebookChatFocused()) {
        allowFocusUntil = 0;
        const now = Date.now();
        if (now - lastSpoofLog > 3000) {
            lastSpoofLog = now;
            console.log('👻 [SPOOF] facebook.com | ACTIVE (Chat Force)');
        }
        return 'unfocused';
    }

    if (isAnyVideoPlaying || inVideoArea || Date.now() < allowFocusUntil) {
        return 'video';
    }

    const now = Date.now();
    if (now - lastSpoofLog > 3000) {
        lastSpoofLog = now;
        console.log('👻 [SPOOF] facebook.com | ALWAYS ON (Default Shield)');
    }
    return 'unfocused';
}
