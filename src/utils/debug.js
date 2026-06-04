const DEBUG_TERMS = [
    'api/graphql',
    'stories',
    'story',
    'reel',
    'seen',
    'direct_v2',
    'typing',
    'indicate_activity',
    'sendtyping',
    'sendchatstate',
    'typ.php',
    'mqtt',
    'edge-chat'
];

const PAGE_HASH_SALT = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const PAGE_START_MS = Date.now();
const DIAGNOSTIC_VERSION = '2026-05-23-instagram-direct-27';

const MESSENGER_OBSERVE_TERMS = [
    'sendtypingindicator',
    'lssendtypingindicator',
    'lssendtypingindicatorstoredprocedure',
    'sendchatstate',
    'send_chat_state',
    'sendchatstatefromcomposer',
    'mawsecuretypingstate',
    'securetypingstate',
    'typingindicatorstoredprocedure',
    'is_typing',
    'istyping',
    'typing_indicator',
    'typing_on',
    'send_typing',
    'send_typing_indicator',
    'thread_typing',
    'orca_typing_notifications',
    'indicate_activity',
    'activity_indicator',
    'composer',
    'markthreadasread',
    'mark_thread_read',
    'markthreadreadmutation',
    'markthreadread',
    'markread',
    'markasread',
    'mark_read',
    'markseen',
    'mark_seen',
    'thread_seen',
    'threadseen',
    'change_read_status',
    'updatelastseenat',
    'updatelastreadwatermark',
    'sendreadreceipt',
    'lssendreadreceipt',
    'readreceiptmutation',
    'readreceipt',
    'lsupdatethreadreadwatermark',
    'lsmarkthreadread',
    'mwmarkthreadread',
    'lsupdatelastreadwatermark',
    'last_read_watermark',
    'last_read_watermark_ts',
    'read_watermark',
    'watermarktimestamp',
    'watermark_timestamp',
    'shouldsendreadreceipt',
    'seenbyviewer',
    'seen_by_viewer',
    'read_receipt',
    'delivery_receipt',
    'deliveryreceipt',
    'delivery_receipts',
    'message_delivered',
    'markdelivered',
    'ls_req',
    'issue_new_task',
    'issuenewtask',
    'thread_key',
    'thread_fbid',
    'act_thread_id',
    'api/graphql',
    'ajax/messaging/typ.php',
    'ajax/chat/typ.php',
    'ajax/mercury/change_read_status.php',
    'mqtt',
    'edge-chat'
];

export function markGhostifyHook(name, details = {}) {
    try {
        installDebugHelpers();
        const status = window.__GHOSTIFY_STATUS__ || {
            version: DIAGNOSTIC_VERSION,
            host: window.location.hostname,
            hrefPath: '<redacted>',
            startedAt: roundedElapsedSeconds(),
            hooks: {}
        };

        status.version = DIAGNOSTIC_VERSION;
        status.host = window.location.hostname;
        status.debug = {
            ghostifyDebug: window.localStorage?.ghostifyDebug === '1',
            ghostifyMessengerObserve: window.localStorage?.ghostifyMessengerObserve === '1'
        };
        status.hooks[name] = Object.assign({ t: roundedElapsedSeconds() }, details);
        window.__GHOSTIFY_STATUS__ = status;
    } catch (e) { }
}

export function traceNetwork(kind, url, body, blockType = null) {
    if (!isDebugEnabled()) return;

    const urlString = String(url || '');
    const bodyText = summarizeBody(body);
    const haystack = `${urlString} ${bodyText}`.toLowerCase();
    const terms = DEBUG_TERMS.filter(term => haystack.includes(term));

    if (!blockType && !terms.length) return;

    const event = {
        t: roundedElapsedSeconds(),
        kind,
        blockType,
        url: redactUrl(urlString),
        terms
    };

    const events = window.__GHOSTIFY_DEBUG_EVENTS__ || [];
    events.push(event);
    window.__GHOSTIFY_DEBUG_EVENTS__ = events.slice(-200);

    try {
        console.debug('[Ghostify]', event);
    } catch (e) { }
}

export function traceMessengerObservation(kind, url, body, blockType = null) {
    if (!isMessengerObservationEnabled()) return;

    const urlString = String(url || '');
    const bodyText = summarizeBody(body, 6000);
    const haystack = `${urlString} ${bodyText}`.toLowerCase();
    const terms = MESSENGER_OBSERVE_TERMS.filter(term => haystack.includes(term));
    const nearMiss = isMessengerNearMiss(kind, urlString, haystack);
    if (!blockType && !terms.length && !nearMiss) return;
    const dataShape = describeDataShape(body, bodyText || urlString);
    const phase = getCapturePhase();
    if (shouldThrottleNearMiss(kind, urlString, blockType, terms, dataShape, phase)) return;

    const event = {
        v: 1,
        t: roundedElapsedSeconds(),
        phase,
        transport: kind,
        action: blockType ? 'drop' : (terms.length ? 'allow' : 'near_miss'),
        blockType,
        featureGuess: guessFeature(haystack, blockType),
        url: redactUrl(urlString),
        terms,
        flags: makeObservationFlags(haystack),
        request: extractRequestMetadata(urlString, bodyText),
        dataShape,
        callSite: getCallSite(),
        redaction: {
            rawStored: false,
            idsHashed: true,
            pageSalted: true
        }
    };

    pushObservation(event);

    try {
        console.debug('[Ghostify Messenger Observe]', event);
    } catch (e) { }
}

export function traceMessengerHealth(source, details = {}) {
    markGhostifyHook(source, details);
    if (!isMessengerObservationEnabled()) return;

    const event = {
        v: 1,
        t: roundedElapsedSeconds(),
        phase: getCapturePhase(),
        transport: 'health',
        action: 'hook',
        blockType: null,
        featureGuess: 'health',
        source,
        details: sanitizeDetails(details),
        redaction: {
            rawStored: false,
            idsHashed: true,
            pageSalted: true
        }
    };

    pushObservation(event);

    try {
        console.debug('[Ghostify Messenger Observe]', event);
    } catch (e) { }
}

function installDebugHelpers() {
    try {
        if (window.__GHOSTIFY_CAPTURE_HELPERS__) return;
        window.__GHOSTIFY_CAPTURE_HELPERS__ = DIAGNOSTIC_VERSION;
        window.__GHOSTIFY_OBSERVATION_COUNTS__ = window.__GHOSTIFY_OBSERVATION_COUNTS__ || {};

        window.__GHOSTIFY_RESET_CAPTURE__ = function (phase = 'baseline') {
            window.__GHOSTIFY_CAPTURE_PHASE__ = String(phase || 'baseline').slice(0, 40);
            window.__GHOSTIFY_MESSENGER_OBSERVATIONS__ = [];
            window.__GHOSTIFY_DEBUG_EVENTS__ = [];
            window.__GHOSTIFY_OBSERVATION_COUNTS__ = {};
            window.__GHOSTIFY_BLOCKED_WORKER_MESSAGES__ = 0;
            window.__GHOSTIFY_SANITIZED_WORKER_MESSAGES__ = 0;
            window.__GHOSTIFY_SANITIZED_SEEN_BRIDGE_MESSAGES__ = 0;
            window.__GHOSTIFY_SANITIZED_NETWORK_MESSAGES__ = 0;
            window.__GHOSTIFY_FACEBOOK_UNSAFE_BLOCKS_SKIPPED__ = 0;
            window.__GHOSTIFY_MESSENGER_UNSAFE_BLOCKS_SKIPPED__ = 0;
            window.__GHOSTIFY_UNSAFE_TRANSFER_BLOCKS_SKIPPED__ = 0;
            window.__GHOSTIFY_BLOCKED_TYPING_EXPORT_CALLS__ = 0;
            window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ = 0;
            window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ = 0;
            pushObservation(createMarkerEvent(`reset:${window.__GHOSTIFY_CAPTURE_PHASE__}`));
            return `Ghostify capture reset: ${window.__GHOSTIFY_CAPTURE_PHASE__}`;
        };

        window.__GHOSTIFY_MARK__ = function (phase) {
            window.__GHOSTIFY_CAPTURE_PHASE__ = String(phase || 'mark').slice(0, 40);
            pushObservation(createMarkerEvent(window.__GHOSTIFY_CAPTURE_PHASE__));
            return `Ghostify phase: ${window.__GHOSTIFY_CAPTURE_PHASE__}`;
        };

        window.__GHOSTIFY_REPORT__ = function () {
            return JSON.stringify({
                status: window.__GHOSTIFY_STATUS__,
                phase: getCapturePhase(),
                observations: window.__GHOSTIFY_MESSENGER_OBSERVATIONS__ || [],
                observationCounts: window.__GHOSTIFY_OBSERVATION_COUNTS__ || {},
                debugEvents: window.__GHOSTIFY_DEBUG_EVENTS__ || [],
                blockedWorkerMessages: window.__GHOSTIFY_BLOCKED_WORKER_MESSAGES__ || 0,
                sanitizedWorkerMessages: window.__GHOSTIFY_SANITIZED_WORKER_MESSAGES__ || 0,
                sanitizedSeenBridgeMessages: window.__GHOSTIFY_SANITIZED_SEEN_BRIDGE_MESSAGES__ || 0,
                sanitizedNetworkMessages: window.__GHOSTIFY_SANITIZED_NETWORK_MESSAGES__ || 0,
                facebookUnsafeBlocksSkipped: window.__GHOSTIFY_FACEBOOK_UNSAFE_BLOCKS_SKIPPED__ || 0,
                messengerUnsafeBlocksSkipped: window.__GHOSTIFY_MESSENGER_UNSAFE_BLOCKS_SKIPPED__ || 0,
                unsafeTransferBlocksSkipped: window.__GHOSTIFY_UNSAFE_TRANSFER_BLOCKS_SKIPPED__ || 0,
                blockedTypingExportCalls: window.__GHOSTIFY_BLOCKED_TYPING_EXPORT_CALLS__ || 0,
                blockedReadExportCalls: window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
                sanitizedReadExportCalls: window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
                settings: window.__GHOSTIFY_SETTINGS__
            }, null, 2);
        };
    } catch (e) { }
}

function createMarkerEvent(label) {
    return {
        v: 1,
        t: roundedElapsedSeconds(),
        phase: getCapturePhase(),
        transport: 'marker',
        action: 'mark',
        blockType: null,
        featureGuess: 'marker',
        label: String(label || '').slice(0, 80),
        redaction: {
            rawStored: false,
            idsHashed: true,
            pageSalted: true
        }
    };
}

function getCapturePhase() {
    try {
        return String(window.__GHOSTIFY_CAPTURE_PHASE__ || 'unmarked').slice(0, 40);
    } catch (e) {
        return 'unmarked';
    }
}

function pushObservation(event) {
    try {
        const events = window.__GHOSTIFY_MESSENGER_OBSERVATIONS__ || [];
        events.push(event);
        window.__GHOSTIFY_MESSENGER_OBSERVATIONS__ = events.slice(-200);
    } catch (e) { }
}

function shouldThrottleNearMiss(kind, urlString, blockType, terms, dataShape, phase) {
    if (blockType || terms.length) return false;
    const key = [
        phase || 'unmarked',
        kind,
        safeEndpointClass(urlString),
        dataShape.kind,
        dataShape.approxBytes
    ].join('|');

    const counts = window.__GHOSTIFY_OBSERVATION_COUNTS__ || {};
    counts[key] = (counts[key] || 0) + 1;
    window.__GHOSTIFY_OBSERVATION_COUNTS__ = counts;

    return counts[key] > 5;
}

function safeEndpointClass(urlString) {
    try {
        const url = new URL(String(urlString || ''), window.location.href);
        return `${url.hostname}${url.pathname}`;
    } catch (e) {
        return `url:${hashText(urlString)}`;
    }
}

function isDebugEnabled() {
    try {
        return window.localStorage?.ghostifyDebug === '1';
    } catch (e) {
        return false;
    }
}

function isMessengerObservationEnabled() {
    try {
        const host = window.location.hostname.toLowerCase();
        const supportedHost = host === 'messenger.com' ||
            host.endsWith('.messenger.com') ||
            host === 'facebook.com' ||
            host.endsWith('.facebook.com') ||
            host === 'fbsbx.com' ||
            host.endsWith('.fbsbx.com');

        return supportedHost &&
            window.localStorage?.ghostifyDebug === '1' &&
            window.localStorage?.ghostifyMessengerObserve === '1';
    } catch (e) {
        return false;
    }
}

function isMessengerNearMiss(kind, urlString, haystack) {
    if (!isMessengerHost()) return false;
    if (kind === 'websocket') return true;

    const safeUrl = String(urlString || '').toLowerCase();
    return safeUrl.includes('/api/graphql') ||
        safeUrl.includes('/ajax/') ||
        safeUrl.includes('/ls_req') ||
        haystack.includes('fb_api_req_friendly_name') ||
        haystack.includes('doc_id') ||
        haystack.includes('comet') ||
        haystack.includes('messenger') ||
        haystack.includes('maw') ||
        haystack.includes('lsplatform') ||
        haystack.includes('mwchat');
}

function isMessengerHost() {
    try {
        const host = window.location.hostname.toLowerCase();
        return host === 'messenger.com' ||
            host.endsWith('.messenger.com') ||
            host === 'facebook.com' ||
            host.endsWith('.facebook.com') ||
            host === 'fbsbx.com' ||
            host.endsWith('.fbsbx.com');
    } catch (e) {
        return false;
    }
}

function summarizeBody(body, limit = 2000) {
    try {
        if (!body) return '';
        if (typeof body === 'string') return withDecodedText(body, limit);
        if (body instanceof URLSearchParams) return withDecodedText(body.toString(), limit);
        if (body instanceof ArrayBuffer) return decodeBytes(new Uint8Array(body.slice(0, limit)), limit);
        if (ArrayBuffer.isView(body)) {
            return decodeBytes(new Uint8Array(body.buffer, body.byteOffset, Math.min(body.byteLength, limit)), limit);
        }
        if (body instanceof FormData) {
            let text = '';
            for (const [key, value] of body.entries()) {
                text += `${key}=${typeof value === 'string' ? value : '[file]'}&`;
                if (text.length >= limit) break;
            }
            return withDecodedText(text, limit);
        }
    } catch (e) { }
    return '';
}

function withDecodedText(value, limit) {
    const raw = String(value || '').slice(0, limit);
    try {
        const decoded = decodeURIComponent(raw.replace(/\+/g, ' '));
        return decoded && decoded !== raw ? `${raw} ${decoded}`.slice(0, limit * 2) : raw;
    } catch (e) {
        return raw;
    }
}

function decodeBytes(bytes, limit) {
    try {
        return withDecodedText(new TextDecoder().decode(bytes), limit);
    } catch (e) {
        return '';
    }
}

function guessFeature(haystack, blockType) {
    if (blockType) return blockType;
    if (haystack.includes('delivery_receipt')) return 'delivery';
    if (
        haystack.includes('typing') ||
        haystack.includes('sendchatstate') ||
        haystack.includes('typ.php')
    ) {
        return 'typing';
    }
    if (
        haystack.includes('readreceipt') ||
        haystack.includes('read_receipt') ||
        haystack.includes('read_watermark') ||
        haystack.includes('markthreadasread') ||
        haystack.includes('markasread') ||
        haystack.includes('mark_read') ||
        haystack.includes('mark_seen') ||
        haystack.includes('thread_seen')
    ) {
        return 'seen';
    }
    return 'unknown';
}

function makeObservationFlags(haystack) {
    return {
        hasGraphQL: haystack.includes('api/graphql') || haystack.includes('doc_id'),
        hasLSRequest: haystack.includes('ls_req') || haystack.includes('issue_new_task') || haystack.includes('issuenewtask'),
        hasThreadTarget: haystack.includes('thread_key') || haystack.includes('threadkey') || haystack.includes('thread_fbid') || haystack.includes('threadfbid') || haystack.includes('thread_id') || haystack.includes('threadid') || haystack.includes('recipient_id') || haystack.includes('message_thread') || haystack.includes('act_thread_id'),
        hasWatermark: haystack.includes('read_watermark') || haystack.includes('readwatermark') || haystack.includes('last_read_watermark') || haystack.includes('lastreadwatermark') || haystack.includes('watermarktimestamp'),
        hasTypingState: haystack.includes('is_typing') || haystack.includes('istyping') || haystack.includes('typing_indicator') || haystack.includes('typing_status') || haystack.includes('typing_on') || haystack.includes('sendchatstate') || haystack.includes('chatstate'),
        hasDeliveryReceipt: haystack.includes('delivery_receipt'),
        hasReadReceipt: haystack.includes('readreceipt') || haystack.includes('read_receipt') || haystack.includes('sendreadreceipt') || haystack.includes('markthreadasread'),
        hasLegacyTypingEndpoint: haystack.includes('ajax/messaging/typ.php') || haystack.includes('ajax/chat/typ.php'),
        hasLegacyReadEndpoint: haystack.includes('ajax/mercury/change_read_status.php')
    };
}

function extractRequestMetadata(urlString, bodyText) {
    const metadata = {};

    try {
        const url = new URL(urlString, window.location.href);
        metadata.path = url.pathname;
        assignMetadataValue(metadata, 'fb_api_req_friendly_name', url.searchParams.get('fb_api_req_friendly_name'));
        assignMetadataValue(metadata, 'doc_id', url.searchParams.get('doc_id'));
    } catch (e) { }

    for (const key of ['fb_api_req_friendly_name', 'doc_id']) {
        const value = extractParam(bodyText, key);
        assignMetadataValue(metadata, key, value);
    }

    return metadata;
}

function extractParam(text, key) {
    try {
        const match = String(text || '').match(new RegExp(`${key}=([^&\\s]+)`, 'i'));
        return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
    } catch (e) {
        return '';
    }
}

function describeBody(body) {
    if (!body) return 'empty';
    if (typeof body === 'string') return 'string';
    if (body instanceof URLSearchParams) return 'urlsearchparams';
    if (body instanceof FormData) return 'formdata';
    if (body instanceof ArrayBuffer) return 'arraybuffer';
    if (ArrayBuffer.isView(body)) return 'typedarray';
    if (typeof body === 'object') return 'object';
    return typeof body;
}

function describeDataShape(body, hashSource) {
    const shape = {
        kind: describeBody(body),
        approxBytes: estimateLength(body, String(hashSource || '')),
        hash: hashText(hashSource || '')
    };

    try {
        if (body instanceof ArrayBuffer) {
            addBinaryShape(shape, new Uint8Array(body));
        } else if (ArrayBuffer.isView(body)) {
            addBinaryShape(shape, new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
        } else if (Array.isArray(body)) {
            shape.arrayLength = body.length;
            shape.itemKinds = body.slice(0, 8).map(describeBody);
        } else if (body && typeof body === 'object' && !(body instanceof URLSearchParams) && !(body instanceof FormData)) {
            let keyCount = 0;
            const keyHashes = [];
            for (const key of Object.keys(body)) {
                keyCount += 1;
                if (keyHashes.length < 8) keyHashes.push(hashText(key));
            }
            shape.keyCount = keyCount;
            shape.keyHashes = keyHashes;
        }
    } catch (e) { }

    return shape;
}

function addBinaryShape(shape, bytes) {
    shape.byteLength = bytes.byteLength;
    shape.prefix8Hash = hashBytes(bytes, 8);
    shape.prefix32Hash = hashBytes(bytes, 32);
}

function hashBytes(bytes, limit) {
    let text = '';
    const length = Math.min(bytes.byteLength, limit);
    for (let i = 0; i < length; i++) {
        text += String.fromCharCode(bytes[i]);
    }
    return hashText(text);
}

function estimateLength(body, bodyText) {
    try {
        if (!body) return 0;
        if (typeof body === 'string') return body.length;
        if (body instanceof URLSearchParams) return body.toString().length;
        if (body instanceof ArrayBuffer) return body.byteLength;
        if (ArrayBuffer.isView(body)) return body.byteLength;
        return bodyText.length;
    } catch (e) {
        return 0;
    }
}

function getCallSite() {
    try {
        const stack = new Error().stack;
        if (!stack) return [];
        return stack
            .split('\n')
            .slice(3, 8)
            .map(sanitizeStackLine)
            .filter(Boolean);
    } catch (e) {
        return [];
    }
}

function sanitizeStackLine(line) {
    const value = String(line || '').trim();
    if (!value) return '';
    return value.replace(/https?:\/\/[^\s)]+/g, (match) => {
        try {
            const url = new URL(match);
            const file = url.pathname.split('/').filter(Boolean).pop() || url.hostname;
            return `${url.hostname}/${file}`;
        } catch (e) {
            return `url:${hashText(match)}`;
        }
    }).slice(0, 180);
}

function hashText(text) {
    const input = `${PAGE_HASH_SALT}:${String(text || '')}`;
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function redactMetadataValue(key, value) {
    const normalized = String(value || '').slice(0, 160);
    if (key === 'fb_api_req_friendly_name' && /^[A-Za-z0-9_.$:-]{1,120}$/.test(normalized)) {
        return normalized;
    }
    return `hash:${hashText(normalized)}`;
}

function sanitizeDetails(details) {
    const output = {};
    if (!details || typeof details !== 'object') return output;

    for (const [key, value] of Object.entries(details)) {
        if (value == null || typeof value === 'boolean' || typeof value === 'number') {
            output[key] = value;
        } else {
            output[key] = String(value).slice(0, 80);
        }
    }

    return output;
}

function assignMetadataValue(metadata, key, value) {
    if (!value) return;
    if (key === 'doc_id') {
        if (!metadata.doc_id_hash) metadata.doc_id_hash = redactMetadataValue(key, value);
        return;
    }
    if (!metadata[key]) metadata[key] = redactMetadataValue(key, value);
}

function roundedElapsedSeconds() {
    return Math.round((Date.now() - PAGE_START_MS) / 1000);
}

function redactUrl(urlString) {
    try {
        const url = new URL(urlString, window.location.href);
        const keptParams = new URLSearchParams();
        const friendlyName = url.searchParams.get('fb_api_req_friendly_name');
        const docId = url.searchParams.get('doc_id');
        if (friendlyName) keptParams.set('fb_api_req_friendly_name', redactMetadataValue('fb_api_req_friendly_name', friendlyName));
        if (docId) keptParams.set('doc_id_hash', redactMetadataValue('doc_id', docId));

        const query = keptParams.toString();
        return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
    } catch (e) {
        return `unparseable-url:${hashText(urlString)}`;
    }
}
