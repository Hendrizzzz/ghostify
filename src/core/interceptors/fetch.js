import { sanitizeMessengerNetworkPayload, shouldBlock } from '../../utils/network.js';
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
        const method = getFetchMethod(input, init);
        const sanitized = sanitizeMessengerNetworkPayload(body, url, { method });
        const inspectBody = sanitized.changed ? sanitized.data : body;

        const blockType = shouldBlock(inspectBody, url, { method });
        traceNetwork('fetch', url, inspectBody, blockType);
        traceMessengerObservation('fetch', url, inspectBody, blockType);
        if (blockType) {
            return createBlockedFetchResponse(blockType, url, inspectBody);
        }

        if (sanitized.changed) {
            if (init && init.body !== undefined) {
                return originalFetch.call(this, input, { ...init, body: sanitized.data });
            }

            if (typeof Request !== 'undefined' && input instanceof Request) {
                return originalFetch.call(this, cloneRequestWithBody(input, sanitized.data));
            }
        }

        return originalFetch.apply(this, arguments);
    };

    const originalBeacon = navigator.sendBeacon;
    if (typeof originalBeacon === 'function') {
        navigator.sendBeacon = function (url, data) {
            const fetchUrl = getFetchUrl(url);
            const sanitized = sanitizeMessengerNetworkPayload(data, fetchUrl, { method: 'POST' });
            const inspectData = sanitized.changed ? sanitized.data : data;
            const blockType = shouldBlock(inspectData, fetchUrl, { method: 'POST' });
            traceNetwork('beacon', fetchUrl, inspectData, blockType);
            traceMessengerObservation('beacon', fetchUrl, inspectData, blockType);
            if (blockType) return true;
            if (sanitized.changed) return originalBeacon.call(this, url, sanitized.data);
            return originalBeacon.apply(this, arguments);
        };
    }

    markGhostifyHook('fetch.hooked', { hasBeacon: typeof originalBeacon === 'function' });
}

function getFetchMethod(input, init) {
    if (init && typeof init.method === 'string') return init.method;
    if (typeof Request !== 'undefined' && input instanceof Request && input.method) return input.method;
    if (input && typeof input.method === 'string') return input.method;
    return 'GET';
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

function cloneRequestWithBody(request, body) {
    try {
        return new Request(request, { body });
    } catch (e) {
        try {
            return new Request(request.url, {
                method: request.method,
                headers: request.headers,
                body,
                mode: request.mode,
                credentials: request.credentials,
                cache: request.cache,
                redirect: request.redirect,
                referrer: request.referrer,
                integrity: request.integrity,
                keepalive: request.keepalive
            });
        } catch (err) {
            return request;
        }
    }
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
