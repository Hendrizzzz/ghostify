import { KILLED_FEATURES, SETTINGS, SETTINGS_READY, isFacebookDotCom, isFacebookMessengerProxy, isMessengerDotCom, isInstagram, markSettingsReady } from './config.js';
import { updatePatterns } from './utils/network.js';
import { hookWebSocket } from './core/interceptors/websocket.js';
import { hookFetch } from './core/interceptors/fetch.js';
import { hookXHR } from './core/interceptors/xhr.js';
import { hookVisibility } from './core/interceptors/focus.js';
import { startFacebookProtection } from './platforms/facebook.js';
import { startInstagramProtection } from './platforms/instagram.js';
import { startMessengerProtection } from './platforms/messenger.js';
import { traceMessengerHealth } from './utils/debug.js';

(function () {
    'use strict';
    if (!(isInstagram || isMessengerDotCom || isFacebookDotCom || isFacebookMessengerProxy)) return;
    if (window.__GHOSTIFY_GHOST_HOOKED__) return;
    window.__GHOSTIFY_GHOST_HOOKED__ = true;

    traceMessengerHealth('ghost.init', {
        world: 'MAIN',
        readyState: document.readyState
    });

    if (isFacebookDotCom && !isMessengerDotCom && window.top !== window) {
        traceMessengerHealth('facebook.child_frame_reduced', { reason: 'network_hooks_only' });
    }

    window.postMessage({
        type: 'GHOSTIFY_SETTINGS_REQUEST',
        source: 'GHOSTIFY_PAGE'
    }, '*');

    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (!event.data || event.data.source !== 'GHOSTIFY_EXTENSION') return;

        if (event.data.type === 'GHOSTIFY_CONFIG_UPDATE') {
            const CONFIG = event.data.config;
            updatePatterns(CONFIG?.patterns);
            updateKillSwitch(CONFIG?.killSwitch);
        }

        if (event.data.type === 'GHOSTIFY_SETTINGS_UPDATE') {
            const settings = normalizeSettings(event.data.settings);
            if (settings) {
                Object.assign(SETTINGS, settings);
                markSettingsReady();
                traceMessengerHealth('settings.update', {
                    msgSeen: SETTINGS.msgSeen,
                    msgTyping: SETTINGS.msgTyping
                });
            }
        }

        if (event.data.type === 'GHOSTIFY_STATUS_REQUEST') {
            window.postMessage({
                type: 'GHOSTIFY_STATUS_RESPONSE',
                source: 'GHOSTIFY_PAGE',
                requestId: event.data.requestId,
                status: createStatusSnapshot()
            }, '*');
        }
    });

    hookWebSocket();
    if (isInstagram || isMessengerDotCom || isFacebookDotCom || isFacebookMessengerProxy) {
        hookVisibility();
    }
    hookFetch();
    hookXHR();

    startFacebookProtection();
    startMessengerProtection();
    startInstagramProtection();


})();

function normalizeSettings(settings) {
    if (!settings || typeof settings !== 'object') return null;

    const normalized = {};
    for (const key of Object.keys(SETTINGS)) {
        if (typeof settings[key] === 'boolean') {
            normalized[key] = settings[key];
        }
    }

    return Object.keys(normalized).length ? normalized : null;
}

function updateKillSwitch(killSwitch) {
    KILLED_FEATURES.clear();
    if (!Array.isArray(killSwitch)) return;

    for (const feature of killSwitch) {
        if (typeof feature === 'string') {
            KILLED_FEATURES.add(feature);
        }
    }
}

function createStatusSnapshot() {
    const counters = {
        blockedWorkerMessages: readCount('__GHOSTIFY_BLOCKED_WORKER_MESSAGES__'),
        sanitizedWorkerMessages: readCount('__GHOSTIFY_SANITIZED_WORKER_MESSAGES__'),
        sanitizedSeenBridgeMessages: readCount('__GHOSTIFY_SANITIZED_SEEN_BRIDGE_MESSAGES__'),
        sanitizedNetworkMessages: readCount('__GHOSTIFY_SANITIZED_NETWORK_MESSAGES__'),
        blockedTypingExportCalls: readCount('__GHOSTIFY_BLOCKED_TYPING_EXPORT_CALLS__'),
        blockedReadExportCalls: readCount('__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__'),
        sanitizedReadExportCalls: readCount('__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__')
    };

    return {
        loaded: true,
        host: window.location.hostname,
        settingsReady: SETTINGS_READY,
        recentActivity: Object.values(counters).some(value => value > 0),
        hooks: {
            ghost: !!window.__GHOSTIFY_GHOST_HOOKED__,
            fetch: !!window.__GHOSTIFY_FETCH_HOOKED__,
            xhr: !!window.__GHOSTIFY_XHR_HOOKED__,
            websocket: !!window.__GHOSTIFY_WEBSOCKET_HOOKED__,
            visibility: !!window.__GHOSTIFY_VISIBILITY_HOOKED__,
            instagram: !!window.__GHOSTIFY_INSTAGRAM_PROTECTION__,
            facebook: !!window.__GHOSTIFY_FACEBOOK_PROTECTION__,
            messenger: !!window.__GHOSTIFY_MESSENGER_PROTECTION__
        },
        counters
    };
}

function readCount(name) {
    const value = Number(window[name] || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
}
