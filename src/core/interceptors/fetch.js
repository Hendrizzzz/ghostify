import { shouldBlock } from '../../utils/network.js';
import { markGhostifyHook, traceMessengerObservation, traceNetwork } from '../../utils/debug.js';
import { createBlockedPayload } from '../../utils/responses.js';

export function hookFetch() {
    if (window.__GHOSTIFY_FETCH_HOOKED__) return;
    window.__GHOSTIFY_FETCH_HOOKED__ = true;

    const originalFetch = window.fetch;
    markGhostifyHook('fetch.install', { hasFetch: typeof originalFetch === 'function' });

    window.fetch = async function (input, init) {
        const url = getFetchUrl(input);
        const body = await getFetchBody(input, init);

        const blockType = shouldBlock(body, url);
        traceNetwork('fetch', url, body, blockType);
        traceMessengerObservation('fetch', url, body, blockType);
        if (blockType) {
            return createBlockedFetchResponse(blockType, url, body);
        }

        return originalFetch.apply(this, arguments);
    };

    const originalBeacon = navigator.sendBeacon;
    if (typeof originalBeacon === 'function') {
        navigator.sendBeacon = function (url, data) {
            const blockType = shouldBlock(data, getFetchUrl(url));
            traceNetwork('beacon', getFetchUrl(url), data, blockType);
            traceMessengerObservation('beacon', getFetchUrl(url), data, blockType);
            if (blockType) return true;
            return originalBeacon.apply(this, arguments);
        };
    }

    markGhostifyHook('fetch.hooked', { hasBeacon: typeof originalBeacon === 'function' });
}

function getFetchUrl(input) {
    if (typeof input === 'string') return input;
    if (typeof URL !== 'undefined' && input instanceof URL) return input.href;
    if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
    if (input && typeof input.url === 'string') return input.url;
    return String(input || '');
}

async function getFetchBody(input, init) {
    if (init && init.body !== undefined && init.body !== null) {
        return readBody(init.body);
    }

    if (typeof Request !== 'undefined' && input instanceof Request) {
        try {
            return await input.clone().text();
        } catch (e) {
            return '';
        }
    }

    return '';
}

async function readBody(body) {
    if (typeof Blob !== 'undefined' && body instanceof Blob) {
        try {
            return await body.text();
        } catch (e) {
            return '';
        }
    }

    return body;
}

function createBlockedFetchResponse(blockType, url, body) {
    return createJsonResponse(createBlockedPayload(blockType, url, body));
}

function createJsonResponse(payload) {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
