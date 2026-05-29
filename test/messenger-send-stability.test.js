const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const ghostSource = fs.readFileSync('dist/js/ghost.js', 'utf8');
const messengerPatchSource = fs.readFileSync('dist/js/messenger_patch.js', 'utf8');

class FakeResponse {
    constructor(body, init = {}) {
        this.body = body;
        this.status = init.status || 200;
        this.ghostifyResponse = true;
    }
}

class FakeWebSocket {
    constructor(url) {
        this.url = url;
        this.sent = [];
    }

    send(data) {
        this.sent.push(data);
        return 'sent';
    }
}

class FakeXHR {
    open(method, url) {
        this._ghostifyMethod = method;
        this._ghostifyUrl = url;
    }

    send(body) {
        this.sent = body;
        return 'sent';
    }
}

function FakeEventTarget() { }
FakeEventTarget.prototype.addEventListener = function (type, listener) {
    if (!listener) return;
    this.__listeners = this.__listeners || {};
    this.__listeners[type] = this.__listeners[type] || [];
    this.__listeners[type].push(listener);
};
FakeEventTarget.prototype.removeEventListener = function (type, listener) {
    const listeners = this.__listeners?.[type];
    if (!listeners) return;
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
};
FakeEventTarget.prototype.dispatchEvent = function (event) {
    const targetEvent = event || {};
    targetEvent.target = targetEvent.target || this;
    for (const listener of this.__listeners?.[targetEvent.type] || []) {
        if (typeof listener === 'function') {
            listener.call(this, targetEvent);
        } else if (listener && typeof listener.handleEvent === 'function') {
            listener.handleEvent.call(listener, targetEvent);
        }
    }
    return true;
};

class FakeRequest {
    constructor(input, init = {}) {
        if (input instanceof FakeRequest) {
            this.url = input.url;
            this.method = init.method || input.method;
            this.headers = init.headers || input.headers;
            this.body = init.body !== undefined ? init.body : input.body;
        } else {
            this.url = String(input || '');
            this.method = init.method || 'GET';
            this.headers = init.headers || {};
            this.body = init.body;
        }
        this.mode = init.mode || 'same-origin';
        this.credentials = init.credentials || 'same-origin';
        this.cache = init.cache || 'default';
        this.redirect = init.redirect || 'follow';
        this.referrer = init.referrer || '';
        this.integrity = init.integrity || '';
        this.keepalive = !!init.keepalive;
    }

    clone() {
        return new FakeRequest(this);
    }

    async text() {
        return this.body || '';
    }
}

function FakeDocument() { }
FakeDocument.prototype = Object.create(FakeEventTarget.prototype);
FakeDocument.prototype.constructor = FakeDocument;
Object.defineProperty(FakeDocument.prototype, 'visibilityState', {
    get() { return 'visible'; },
    configurable: true
});
Object.defineProperty(FakeDocument.prototype, 'hidden', {
    get() { return false; },
    configurable: true
});

const messengerSendWithWatermark = JSON.stringify({
    issue_new_task: true,
    tasks: [{
        label: 'send_message',
        queue_name: 'messenger_send_message',
        payload: {
            thread_key: { thread_fbid: 'redacted-thread' },
            send_type: 1,
            message: { text: '<redacted-user-text>' },
            last_read_watermark_ts: 1779530000000
        }
    }]
});

const messengerSendWithReadReceiptFlag = JSON.stringify({
    issue_new_task: true,
    tasks: [{
        label: 'send_message',
        queue_name: 'messenger_send_message',
        payload: {
            thread_key: { thread_fbid: 'redacted-thread' },
            send_type: 1,
            offline_threading_id: 'redacted-offline-id',
            message: { text: '<redacted-user-text>' },
            last_read_watermark_ts: 1779530000000,
            shouldSendReadReceipt: false
        }
    }]
});

const messengerBatchedSendWithReadReceipt = JSON.stringify({
    issue_new_task: true,
    tasks: [{
        label: 'send_message',
        queue_name: 'messenger_send_message',
        payload: {
            thread_key: { thread_fbid: 'redacted-thread' },
            send_type: 1,
            offline_threading_id: 'redacted-offline-id',
            message: { text: '<redacted-user-text>' }
        }
    }, {
        label: 'read_receipt',
        queue_name: 'read_receipt',
        payload: {
            thread_key: { thread_fbid: 'redacted-thread' },
            sendReadReceipt: true
        }
    }]
});

const messengerBatchedSendWithTyping = JSON.stringify({
    issue_new_task: true,
    tasks: [{
        label: 'send_message',
        queue_name: 'messenger_send_message',
        payload: {
            thread_key: { thread_fbid: 'redacted-thread' },
            send_type: 1,
            offline_threading_id: 'redacted-offline-id',
            message: { text: '<redacted-user-text>' }
        }
    }, {
        label: 'sendChatStateFromComposer',
        queue_name: 'typing_indicator',
        payload: {
            thread_key: { thread_fbid: 'redacted-thread' },
            chatstate: 'typing_indicator',
            send_type: 'typing'
        }
    }]
});

const messengerFormEncodedBatchedSendWithReadReceipt =
    `payload=${encodeURIComponent(messengerBatchedSendWithReadReceipt)}&epoch_id=redacted-epoch`;

const messengerBatchedSendUserTextWithTyping = JSON.stringify({
    issue_new_task: true,
    tasks: [{
        label: 'send_message',
        queue_name: 'messenger_send_message',
        payload: {
            thread_key: { thread_fbid: 'redacted-thread' },
            send_type: 1,
            offline_threading_id: 'redacted-offline-id',
            message: { text: 'typing_indicator mark_read read_receipt' }
        }
    }, {
        label: 'sendChatStateFromComposer',
        queue_name: 'typing_indicator',
        payload: {
            thread_key: { thread_fbid: 'redacted-thread' },
            chatstate: 'typing_indicator',
            send_type: 'typing'
        }
    }]
});

const messengerSendWithUserAuthoredPrivacyTerms = JSON.stringify({
    issue_new_task: true,
    tasks: [{
        label: 'send_message',
        queue_name: 'messenger_send_message',
        payload: {
            thread_key: { thread_fbid: 'redacted-thread' },
            send_type: 1,
            offline_threading_id: 'redacted-offline-id',
            message: { text: 'mark_read reel_seen typing_indicator delivery_receipt' }
        }
    }]
});

const messengerDeliveryWithWatermark = JSON.stringify({
    issue_new_task: true,
    tasks: [{
        label: 'delivery_receipt',
        queue_name: 'message_delivered',
        payload: {
            thread_key: { thread_fbid: 'redacted-thread' },
            message_delivered: true,
            last_read_watermark_ts: 1779530000000
        }
    }]
});

const messengerReadOnlySeenViewerFalseMetadata = JSON.stringify({
    issue_new_task: true,
    tasks: [{
        label: 'message_metadata_load',
        queue_name: 'mwchat_fetch_thread',
        payload: {
            thread_key: { thread_fbid: 'redacted-thread' },
            seen_by_viewer: false,
            seenByViewer: false,
            cursor: 'redacted-cursor'
        }
    }]
});

const messengerEncodedReadOnlySeenViewerFalseMetadata =
    `payload=${encodeURIComponent(messengerReadOnlySeenViewerFalseMetadata)}&epoch_id=redacted-epoch`;

const messengerReadReceiptWithDeliveryMarker = JSON.stringify({
    issue_new_task: true,
    tasks: [{
        label: 'read_receipt',
        queue_name: 'read_receipt',
        payload: {
            thread_key: { thread_fbid: 'redacted-thread' },
            delivery_receipt: true,
            sendReadReceipt: true,
            last_read_watermark_ts: 1779530000000
        }
    }]
});

const messengerTyping = JSON.stringify({
    issue_new_task: true,
    tasks: [{
        label: 'sendChatStateFromComposer',
        payload: {
            thread_key: { thread_fbid: 'redacted-thread' },
            chatstate: 'typing_indicator',
            send_type: 'typing'
        }
    }]
});

const messengerReadReceipt = JSON.stringify({
    issue_new_task: true,
    tasks: [{
        label: 'read_receipt',
        payload: {
            thread_key: { thread_fbid: 'redacted-thread' },
            sendReadReceipt: true
        }
    }]
});

const messengerMessageRequestsQuery = `fb_api_req_friendly_name=MWMessageRequestsThreadListPaginationQuery&doc_id=redacted-doc&variables=${encodeURIComponent(JSON.stringify({
    folder: 'message_requests',
    message_requests: true,
    thread_id: 'redacted-thread',
    last_read_watermark: 1779530000000,
    cursor: 'redacted-cursor'
}))}`;

const lsMessageRequestThreadListLoad = JSON.stringify({
    issue_new_task: true,
    tasks: [{
        label: 'MWMessageRequestsThreadListPaginationQuery',
        queue_name: 'mwchat_fetch_thread_list',
        payload: {
            folder: 'message_requests',
            thread_key: { thread_fbid: 'redacted-thread' },
            cursor: 'redacted-cursor',
            last_read_watermark: 1779530000000
        }
    }]
});

const lsMessageRequestLoadWithFalseReceiptFlag = JSON.stringify({
    issue_new_task: true,
    tasks: [{
        label: 'MWMessageRequestsThreadListPaginationQuery',
        queue_name: 'mwchat_fetch_thread_list',
        payload: {
            folder: 'message_requests',
            thread_key: { thread_fbid: 'redacted-thread' },
            should_send_read_receipt: false
        }
    }]
});

const lsPendingThreadsRequestLoad = JSON.stringify({
    issue_new_task: true,
    tasks: [{
        label: 'MWFilteredThreadsQuery',
        queue_name: 'mwchat_fetch_thread_list',
        payload: {
            folder: 'pending_threads',
            thread_key: { thread_fbid: 'redacted-thread' },
            cursor: 'redacted-cursor',
            last_read_watermark: 1779530000000
        }
    }]
});

const lsSpamThreadsRequestLoad = JSON.stringify({
    issue_new_task: true,
    tasks: [{
        label: 'MWSpamThreadsQuery',
        queue_name: 'mwchat_fetch_thread_list',
        payload: {
            folder: 'spam_threads',
            thread_key: { thread_fbid: 'redacted-thread' },
            cursor: 'redacted-cursor',
            should_send_read_receipt: false
        }
    }]
});

const messageRequestRoutePreloadMutationShape =
    `fb_api_req_friendly_name=CometMessengerMessageRequestsRoutePreloadMutation&doc_id=redacted-doc&variables=${encodeURIComponent(JSON.stringify({
        folder: 'message_requests',
        thread_id: 'redacted-thread',
        cursor: 'redacted-cursor',
        last_read_watermark: 1779530000000,
        route_name: 'message_requests'
    }))}`;

const pendingThreadsRoutePreloadMutationShape =
    `fb_api_req_friendly_name=CometMessengerFilteredThreadsRoutePreloadMutation&doc_id=redacted-doc&variables=${encodeURIComponent(JSON.stringify({
        folder: 'pending_threads',
        thread_id: 'redacted-thread',
        cursor: 'redacted-cursor',
        last_read_watermark: 1779530000000,
        route_name: 'filtered_threads'
    }))}`;

const facebookVideoAdGraphQL = `fb_api_req_friendly_name=CometVideoPlayerAdBreakQuery&doc_id=redacted-doc&variables=${encodeURIComponent(JSON.stringify({
    video_id: 'redacted-video',
    player_state: 'ad_break',
    ad_break: true,
    watch_time: 0,
    composer: { is_composing: false },
    maw: 'player_surface'
}))}`;

const facebookVideoAdGraphQLWithFalsePrivacyFields = `fb_api_req_friendly_name=CometVideoPlayerAdBreakQuery&doc_id=redacted-doc&variables=${encodeURIComponent(JSON.stringify({
    video_id: 'redacted-video',
    player_state: 'ad_break',
    ad_break: true,
    watch_time: 0,
    mark_seen: false,
    read_receipt: false,
    should_send_read_receipt: false,
    composer: { is_composing: false },
    maw: 'player_surface'
}))}`;

const facebookVideoAdWorkerMessageWithFalsePrivacyFields = {
    type: 'player_payload',
    payload: {
        video_id: 'redacted-video',
        player_state: 'ad_break',
        ad_break: true,
        current_time: 12,
        mark_seen: false,
        read_receipt: false,
        should_send_read_receipt: false,
        composer: { is_composing: false },
        maw: 'player_surface'
    }
};

const instagramReelsMediaGraphQL = `fb_api_req_friendly_name=PolarisClipsTabDesktopQuery&doc_id=redacted-doc&variables=${encodeURIComponent(JSON.stringify({
    reel_media_id: 'redacted-reel',
    video_versions: [{ type: 101 }],
    dash_info: { is_dash_eligible: true },
    playable_url: 'https://scontent.cdninstagram.com/redacted.mp4',
    reel_seen: false
}))}`;

const messageRequestReadWatermarkMutation = `fb_api_req_friendly_name=MWMessageRequestsUpdateLastReadWatermarkMutation&doc_id=redacted-doc&variables=${encodeURIComponent(JSON.stringify({
    message_requests: true,
    thread_id: 'redacted-thread',
    last_read_watermark: 1779530000000,
    should_send_read_receipt: true
}))}`;

const messageRequestReadWatermarkOperationMutation = JSON.stringify({
    operationName: 'MWMessageRequestsUpdateLastReadWatermarkMutation',
    doc_id: 'redacted-doc',
    variables: {
        message_requests: true,
        thread_id: 'redacted-thread',
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true
    }
});

const messageRequestReadWatermarkDocIdWrite = JSON.stringify({
    doc_id: 'redacted-doc',
    variables: {
        message_requests: true,
        thread_id: 'redacted-thread',
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true
    }
});

const messageRequestReadReceiptDocIdWrite = JSON.stringify({
    doc_id: 'redacted-doc',
    variables: {
        message_requests: true,
        thread_id: 'redacted-thread',
        read_receipt: true
    }
});

const messageRequestMarkReadDocIdWrite = JSON.stringify({
    doc_id: 'redacted-doc',
    variables: {
        message_requests: true,
        thread_id: 'redacted-thread',
        mark_read: true
    }
});

const facebookVideoReadWatermarkMutation = `fb_api_req_friendly_name=MWUpdateLastReadWatermarkMutation&doc_id=redacted-doc&variables=${encodeURIComponent(JSON.stringify({
    thread_id: 'redacted-thread',
    last_read_watermark: 1779530000000,
    video_id: 'redacted-video',
    player_state: 'playing'
}))}`;

const instagramStorySeenGraphQLWithDocId = JSON.stringify({
    operationName: 'PolarisStorySurfaceMutation',
    doc_id: 'redacted-doc',
    variables: {
        reel_seen: true,
        mark_story_seen: true,
        reel_id: 'redacted-reel',
        timestamp: 1779530000000
    }
});

const instagramStorySeenMediaGraphQLWithDocId = JSON.stringify({
    operationName: 'PolarisStorySurfaceMutation',
    doc_id: 'redacted-doc',
    variables: {
        reel_seen: true,
        mark_story_seen: true,
        reel_media_id: 'redacted-reel',
        playable_url: 'https://scontent.cdninstagram.com/redacted.mp4',
        timestamp: 1779530000000
    }
});

function makeGhostPage(page = {}, settings = {}) {
    const fetchCalls = [];
    const beaconCalls = [];
    const document = new FakeDocument();
    document.readyState = 'complete';
    document.hasFocus = () => true;

    class PageFakeWebSocket extends FakeWebSocket { }
    class PageFakeXHR extends FakeXHR { }

    const window = Object.assign(Object.create(FakeEventTarget.prototype), {
        location: {
            hostname: page.hostname || 'www.messenger.com',
            pathname: page.pathname || '/t/123',
            search: page.search || '',
            hash: page.hash || '',
            href: page.href || `https://${page.hostname || 'www.messenger.com'}${page.pathname || '/t/123'}${page.search || ''}${page.hash || ''}`
        },
        document,
        postMessage(message) {
            window.dispatchEvent({ type: 'message', source: window, data: message, target: window });
        },
        fetch: async (input, init) => {
            fetchCalls.push({ input, init });
            return { original: true };
        },
        fetchCalls,
        WebSocket: PageFakeWebSocket,
        XMLHttpRequest: PageFakeXHR,
        EventTarget: FakeEventTarget,
        navigator: {
            sendBeacon: (url, data) => {
                beaconCalls.push({ url, data });
                return 'beacon';
            }
        },
        beaconCalls,
        localStorage: { ghostifyDebug: '0', ghostifyMessengerObserve: '0' },
        Response: FakeResponse,
        Request: FakeRequest,
        TextDecoder,
        ArrayBuffer,
        URLSearchParams,
        FormData: class { }
    });
    window.window = window;

    const context = {
        window,
        document,
        Document: FakeDocument,
        navigator: window.navigator,
        location: window.location,
        Response: FakeResponse,
        Request: FakeRequest,
        WebSocket: PageFakeWebSocket,
        XMLHttpRequest: PageFakeXHR,
        EventTarget: FakeEventTarget,
        TextDecoder,
        ArrayBuffer,
        URLSearchParams,
        FormData: window.FormData,
        localStorage: window.localStorage,
        console: {
            debug() { },
            log() { },
            error() { }
        }
    };
    context.globalThis = context;

    vm.runInNewContext(ghostSource, context, { filename: 'ghost.js' });
    window.postMessage({
        type: 'GHOSTIFY_SETTINGS_UPDATE',
        source: 'GHOSTIFY_EXTENSION',
        settings: {
            igTyping: true,
            igSeen: true,
            igStory: true,
            msgTyping: true,
            msgSeen: true,
            msgStory: true,
            ...settings
        }
    });

    return window;
}

function makeMessengerPage(settings = {}) {
    return makeGhostPage({
        hostname: 'www.messenger.com',
        pathname: '/t/123',
        href: 'https://www.messenger.com/t/123'
    }, settings);
}

function makeMessengerPatchPage(settings = {}, page = {}) {
    const listeners = {};
    const workerPosts = [];

    function Worker() { }
    Worker.prototype.postMessage = function (message, transfer) {
        workerPosts.push({ target: 'worker', message, transfer });
        return 'worker-sent';
    };

    function MessagePort() { }
    MessagePort.prototype.postMessage = function (message, transfer) {
        workerPosts.push({ target: 'port', message, transfer });
        return 'port-sent';
    };

    const window = {
        location: {
            hostname: page.hostname || 'www.messenger.com',
            pathname: page.pathname || '/t/123',
            search: page.search || '',
            hash: page.hash || '',
            href: page.href || `https://${page.hostname || 'www.messenger.com'}${page.pathname || '/t/123'}${page.search || ''}${page.hash || ''}`
        },
        addEventListener(type, listener) {
            listeners[type] = listeners[type] || [];
            listeners[type].push(listener);
        },
        postMessage(message) {
            for (const listener of listeners.message || []) {
                listener({ source: window, data: message });
            }
        },
        localStorage: { ghostifyDebug: '0', ghostifyMessengerObserve: '0' }
    };
    window.window = window;

    const context = {
        window,
        Worker,
        MessagePort,
        workerPosts,
        document: { readyState: 'complete' },
        TextDecoder,
        ArrayBuffer,
        URLSearchParams,
        console: {
            debug() { },
            log() { },
            error() { }
        }
    };
    context.globalThis = context;

    vm.runInNewContext(messengerPatchSource, context, { filename: 'messenger_patch.js' });
    window.postMessage({
        type: 'GHOSTIFY_SETTINGS_UPDATE',
        source: 'GHOSTIFY_EXTENSION',
        settings: {
            msgTyping: true,
            msgSeen: true,
            ...settings
        }
    });

    return context;
}

function registerMessengerModule(context, moduleName, factory) {
    let registeredModule;
    context.window.__d = function (_moduleName, _dependencies, moduleFactory) {
        const module = { exports: {} };
        const localRequire = () => ({});
        moduleFactory(null, localRequire, localRequire, localRequire, module, module.exports);
        registeredModule = module;
        return module;
    };

    const result = context.window.__d(moduleName, [], factory);
    return registeredModule || result;
}

async function fetchOutcome(window, body) {
    const response = await window.fetch('/ls_req', {
        method: 'POST',
        body
    });
    return response.ghostifyResponse ? JSON.parse(response.body).blocked : 'allowed';
}

async function fetchOutcomeAt(window, url, body, method = 'POST') {
    const response = await window.fetch(url, {
        method,
        body
    });
    if (!response.ghostifyResponse) return 'allowed';
    const payload = JSON.parse(response.body);
    return payload.blocked || 'blocked';
}

async function fetchRequestOutcome(window, body) {
    const request = new window.Request('/ls_req', {
        method: 'POST',
        body
    });
    const response = await window.fetch(request);
    return response.ghostifyResponse ? JSON.parse(response.body).blocked : 'allowed';
}

async function fetchRequestOutcomeAt(window, url, body, method = 'GET') {
    const request = new window.Request(url, {
        method,
        body
    });
    const response = await window.fetch(request);
    if (!response.ghostifyResponse) return 'allowed';
    const payload = JSON.parse(response.body);
    return payload.blocked || 'blocked';
}

function websocketOutcome(window, body, url = 'wss://edge-chat.messenger.com/chat?region=redacted') {
    const socket = new window.WebSocket(url);
    return socket.send(body) === 'sent' ? 'allowed' : 'blocked';
}

function websocketSend(window, body, url = 'wss://edge-chat.messenger.com/chat?region=redacted') {
    const socket = new window.WebSocket(url);
    const result = socket.send(body);
    return { result, socket };
}

function xhrSend(window, body, url = '/ls_req') {
    const xhr = new window.XMLHttpRequest();
    xhr.open('POST', url);
    const result = xhr.send(body);
    return { result, xhr };
}

function xhrSendAt(window, url, body, method = 'GET') {
    const xhr = new window.XMLHttpRequest();
    xhr.open(method, url);
    const result = xhr.send(body);
    return { result, xhr };
}

function workerOutcome(context, body, transfer) {
    const worker = new context.Worker();
    const result = worker.postMessage(body, transfer);
    return {
        result,
        post: context.workerPosts[context.workerPosts.length - 1],
        postCount: context.workerPosts.length,
        blocked: context.window.__GHOSTIFY_BLOCKED_WORKER_MESSAGES__ || 0,
        sanitized: context.window.__GHOSTIFY_SANITIZED_WORKER_MESSAGES__ || 0,
        sanitizedSeen: context.window.__GHOSTIFY_SANITIZED_SEEN_BRIDGE_MESSAGES__ || 0
    };
}

function portOutcome(context, body, transfer) {
    const port = new context.MessagePort();
    const result = port.postMessage(body, transfer);
    return {
        result,
        post: context.workerPosts[context.workerPosts.length - 1],
        postCount: context.workerPosts.length,
        blocked: context.window.__GHOSTIFY_BLOCKED_WORKER_MESSAGES__ || 0,
        sanitized: context.window.__GHOSTIFY_SANITIZED_WORKER_MESSAGES__ || 0,
        sanitizedSeen: context.window.__GHOSTIFY_SANITIZED_SEEN_BRIDGE_MESSAGES__ || 0
    };
}

function parseForwardedMessage(post) {
    assert.ok(post, 'expected bridge message to be forwarded');
    return typeof post.message === 'string' ? JSON.parse(post.message) : post.message;
}

async function testMessengerSendWatermarkTrafficIsAllowed() {
    const window = makeMessengerPage();

    assert.strictEqual(
        await fetchOutcome(window, messengerSendWithWatermark),
        'allowed',
        'Messenger send-like LS traffic with send_type must not be treated as a read receipt'
    );
    assert.strictEqual(
        websocketOutcome(window, messengerSendWithWatermark),
        'allowed',
        'Messenger send-like WebSocket traffic with send_type must not be dropped'
    );
}

async function testMessengerSendReceiptFlagTrafficIsAllowed() {
    const window = makeMessengerPage();

    assert.strictEqual(
        await fetchOutcome(window, messengerSendWithReadReceiptFlag),
        'allowed',
        'Messenger send-like LS traffic with read-receipt flags must still pass'
    );
    assert.strictEqual(
        websocketOutcome(window, messengerSendWithReadReceiptFlag),
        'allowed',
        'Messenger send-like WebSocket traffic with read-receipt flags must still pass'
    );
}

async function testMessengerBatchedSendTrafficIsAllowed() {
    const window = makeMessengerPage();

    assert.strictEqual(
        await fetchOutcome(window, messengerBatchedSendWithReadReceipt),
        'allowed',
        'Messenger batches containing a real send task must not be dropped wholesale'
    );
    assert.strictEqual(
        websocketOutcome(window, messengerBatchedSendWithReadReceipt),
        'allowed',
        'Messenger WebSocket batches containing a real send task must not be dropped wholesale'
    );
}

async function testMessengerBatchedNetworkTrafficSanitizesPrivacyTasks() {
    const fetchWindow = makeMessengerPage();

    assert.strictEqual(await fetchOutcome(fetchWindow, messengerBatchedSendWithReadReceipt), 'allowed');
    assert.strictEqual(fetchWindow.fetchCalls.length, 1);
    const forwardedFetch = JSON.parse(fetchWindow.fetchCalls[0].init.body);
    assert.deepStrictEqual(
        forwardedFetch.tasks.map(task => task.label),
        ['send_message'],
        'Fetch send batches should preserve the send task and remove bundled read receipts'
    );

    const wsWindow = makeMessengerPage();
    const wsOutcome = websocketSend(wsWindow, messengerBatchedSendWithTyping);
    assert.strictEqual(wsOutcome.result, 'sent');
    assert.strictEqual(wsOutcome.socket.sent.length, 1);
    const forwardedWebSocket = JSON.parse(wsOutcome.socket.sent[0]);
    assert.deepStrictEqual(
        forwardedWebSocket.tasks.map(task => task.label),
        ['send_message'],
        'WebSocket send batches should preserve the send task and remove bundled typing updates'
    );

    const xhrWindow = makeMessengerPage();
    const xhrOutcome = xhrSend(xhrWindow, messengerBatchedSendWithReadReceipt);
    assert.strictEqual(xhrOutcome.result, 'sent');
    const forwardedXhr = JSON.parse(xhrOutcome.xhr.sent);
    assert.deepStrictEqual(
        forwardedXhr.tasks.map(task => task.label),
        ['send_message'],
        'XHR send batches should preserve the send task and remove bundled read receipts'
    );

    const requestWindow = makeMessengerPage();
    assert.strictEqual(await fetchRequestOutcome(requestWindow, messengerBatchedSendWithReadReceipt), 'allowed');
    assert.strictEqual(requestWindow.fetchCalls.length, 1);
    const forwardedRequest = requestWindow.fetchCalls[0].input;
    assert.ok(forwardedRequest instanceof requestWindow.Request);
    assert.deepStrictEqual(
        JSON.parse(forwardedRequest.body).tasks.map(task => task.label),
        ['send_message'],
        'Fetch Request bodies should be replayed with bundled read receipts removed'
    );

    const encodedWindow = makeMessengerPage();
    assert.strictEqual(await fetchOutcome(encodedWindow, messengerFormEncodedBatchedSendWithReadReceipt), 'allowed');
    assert.strictEqual(encodedWindow.fetchCalls.length, 1);
    const forwardedParams = new URLSearchParams(encodedWindow.fetchCalls[0].init.body);
    assert.strictEqual(forwardedParams.get('epoch_id'), 'redacted-epoch');
    const forwardedPayload = JSON.parse(forwardedParams.get('payload'));
    assert.deepStrictEqual(
        forwardedPayload.tasks.map(task => task.label),
        ['send_message'],
        'URL-encoded LS payload JSON should preserve sends and remove bundled read receipts'
    );

    const paramsWindow = makeMessengerPage();
    const paramsBody = new paramsWindow.URLSearchParams();
    paramsBody.set('payload', messengerBatchedSendWithReadReceipt);
    paramsBody.set('epoch_id', 'redacted-epoch');
    assert.strictEqual(await fetchOutcome(paramsWindow, paramsBody), 'allowed');
    assert.strictEqual(paramsWindow.fetchCalls.length, 1);
    const forwardedUrlSearchParams = paramsWindow.fetchCalls[0].init.body;
    assert.ok(forwardedUrlSearchParams instanceof paramsWindow.URLSearchParams);
    assert.strictEqual(forwardedUrlSearchParams.get('epoch_id'), 'redacted-epoch');
    assert.deepStrictEqual(
        JSON.parse(forwardedUrlSearchParams.get('payload')).tasks.map(task => task.label),
        ['send_message'],
        'URLSearchParams LS payload JSON should preserve sends and remove bundled read receipts'
    );

    const separateParamsWindow = makeMessengerPage();
    const separateParamsBody = new separateParamsWindow.URLSearchParams();
    separateParamsBody.set('send', messengerSendWithWatermark);
    separateParamsBody.set('seen', messengerReadReceipt);
    separateParamsBody.set('epoch_id', 'redacted-epoch');
    assert.strictEqual(await fetchOutcome(separateParamsWindow, separateParamsBody), 'allowed');
    const forwardedSeparateParams = separateParamsWindow.fetchCalls[0].init.body;
    assert.ok(forwardedSeparateParams instanceof separateParamsWindow.URLSearchParams);
    assert.strictEqual(forwardedSeparateParams.has('seen'), false);
    assert.strictEqual(forwardedSeparateParams.has('send'), true);
    assert.strictEqual(forwardedSeparateParams.get('epoch_id'), 'redacted-epoch');

    const standaloneSeenParamsWindow = makeMessengerPage();
    const standaloneSeenParams = new standaloneSeenParamsWindow.URLSearchParams();
    standaloneSeenParams.set('seen', messengerReadReceipt);
    standaloneSeenParams.set('epoch_id', 'redacted-epoch');
    assert.strictEqual(await fetchOutcome(standaloneSeenParamsWindow, standaloneSeenParams), 'MSG_SEEN');
    assert.strictEqual(standaloneSeenParamsWindow.fetchCalls.length, 0);
}

async function testRapidMessengerSendsWithPrivacyMarkersAreAllowed() {
    const window = makeMessengerPage();
    const socket = new window.WebSocket('wss://edge-chat.messenger.com/chat?region=redacted');

    for (let index = 0; index < 12; index += 1) {
        const payload = JSON.stringify({
            issue_new_task: true,
            tasks: [{
                label: 'send_message',
                queue_name: 'messenger_send_message',
                payload: {
                    thread_key: { thread_fbid: 'redacted-thread' },
                    send_type: 1,
                    offline_threading_id: `redacted-offline-id-${index}`,
                    message: { text: `<redacted-user-text-${index}>` },
                    last_read_watermark_ts: 1779530000000 + index,
                    shouldSendReadReceipt: index % 2 === 0 ? false : undefined
                }
            }]
        });

        assert.strictEqual(await fetchOutcome(window, payload), 'allowed');
        assert.strictEqual(socket.send(payload), 'sent');
    }

    assert.strictEqual(window.fetchCalls.length, 12);
    assert.strictEqual(socket.sent.length, 12);
}

async function testMessengerSendUserTextPrivacyTermsAreAllowed() {
    const window = makeMessengerPage();

    assert.strictEqual(
        await fetchOutcome(window, messengerSendWithUserAuthoredPrivacyTerms),
        'allowed',
        'User-authored message text must not trigger Messenger privacy blockers'
    );
    assert.strictEqual(
        websocketOutcome(window, messengerSendWithUserAuthoredPrivacyTerms),
        'allowed',
        'User-authored message text must not drop Messenger WebSocket sends'
    );
}

async function testMessengerDeliveryWatermarkTrafficIsAllowed() {
    const window = makeMessengerPage();

    assert.strictEqual(
        await fetchOutcome(window, messengerDeliveryWithWatermark),
        'allowed',
        'Messenger delivery acknowledgements with watermarks must not be treated as seen receipts'
    );
    assert.strictEqual(
        websocketOutcome(window, messengerDeliveryWithWatermark),
        'allowed',
        'Messenger edge-chat delivery acknowledgements with watermarks must pass'
    );
    assert.strictEqual(
        websocketOutcome(window, messengerDeliveryWithWatermark, 'wss://www.messenger.com/ws/streamcontroller'),
        'allowed',
        'Messenger streamcontroller delivery acknowledgements with watermarks must pass'
    );
    assert.strictEqual(
        await fetchOutcome(window, messengerReadOnlySeenViewerFalseMetadata),
        'allowed',
        'Messenger read-only metadata with seen_by_viewer=false must not be treated as a seen write'
    );
    assert.strictEqual(
        websocketOutcome(window, messengerReadOnlySeenViewerFalseMetadata),
        'allowed',
        'Messenger WebSocket read-only metadata with seen_by_viewer=false must pass'
    );
    assert.strictEqual(
        await fetchOutcomeAt(window, '/ls_req', messengerEncodedReadOnlySeenViewerFalseMetadata),
        'allowed',
        'URL-encoded read-only metadata with seen_by_viewer=false must not be treated as a seen write'
    );
}

function testMessengerPatchMixedSendTypingBatchPreservesSend() {
    const context = makeMessengerPatchPage();
    const outcome = workerOutcome(context, JSON.parse(messengerBatchedSendWithTyping));

    assert.strictEqual(outcome.result, 'worker-sent');
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);

    const forwarded = parseForwardedMessage(outcome.post);
    assert.strictEqual(forwarded.tasks.length, 1);
    assert.strictEqual(forwarded.tasks[0].label, 'send_message');

    const portContext = makeMessengerPatchPage();
    const portResult = portOutcome(portContext, JSON.parse(messengerBatchedSendUserTextWithTyping));
    assert.strictEqual(portResult.result, 'port-sent');
    assert.strictEqual(portResult.postCount, 1);
    assert.strictEqual(portResult.blocked, 0);

    const forwardedPortMessage = parseForwardedMessage(portResult.post);
    assert.strictEqual(forwardedPortMessage.tasks.length, 1);
    assert.strictEqual(forwardedPortMessage.tasks[0].label, 'send_message');
    assert.strictEqual(forwardedPortMessage.tasks[0].payload.message.text, 'typing_indicator mark_read read_receipt');
}

function testMessengerPatchMixedSendReadStringBatchPreservesSend() {
    const context = makeMessengerPatchPage();
    const outcome = workerOutcome(context, messengerBatchedSendWithReadReceipt);

    assert.strictEqual(outcome.result, 'worker-sent');
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);

    const forwarded = parseForwardedMessage(outcome.post);
    assert.strictEqual(forwarded.tasks.length, 1);
    assert.strictEqual(forwarded.tasks[0].label, 'send_message');
}

function testMessengerPatchObjectMapBatchSanitizesPrivacyTasks() {
    const context = makeMessengerPatchPage();
    const message = {
        send: JSON.parse(messengerSendWithUserAuthoredPrivacyTerms).tasks[0],
        seen: JSON.parse(messengerReadReceipt).tasks[0],
        epoch_id: 'redacted-epoch'
    };
    const outcome = workerOutcome(context, message);

    assert.strictEqual(outcome.result, 'worker-sent');
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);

    const forwarded = parseForwardedMessage(outcome.post);
    assert.strictEqual(forwarded.send.label, 'send_message');
    assert.strictEqual(forwarded.send.payload.message.text, 'mark_read reel_seen typing_indicator delivery_receipt');
    assert.strictEqual(forwarded.seen, undefined);
    assert.strictEqual(forwarded.epoch_id, 'redacted-epoch');
}

function testMessengerPatchSendWithTransferIsForwarded() {
    const context = makeMessengerPatchPage();
    const transfer = [new ArrayBuffer(8)];
    const outcome = workerOutcome(context, JSON.parse(messengerSendWithReadReceiptFlag), transfer);

    assert.strictEqual(outcome.result, 'worker-sent');
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);
    assert.strictEqual(outcome.post.transfer, transfer);
}

function testMessengerPatchMixedTransferBatchesSanitizePrivacyTasks() {
    const typingContext = makeMessengerPatchPage();
    const typingTransfer = [new ArrayBuffer(8)];
    const typingOutcome = workerOutcome(typingContext, JSON.parse(messengerBatchedSendWithTyping), typingTransfer);

    assert.strictEqual(typingOutcome.result, 'worker-sent');
    assert.strictEqual(typingOutcome.postCount, 1);
    assert.strictEqual(typingOutcome.blocked, 0);
    assert.strictEqual(typingOutcome.post.transfer, undefined);

    const forwardedTyping = parseForwardedMessage(typingOutcome.post);
    assert.strictEqual(forwardedTyping.tasks.length, 1);
    assert.strictEqual(forwardedTyping.tasks[0].label, 'send_message');

    const seenContext = makeMessengerPatchPage();
    const seenTransfer = [new ArrayBuffer(8)];
    const seenOutcome = workerOutcome(seenContext, messengerBatchedSendWithReadReceipt, seenTransfer);

    assert.strictEqual(seenOutcome.result, 'worker-sent');
    assert.strictEqual(seenOutcome.postCount, 1);
    assert.strictEqual(seenOutcome.blocked, 0);
    assert.strictEqual(seenOutcome.post.transfer, undefined);

    const forwardedSeen = parseForwardedMessage(seenOutcome.post);
    assert.strictEqual(forwardedSeen.tasks.length, 1);
    assert.strictEqual(forwardedSeen.tasks[0].label, 'send_message');
}

function testMessengerPatchReferencedSendTransferIsPreserved() {
    const context = makeMessengerPatchPage();
    const attachmentBuffer = new ArrayBuffer(8);
    const message = JSON.parse(messengerBatchedSendWithTyping);
    message.tasks[0].payload.attachment = attachmentBuffer;

    const outcome = workerOutcome(context, message, [attachmentBuffer]);

    assert.strictEqual(outcome.result, 'worker-sent');
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);
    assert.strictEqual(outcome.post.transfer.length, 1);
    assert.strictEqual(outcome.post.transfer[0], attachmentBuffer);

    const forwarded = parseForwardedMessage(outcome.post);
    assert.strictEqual(forwarded.tasks.length, 1);
    assert.strictEqual(forwarded.tasks[0].label, 'send_message');
    assert.strictEqual(forwarded.tasks[0].payload.attachment, attachmentBuffer);
}

async function testMessengerTypingAndSeenProtectionsStillBlock() {
    const window = makeMessengerPage();

    assert.strictEqual(await fetchOutcome(window, messengerTyping), 'MSG_TYPING');
    assert.strictEqual(websocketOutcome(window, messengerTyping), 'blocked');
    assert.strictEqual(await fetchOutcome(window, messengerReadReceipt), 'MSG_SEEN');
    assert.strictEqual(websocketOutcome(window, messengerReadReceipt), 'blocked');
    assert.strictEqual(await fetchOutcome(window, messengerReadReceiptWithDeliveryMarker), 'MSG_SEEN');
    assert.strictEqual(websocketOutcome(window, messengerReadReceiptWithDeliveryMarker), 'blocked');
}

function testMessengerPatchPurePrivacyTrafficStillBlocks() {
    const typingContext = makeMessengerPatchPage();
    const typingOutcome = workerOutcome(typingContext, JSON.parse(messengerTyping));
    assert.strictEqual(typingOutcome.result, undefined);
    assert.strictEqual(typingOutcome.postCount, 0);
    assert.strictEqual(typingOutcome.blocked, 1);

    const seenContext = makeMessengerPatchPage();
    const seenOutcome = workerOutcome(seenContext, messengerReadReceipt);
    assert.strictEqual(seenOutcome.result, undefined);
    assert.strictEqual(seenOutcome.postCount, 0);
    assert.strictEqual(seenOutcome.blocked, 1);
}

async function testMessengerTogglesDisableProtections() {
    const window = makeMessengerPage({
        msgSeen: false,
        msgTyping: false
    });

    assert.strictEqual(await fetchOutcome(window, messengerSendWithWatermark), 'allowed');
    assert.strictEqual(await fetchOutcome(window, messengerSendWithReadReceiptFlag), 'allowed');
    assert.strictEqual(await fetchOutcome(window, messengerBatchedSendWithReadReceipt), 'allowed');
    assert.strictEqual(await fetchOutcome(window, messengerSendWithUserAuthoredPrivacyTerms), 'allowed');
    assert.strictEqual(await fetchOutcome(window, messengerDeliveryWithWatermark), 'allowed');
    assert.strictEqual(await fetchOutcome(window, messengerTyping), 'allowed');
    assert.strictEqual(await fetchOutcome(window, messengerReadReceipt), 'allowed');
    assert.strictEqual(websocketOutcome(window, messengerTyping), 'allowed');
    assert.strictEqual(websocketOutcome(window, messengerReadReceipt), 'allowed');

    const bridgeContext = makeMessengerPatchPage({
        msgSeen: false,
        msgTyping: false
    });
    assert.strictEqual(workerOutcome(bridgeContext, JSON.parse(messengerTyping)).result, 'worker-sent');
    assert.strictEqual(workerOutcome(bridgeContext, messengerReadReceipt).result, 'worker-sent');
}

async function testMessageRequestsAndInboxQueriesAreAllowed() {
    const messengerWindow = makeGhostPage({
        hostname: 'www.messenger.com',
        pathname: '/requests/t/redacted-thread',
        href: 'https://www.messenger.com/requests/t/redacted-thread'
    });
    assert.strictEqual(
        await fetchOutcomeAt(messengerWindow, '/api/graphql/', messengerMessageRequestsQuery),
        'allowed',
        'Messenger message-request GraphQL queries must not be replaced with empty JSON'
    );

    const facebookWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/messages/requests',
        href: 'https://www.facebook.com/messages/requests'
    });
    assert.strictEqual(
        await fetchOutcomeAt(facebookWindow, '/api/graphql/', messengerMessageRequestsQuery),
        'allowed',
        'Facebook message-request GraphQL queries must not be treated as read receipts'
    );

    const facebookProxyWindow = makeGhostPage({
        hostname: 'www.fbsbx.com',
        pathname: '/maw_proxy_page/',
        search: '?__cci=redacted',
        href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
    });
    assert.strictEqual(
        await fetchOutcomeAt(facebookProxyWindow, '/api/graphql/', messengerMessageRequestsQuery),
        'allowed',
        'Facebook MAW proxy message-request GraphQL queries must not be treated as read receipts'
    );

    assert.strictEqual(
        await fetchOutcome(messengerWindow, lsMessageRequestThreadListLoad),
        'allowed',
        'Messenger.com LS message-request thread-list loads must not be treated as read receipts'
    );
    assert.strictEqual(
        websocketOutcome(messengerWindow, lsMessageRequestThreadListLoad),
        'allowed',
        'Messenger.com WebSocket message-request thread-list loads must not be dropped'
    );
    assert.strictEqual(
        xhrSend(messengerWindow, lsMessageRequestThreadListLoad).result,
        'sent',
        'Messenger.com XHR message-request thread-list loads must not be replaced with synthetic JSON'
    );

    assert.strictEqual(
        await fetchOutcome(messengerWindow, lsMessageRequestLoadWithFalseReceiptFlag),
        'allowed',
        'Messenger.com message-request loads with should_send_read_receipt=false must stay allowed'
    );
    assert.strictEqual(
        websocketOutcome(messengerWindow, lsMessageRequestLoadWithFalseReceiptFlag),
        'allowed',
        'Messenger.com WebSocket message-request loads with should_send_read_receipt=false must stay allowed'
    );

    assert.strictEqual(
        await fetchOutcomeAt(messengerWindow, '/api/graphql/', messageRequestRoutePreloadMutationShape),
        'allowed',
        'Messenger.com message-request route preload mutation-shaped loads must stay allowed'
    );
    assert.strictEqual(
        await fetchOutcomeAt(facebookWindow, '/api/graphql/', messageRequestRoutePreloadMutationShape),
        'allowed',
        'Facebook message-request route preload mutation-shaped loads must stay allowed'
    );

    assert.strictEqual(
        await fetchOutcome(messengerWindow, lsPendingThreadsRequestLoad),
        'allowed',
        'Messenger.com pending_threads request loads must not be treated as read receipts'
    );
    assert.strictEqual(
        websocketOutcome(messengerWindow, lsPendingThreadsRequestLoad),
        'allowed',
        'Messenger.com WebSocket pending_threads request loads must not be dropped'
    );
    assert.strictEqual(
        xhrSend(messengerWindow, lsPendingThreadsRequestLoad).result,
        'sent',
        'Messenger.com XHR pending_threads request loads must not be replaced with synthetic JSON'
    );
    assert.strictEqual(
        await fetchOutcome(messengerWindow, lsSpamThreadsRequestLoad),
        'allowed',
        'Messenger.com spam_threads request loads with false receipt flags must stay allowed'
    );
    assert.strictEqual(
        await fetchOutcomeAt(messengerWindow, '/api/graphql/', pendingThreadsRoutePreloadMutationShape),
        'allowed',
        'Messenger.com pending_threads route preload mutation-shaped loads must stay allowed'
    );
    assert.strictEqual(
        await fetchOutcomeAt(facebookWindow, '/api/graphql/', pendingThreadsRoutePreloadMutationShape),
        'allowed',
        'Facebook pending_threads route preload mutation-shaped loads must stay allowed'
    );

    const patchContext = makeMessengerPatchPage();
    const workerResult = workerOutcome(patchContext, JSON.parse(lsMessageRequestLoadWithFalseReceiptFlag));
    assert.strictEqual(
        workerResult.result,
        'worker-sent',
        'Messenger patch worker bridge must forward message-request loads with should_send_read_receipt=false'
    );
    assert.strictEqual(workerResult.blocked, 0);
    const portResult = portOutcome(patchContext, JSON.parse(lsMessageRequestThreadListLoad));
    assert.strictEqual(
        portResult.result,
        'port-sent',
        'Messenger patch MessagePort bridge must forward message-request thread-list loads'
    );
    assert.strictEqual(portResult.blocked, 0);

    const pendingWorkerResult = workerOutcome(patchContext, JSON.parse(lsPendingThreadsRequestLoad));
    assert.strictEqual(
        pendingWorkerResult.result,
        'worker-sent',
        'Messenger patch worker bridge must forward pending_threads request loads'
    );
    assert.strictEqual(pendingWorkerResult.blocked, 0);
    const spamPortResult = portOutcome(patchContext, JSON.parse(lsSpamThreadsRequestLoad));
    assert.strictEqual(
        spamPortResult.result,
        'port-sent',
        'Messenger patch MessagePort bridge must forward spam_threads request loads'
    );
    assert.strictEqual(spamPortResult.blocked, 0);
}

function testMessengerPatchRequestRouteModulesHydrateUntouched() {
    for (const page of [
        {
            label: 'Messenger.com',
            hostname: 'www.messenger.com',
            pathname: '/requests/t/redacted-thread',
            href: 'https://www.messenger.com/requests/t/redacted-thread'
        },
        {
            label: 'Facebook',
            hostname: 'www.facebook.com',
            pathname: '/messages/requests/t/redacted-thread',
            href: 'https://www.facebook.com/messages/requests/t/redacted-thread'
        },
        {
            label: 'Facebook MAW proxy',
            hostname: 'www.fbsbx.com',
            pathname: '/maw_proxy_page/',
            search: '?__cci=redacted',
            href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
        }
    ]) {
        const context = makeMessengerPatchPage({}, page);
        const calls = [];
        const module = registerMessengerModule(
            context,
            'LSUpdateThreadReadWatermark',
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function (payload) {
                    calls.push(payload);
                    return 'request-hydrated';
                };
            }
        );
        const requestHydrationPayload = {
            folder: 'pending_threads',
            thread_key: { thread_fbid: 'redacted-thread' },
            last_read_watermark: 1779530000000,
            should_send_read_receipt: false
        };

        assert.strictEqual(module.exports.default(requestHydrationPayload), 'request-hydrated');
        assert.strictEqual(calls.length, 1, `${page.label} request modules must call the original hydrator`);
        assert.strictEqual(
            calls[0],
            requestHydrationPayload,
            `${page.label} request modules must not receive cloned/sanitized request payloads`
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
            0,
            `${page.label} request module hydration must not increment read-export sanitization`
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
            0,
            `${page.label} request module hydration must not be blocked`
        );
    }

    const normalContext = makeMessengerPatchPage();
    const blockedCalls = [];
    const readReceiptModule = registerMessengerModule(
        normalContext,
        'LSSendReadReceipt',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.sendReadReceipt = function (payload) {
                blockedCalls.push(payload);
                return 'sent';
            };
        }
    );
    assert.strictEqual(
        readReceiptModule.exports.sendReadReceipt({
            thread_key: { thread_fbid: 'redacted-thread' },
            sendReadReceipt: true
        }),
        undefined,
        'normal Messenger thread read-receipt modules must still be blocked'
    );
    assert.strictEqual(blockedCalls.length, 0);
    assert.strictEqual(normalContext.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 1);
    assert(normalContext.window.__GHOSTIFY_STATUS__?.hooks?.['module_interceptor.hooked']);
}

function testMessengerPatchLocalReadModulesStayUntouchedAfterRequestSpaNavigation() {
    for (const page of [
        {
            label: 'Messenger.com',
            hostname: 'www.messenger.com',
            normalPathname: '/t/redacted-thread',
            normalHref: 'https://www.messenger.com/t/redacted-thread',
            requestPathname: '/requests/t/redacted-thread',
            requestHref: 'https://www.messenger.com/requests/t/redacted-thread'
        },
        {
            label: 'Facebook',
            hostname: 'www.facebook.com',
            normalPathname: '/messages/t/redacted-thread',
            normalHref: 'https://www.facebook.com/messages/t/redacted-thread',
            requestPathname: '/messages/requests/t/redacted-thread',
            requestHref: 'https://www.facebook.com/messages/requests/t/redacted-thread'
        }
    ]) {
        const context = makeMessengerPatchPage({}, {
            hostname: page.hostname,
            pathname: page.normalPathname,
            href: page.normalHref
        });
        const calls = [];
        const module = registerMessengerModule(
            context,
            'LSUpdateThreadReadWatermark',
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function (payload) {
                    calls.push(payload);
                    return 'request-hydrated';
                };
            }
        );
        const requestHydrationPayload = {
            folder: 'message_requests',
            thread_key: { thread_fbid: 'redacted-thread' },
            cursor: 'redacted-cursor',
            sendReadReceipt: true,
            readReceiptMutation: { should_send_read_receipt: true }
        };

        assert.strictEqual(module.exports.default(requestHydrationPayload), 'request-hydrated');
        assert.strictEqual(calls.length, 1, `${page.label} request hydration must pass before the URL route settles`);
        assert.strictEqual(
            calls[0],
            requestHydrationPayload,
            `${page.label} request hydration payloads must stay intact before the URL route settles`
        );

        context.window.location.pathname = page.requestPathname;
        context.window.location.href = page.requestHref;

        assert.strictEqual(module.exports.default(requestHydrationPayload), 'request-hydrated');
        assert.strictEqual(calls.length, 2, `${page.label} stale local read modules must still call the original hydrator`);
        assert.strictEqual(
            calls[1],
            requestHydrationPayload,
            `${page.label} stale local read modules must not sanitize request hydration after SPA navigation`
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
            0,
            `${page.label} stale local read modules must not increment sanitization after SPA navigation`
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
            0,
            `${page.label} stale local read modules must not block request hydration after SPA navigation`
        );
    }
}

function testFacebookNormalThreadLocalReadModulesAreSanitized() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/messages/t/redacted-thread',
        href: 'https://www.facebook.com/messages/t/redacted-thread'
    });
    const calls = [];
    const module = registerMessengerModule(
        context,
        'LSUpdateThreadReadWatermark',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (payload) {
                calls.push(payload);
                return 'read-updated';
            };
        }
    );
    const normalReadPayload = {
        thread_key: { thread_fbid: 'redacted-thread' },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
        readReceiptMutation: { should_send_read_receipt: true }
    };

    assert.strictEqual(module.exports.default(normalReadPayload), 'read-updated');
    assert.strictEqual(calls.length, 1);
    assert.notStrictEqual(
        calls[0],
        normalReadPayload,
        'Facebook normal message-thread local read modules must receive a sanitized clone'
    );
    assert.strictEqual(calls[0].should_send_read_receipt, false);
    assert.strictEqual(calls[0].readReceiptMutation, null);
    assert.strictEqual(
        context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
        1,
        'Facebook normal message-thread local read modules must increment sanitization'
    );
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 0);
}

function testFacebookMawProxyLocalReadModulesAreSanitized() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.fbsbx.com',
        pathname: '/maw_proxy_page/',
        search: '?__cci=redacted',
        href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
    });
    const calls = [];
    const module = registerMessengerModule(
        context,
        'LSUpdateThreadReadWatermark',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (payload) {
                calls.push(payload);
                return 'proxy-read-updated';
            };
        }
    );
    const normalReadPayload = {
        thread_key: { thread_fbid: 'redacted-thread' },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
        readReceiptMutation: { should_send_read_receipt: true }
    };

    assert.strictEqual(module.exports.default(normalReadPayload), 'proxy-read-updated');
    assert.strictEqual(calls.length, 1);
    assert.notStrictEqual(
        calls[0],
        normalReadPayload,
        'Facebook MAW proxy local read modules must receive a sanitized clone'
    );
    assert.strictEqual(calls[0].should_send_read_receipt, false);
    assert.strictEqual(calls[0].readReceiptMutation, null);
    assert.strictEqual(
        context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
        1,
        'Facebook MAW proxy local read modules must increment sanitization'
    );
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 0);
}

async function testFacebookMawProxyNetworkReadReceiptsAreBlocked() {
    const window = makeGhostPage({
        hostname: 'www.fbsbx.com',
        pathname: '/maw_proxy_page/',
        search: '?__cci=redacted',
        href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
    });

    assert.strictEqual(
        await fetchOutcome(window, messengerReadReceipt),
        'MSG_SEEN',
        'Facebook MAW proxy fetch read-receipt writes must be blocked'
    );
    assert.strictEqual(
        websocketOutcome(window, messengerReadReceipt),
        'blocked',
        'Facebook MAW proxy WebSocket read-receipt writes must be blocked'
    );
}

function testNonMawFbsbxPagesAreNotTreatedAsMessenger() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.fbsbx.com',
        pathname: '/cdn/redacted',
        href: 'https://www.fbsbx.com/cdn/redacted'
    });
    const calls = [];
    const module = registerMessengerModule(
        context,
        'LSUpdateThreadReadWatermark',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (payload) {
                calls.push(payload);
                return 'non-maw-read-updated';
            };
        }
    );
    const payload = {
        thread_key: { thread_fbid: 'redacted-thread' },
        should_send_read_receipt: true,
        readReceiptMutation: { should_send_read_receipt: true }
    };

    assert.strictEqual(module.exports.default(payload), 'non-maw-read-updated');
    assert.strictEqual(calls[0], payload, 'non-MAW fbsbx pages must not get Messenger module patching');

    const window = makeGhostPage({
        hostname: 'www.fbsbx.com',
        pathname: '/cdn/redacted',
        href: 'https://www.fbsbx.com/cdn/redacted'
    });
    assert.strictEqual(
        window.document.hasFocus(),
        true,
        'non-MAW fbsbx pages must not get Messenger focus spoofing'
    );
}

function testManifestInjectsIntoFacebookMawProxyFrames() {
    const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'));
    const proxyMatch = 'https://www.fbsbx.com/*';

    assert(
        manifest.host_permissions.includes(proxyMatch),
        'manifest host_permissions must include Facebook MAW proxy frames'
    );

    for (const script of ['js/content.js', 'js/messenger_patch.js', 'js/ghost.js']) {
        const entry = manifest.content_scripts.find(candidate => candidate.js.includes(script));
        assert(entry, `manifest must include content_script entry for ${script}`);
        assert(
            entry.matches.includes(proxyMatch),
            `${script} must inject into Facebook MAW proxy frames`
        );
    }

    const resources = manifest.web_accessible_resources || [];
    assert(
        resources.some(entry => (entry.matches || []).includes(proxyMatch)),
        'web_accessible_resources must allow config reads from Facebook MAW proxy frames'
    );
}

function testMessengerPatchRequestRouteExplicitModulesStayProtected() {
    const requestContext = makeMessengerPatchPage({}, {
        hostname: 'www.messenger.com',
        pathname: '/requests/t/redacted-thread',
        href: 'https://www.messenger.com/requests/t/redacted-thread'
    });
    const requestCalls = [];
    const requestRouteModule = registerMessengerModule(
        requestContext,
        'LSSendReadReceipt',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.sendReadReceipt = function (payload) {
                requestCalls.push(payload);
                return 'sent';
            };
        }
    );

    assert.strictEqual(
        requestRouteModule.exports.sendReadReceipt({
            thread_key: { thread_fbid: 'redacted-thread' },
            sendReadReceipt: true
        }),
        undefined,
        'explicit read-receipt modules must still block on request routes'
    );
    assert.strictEqual(requestCalls.length, 0);
    assert.strictEqual(requestContext.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 1);

    requestContext.window.location.pathname = '/t/redacted-thread';
    requestContext.window.location.href = 'https://www.messenger.com/t/redacted-thread';
    assert.strictEqual(
        requestRouteModule.exports.sendReadReceipt({
            thread_key: { thread_fbid: 'redacted-thread' },
            sendReadReceipt: true
        }),
        undefined,
        'explicit read-receipt modules first registered on request routes must stay protected after SPA navigation'
    );
    assert.strictEqual(requestCalls.length, 0);
    assert.strictEqual(requestContext.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 2);
    assert(requestContext.window.__GHOSTIFY_STATUS__?.hooks?.['module_interceptor.hooked']);
}

async function testVideoAdAndMediaTrafficIsAllowed() {
    const facebookWatchWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/watch',
        href: 'https://www.facebook.com/watch'
    });

    assert.strictEqual(
        await fetchOutcomeAt(facebookWatchWindow, '/api/graphql/', facebookVideoAdGraphQL),
        'allowed',
        'Facebook video/ad player GraphQL must not be swallowed as typing or seen traffic'
    );

    assert.strictEqual(
        await fetchOutcomeAt(facebookWatchWindow, '/api/graphql/', facebookVideoAdGraphQLWithFalsePrivacyFields),
        'allowed',
        'Facebook video/ad player GraphQL with falsey privacy-looking fields must not be swallowed'
    );
    assert.strictEqual(
        facebookWatchWindow.navigator.sendBeacon('/api/graphql/', facebookVideoAdGraphQLWithFalsePrivacyFields),
        'beacon',
        'Facebook video/ad sendBeacon telemetry with falsey privacy-looking fields must not be swallowed'
    );
    assert.strictEqual(facebookWatchWindow.beaconCalls.length, 1);

    const facebookWatchPatchContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/watch',
        href: 'https://www.facebook.com/watch'
    });
    const playerWorkerResult = workerOutcome(
        facebookWatchPatchContext,
        facebookVideoAdWorkerMessageWithFalsePrivacyFields
    );
    assert.strictEqual(
        playerWorkerResult.result,
        'worker-sent',
        'Facebook video/ad worker messages with falsey privacy-looking fields must not be dropped'
    );
    assert.strictEqual(playerWorkerResult.blocked, 0);

    const encodedPlayerWorkerResult = workerOutcome(
        facebookWatchPatchContext,
        `variables=${encodeURIComponent(JSON.stringify(facebookVideoAdWorkerMessageWithFalsePrivacyFields))}`
    );
    assert.strictEqual(
        encodedPlayerWorkerResult.result,
        'worker-sent',
        'Facebook video/ad worker strings with URL-encoded falsey privacy-looking fields must not be dropped'
    );
    assert.strictEqual(encodedPlayerWorkerResult.blocked, 0);

    assert.strictEqual(
        await fetchOutcomeAt(
            facebookWatchWindow,
            'https://video.xx.fbcdn.net/redacted/manifest.m3u8?mark_seen=1&typing_indicator=0',
            '',
            'GET'
        ),
        'allowed',
        'Facebook media manifests must bypass privacy pattern matching'
    );

    assert.strictEqual(
        await fetchRequestOutcomeAt(
            facebookWatchWindow,
            'https://video.xx.fbcdn.net/redacted/manifest.m3u8?mark_seen=1&typing_indicator=0'
        ),
        'allowed',
        'Facebook media manifest Request objects must bypass privacy pattern matching'
    );
    assert.strictEqual(
        xhrSendAt(
            facebookWatchWindow,
            'https://video.xx.fbcdn.net/redacted/manifest.m3u8?mark_seen=1&typing_indicator=0'
        ).result,
        'sent',
        'Facebook media manifest XHR loads must bypass privacy pattern matching'
    );

    assert.strictEqual(
        await fetchOutcomeAt(
            facebookWatchWindow,
            'https://video.xx.fbcdn.net/redacted/manifest.m3u8',
            facebookVideoReadWatermarkMutation
        ),
        'blocked',
        'POST bodies to media-looking URLs must still pass through privacy-write detection'
    );
    assert.strictEqual(
        facebookWatchWindow.navigator.sendBeacon('/api/graphql/', facebookVideoReadWatermarkMutation),
        true,
        'Beacon read-watermark writes must still be swallowed'
    );
    assert.strictEqual(
        facebookWatchWindow.beaconCalls.length,
        1,
        'Blocked beacon writes must not reach the original beacon transport'
    );

    const instagramWindow = makeGhostPage({
        hostname: 'www.instagram.com',
        pathname: '/reels/redacted/',
        href: 'https://www.instagram.com/reels/redacted/'
    });

    assert.strictEqual(
        await fetchOutcomeAt(instagramWindow, '/api/graphql/', instagramReelsMediaGraphQL),
        'allowed',
        'Instagram reels/media GraphQL must not be swallowed as story seen traffic'
    );
}

async function testPrivacyWritesStillBlockWithRequestOrMediaContext() {
    const facebookMessagesWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/messages/requests',
        href: 'https://www.facebook.com/messages/requests'
    });

    assert.strictEqual(
        await fetchOutcomeAt(facebookMessagesWindow, '/api/graphql/', messageRequestReadWatermarkMutation),
        'blocked',
        'Message-request read-watermark mutations must still be blocked'
    );

    assert.strictEqual(
        await fetchOutcomeAt(facebookMessagesWindow, '/api/graphql/', messageRequestReadWatermarkOperationMutation),
        'blocked',
        'Message-request read-watermark mutations with operationName JSON must still be blocked'
    );

    assert.strictEqual(
        await fetchOutcomeAt(facebookMessagesWindow, '/api/graphql/', messageRequestReadWatermarkDocIdWrite),
        'blocked',
        'Doc-id-only message-request read-watermark writes must not be treated as read-only request queries'
    );

    assert.strictEqual(
        await fetchOutcomeAt(facebookMessagesWindow, '/api/graphql/', messageRequestReadReceiptDocIdWrite),
        'blocked',
        'Doc-id-only message-request read_receipt writes must not be treated as read-only request queries'
    );

    assert.strictEqual(
        await fetchOutcomeAt(facebookMessagesWindow, '/api/graphql/', messageRequestMarkReadDocIdWrite),
        'blocked',
        'Doc-id-only message-request mark_read writes must not be treated as read-only request queries'
    );

    const facebookWatchWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/watch',
        href: 'https://www.facebook.com/watch'
    });

    assert.strictEqual(
        await fetchOutcomeAt(facebookWatchWindow, '/api/graphql/', facebookVideoReadWatermarkMutation),
        'blocked',
        'Media/player fields must not allow real Messenger read-watermark writes'
    );

    assert.strictEqual(
        await fetchOutcomeAt(
            facebookWatchWindow,
            'https://scontent.xx.fbcdn.net/graphql',
            facebookVideoReadWatermarkMutation
        ),
        'blocked',
        'Non-GET CDN-like URLs must not bypass privacy-write detection'
    );

    const instagramWindow = makeGhostPage({
        hostname: 'www.instagram.com',
        pathname: '/stories/redacted/',
        href: 'https://www.instagram.com/stories/redacted/'
    });

    assert.strictEqual(
        await fetchOutcomeAt(instagramWindow, '/api/graphql/', instagramStorySeenGraphQLWithDocId),
        'blocked',
        'Instagram doc_id GraphQL story seen writes must not bypass fallback privacy matching'
    );

    assert.strictEqual(
        await fetchOutcomeAt(instagramWindow, '/api/graphql/', instagramStorySeenMediaGraphQLWithDocId),
        'blocked',
        'Instagram story seen writes with media fields must not bypass through media/player allowlisting'
    );
}

function testFacebookWatchDoesNotSpoofFocus() {
    const cases = [
        ['www.facebook.com', '/watch', true, 'Facebook Watch/video surfaces must keep native focus so ads and players can progress'],
        ['www.facebook.com', '/', true, 'General Facebook feed surfaces must keep native focus so in-feed video ads can progress'],
        ['www.facebook.com', '/messages/t/redacted-thread', false, 'Facebook messaging surfaces should still spoof focus for read privacy'],
        ['www.facebook.com', '/messages/requests', true, 'Facebook message-request inbox must keep native focus so requests hydrate'],
        ['www.facebook.com', '/messages/requests/t/redacted-thread', true, 'Facebook message-request threads must keep native focus so chats load'],
        ['www.facebook.com', '/messages/message-requests', true, 'Facebook message-request alias routes must keep native focus'],
        ['www.facebook.com', '/messages/message_requests', true, 'Facebook underscored message-request alias routes must keep native focus'],
        ['www.fbsbx.com', '/maw_proxy_page/', false, 'Facebook MAW proxy frames should spoof focus for read privacy'],
        ['www.messenger.com', '/t/redacted-thread', false, 'Messenger.com conversation routes should still spoof focus for read privacy'],
        ['www.messenger.com', '/requests', true, 'Messenger.com request inbox must keep native focus so requests hydrate'],
        ['www.messenger.com', '/requests/t/redacted-thread', true, 'Messenger.com message-request conversation routes must keep native focus so chats load'],
        ['www.messenger.com', '/message-requests/t/redacted-thread', true, 'Messenger.com message-request alias routes must keep native focus'],
        ['www.messenger.com', '/message_requests/t/redacted-thread', true, 'Messenger.com underscored message-request alias routes must keep native focus'],
        ['www.messenger.com', '/t/redacted-thread?folder=message_requests', true, 'Messenger.com query-routed message requests must keep native focus'],
        ['www.messenger.com', '/t/redacted-thread#/message_requests', true, 'Messenger.com hash-routed message requests must keep native focus']
    ];

    for (const [hostname, route, expectedFocus, message] of cases) {
        const [pathnameAndSearch, hash = ''] = route.split('#');
        const [pathname, search = ''] = pathnameAndSearch.split('?');
        const formattedSearch = search ? `?${search}` : '';
        const formattedHash = hash ? `#${hash}` : '';
        const window = makeGhostPage({
            hostname,
            pathname,
            search: formattedSearch,
            hash: formattedHash,
            href: `https://${hostname}${pathname}${formattedSearch}${formattedHash}`
        });

        assert.strictEqual(window.document.hasFocus(), expectedFocus, message);
        assert.strictEqual(window.document.visibilityState, 'visible', `${message}: visibilityState should remain visible`);
        assert.strictEqual(window.document.hidden, false, `${message}: document.hidden should remain false`);
    }
}

function testInstagramMediaSurfacesDoNotSpoofFocus() {
    const cases = [
        ['/', 'Instagram feed must keep native focus so in-feed videos and ads can play'],
        ['/reels', 'Instagram reels index must keep native focus so reels and ads can play'],
        ['/reels/redacted/', 'Instagram reels must keep native focus so reels and ads can play'],
        ['/reel/redacted', 'Instagram reel aliases without trailing slash must keep native focus so reels and ads can play'],
        ['/reel/redacted/', 'Instagram reel aliases must keep native focus so reels and ads can play'],
        ['/p/redacted', 'Instagram post media pages without trailing slash must keep native focus so videos can play'],
        ['/p/redacted/', 'Instagram post media pages must keep native focus so videos can play'],
        ['/tv', 'Instagram TV index must keep native focus so videos can play'],
        ['/tv/redacted', 'Instagram TV media pages must keep native focus so videos can play'],
        ['/explore', 'Instagram explore index without trailing slash must keep native focus so videos can play'],
        ['/explore/', 'Instagram explore media pages must keep native focus so videos can play']
    ];

    for (const [pathname, message] of cases) {
        const window = makeGhostPage({
            hostname: 'www.instagram.com',
            pathname,
            href: `https://www.instagram.com${pathname}`
        });

        assert.strictEqual(window.document.hasFocus(), true, message);
        assert.strictEqual(window.document.visibilityState, 'visible', `${message}: visibilityState should remain visible`);
        assert.strictEqual(window.document.hidden, false, `${message}: document.hidden should remain false`);
    }

    const spaWindow = makeGhostPage({
        hostname: 'www.instagram.com',
        pathname: '/stories/redacted/',
        href: 'https://www.instagram.com/stories/redacted/'
    });
    assert.strictEqual(spaWindow.document.hasFocus(), false, 'Instagram stories should still spoof focus for story-view privacy');
    spaWindow.location.pathname = '/reels/redacted/';
    spaWindow.location.href = 'https://www.instagram.com/reels/redacted/';
    assert.strictEqual(
        spaWindow.document.hasFocus(),
        true,
        'Instagram SPA transition from stories into reels must restore native focus for video playback'
    );
}

function countDeliveredFocusEvents(window) {
    let delivered = 0;
    const listener = () => {
        delivered += 1;
    };

    window.addEventListener('focus', listener);
    window.addEventListener('blur', listener);
    window.document.addEventListener('focusin', listener);
    window.document.addEventListener('focusout', listener);

    window.dispatchEvent({ type: 'focus', target: window });
    window.dispatchEvent({ type: 'blur', target: window });
    window.document.dispatchEvent({ type: 'focusin', target: window.document });
    window.document.dispatchEvent({ type: 'focusout', target: window.document });

    return delivered;
}

function testMessageRequestRoutesDoNotSuppressFocusEvents() {
    const messengerThreadWindow = makeGhostPage({
        hostname: 'www.messenger.com',
        pathname: '/t/redacted-thread',
        href: 'https://www.messenger.com/t/redacted-thread'
    });
    assert.strictEqual(
        countDeliveredFocusEvents(messengerThreadWindow),
        0,
        'Messenger.com normal thread routes should suppress focus events for read privacy'
    );

    const messengerRequestWindow = makeGhostPage({
        hostname: 'www.messenger.com',
        pathname: '/t/redacted-thread',
        search: '?folder=message_requests',
        href: 'https://www.messenger.com/t/redacted-thread?folder=message_requests'
    });
    assert.strictEqual(
        countDeliveredFocusEvents(messengerRequestWindow),
        4,
        'Messenger.com query-routed request routes must not suppress focus events needed by the request loader'
    );

    const facebookThreadWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/messages/t/redacted-thread',
        href: 'https://www.facebook.com/messages/t/redacted-thread'
    });
    assert.strictEqual(
        countDeliveredFocusEvents(facebookThreadWindow),
        0,
        'Facebook normal message routes should suppress focus events for read privacy'
    );

    const facebookRequestWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/messages/requests/t/redacted-thread',
        href: 'https://www.facebook.com/messages/requests/t/redacted-thread'
    });
    assert.strictEqual(
        countDeliveredFocusEvents(facebookRequestWindow),
        4,
        'Facebook request routes must not suppress focus events needed by the request loader'
    );

    const facebookProxyWindow = makeGhostPage({
        hostname: 'www.fbsbx.com',
        pathname: '/maw_proxy_page/',
        search: '?__cci=redacted',
        href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
    });
    assert.strictEqual(
        countDeliveredFocusEvents(facebookProxyWindow),
        0,
        'Facebook MAW proxy frames should suppress focus events for read privacy'
    );
}

function testMawProxyRejectsUntrustedMessageRequestGrace() {
    const facebookProxyWindow = makeGhostPage({
        hostname: 'www.fbsbx.com',
        pathname: '/maw_proxy_page/',
        search: '?__cci=redacted',
        href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
    });
    assert.strictEqual(
        facebookProxyWindow.document.hasFocus(),
        false,
        'Facebook MAW proxy frames should start spoofed on normal message surfaces'
    );

    let focusSignals = 0;
    facebookProxyWindow.addEventListener('focus', () => { focusSignals += 1; });
    facebookProxyWindow.document.addEventListener('visibilitychange', () => { focusSignals += 1; });
    facebookProxyWindow.document.addEventListener('focusin', () => { focusSignals += 1; });

    facebookProxyWindow.dispatchEvent({
        type: 'message',
        data: {
            source: 'GHOSTIFY_PAGE',
            type: 'GHOSTIFY_MESSAGE_REQUEST_NATIVE_GRACE',
            until: Date.now() + 15000
        }
    });

    assert.strictEqual(
        facebookProxyWindow.document.hasFocus(),
        false,
        'Facebook MAW proxy must ignore message-request grace without the extension nonce'
    );
    assert.strictEqual(
        focusSignals,
        0,
        'Facebook MAW proxy must not emit native focus signals for untrusted grace messages'
    );
}

function testMessageRequestSpaRouteChangesRestoreNativeFocus() {
    const messengerWindow = makeGhostPage({
        hostname: 'www.messenger.com',
        pathname: '/t/redacted-thread',
        href: 'https://www.messenger.com/t/redacted-thread'
    });
    assert.strictEqual(messengerWindow.document.hasFocus(), false);
    const deliveredBeforeRouteChange = countDeliveredFocusEvents(messengerWindow);
    assert.strictEqual(
        deliveredBeforeRouteChange,
        0,
        'Messenger listeners registered before a request route change should start suppressed on normal threads'
    );
    messengerWindow.location.pathname = '/requests/t/redacted-thread';
    messengerWindow.location.href = 'https://www.messenger.com/requests/t/redacted-thread';
    assert.strictEqual(
        messengerWindow.document.hasFocus(),
        true,
        'Messenger SPA transition into request routes must restore native focus'
    );
    assert.strictEqual(
        countDeliveredFocusEvents(messengerWindow),
        4,
        'Messenger SPA transition into request routes must stop suppressing focus events'
    );

    const facebookWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/messages/t/redacted-thread',
        href: 'https://www.facebook.com/messages/t/redacted-thread'
    });
    assert.strictEqual(facebookWindow.document.hasFocus(), false);
    const facebookDeliveredBeforeRouteChange = countDeliveredFocusEvents(facebookWindow);
    assert.strictEqual(
        facebookDeliveredBeforeRouteChange,
        0,
        'Facebook listeners registered before a request route change should start suppressed on normal threads'
    );
    facebookWindow.location.pathname = '/messages/requests/t/redacted-thread';
    facebookWindow.location.href = 'https://www.facebook.com/messages/requests/t/redacted-thread';
    assert.strictEqual(
        facebookWindow.document.hasFocus(),
        true,
        'Facebook SPA transition into request routes must restore native focus'
    );
    assert.strictEqual(
        countDeliveredFocusEvents(facebookWindow),
        4,
        'Facebook SPA transition into request routes must stop suppressing focus events'
    );
}

function createRequestClickTarget({ href = '', label = '' }) {
    return {
        innerText: label,
        textContent: label,
        getAttribute(name) {
            if (name === 'href') return href;
            if (name === 'aria-label') return label;
            if (name === 'title') return label;
            return null;
        },
        closest() {
            return this;
        }
    };
}

function testMessageRequestClicksTemporarilyRestoreNativeFocus() {
    const messengerWindow = makeGhostPage({
        hostname: 'www.messenger.com',
        pathname: '/t/redacted-thread',
        href: 'https://www.messenger.com/t/redacted-thread'
    });
    assert.strictEqual(messengerWindow.document.hasFocus(), false);
    let messengerFocusSignals = 0;
    messengerWindow.addEventListener('focus', () => { messengerFocusSignals += 1; });
    messengerWindow.document.addEventListener('visibilitychange', () => { messengerFocusSignals += 1; });
    messengerWindow.document.addEventListener('focusin', () => { messengerFocusSignals += 1; });
    messengerWindow.document.dispatchEvent({
        type: 'pointerdown',
        target: createRequestClickTarget({
            href: '/requests/t/redacted-thread',
            label: 'Requests · 3 unread'
        })
    });
    assert.strictEqual(
        messengerWindow.document.hasFocus(),
        true,
        'Messenger request-link clicks must restore native focus before the SPA URL changes'
    );
    assert(
        messengerFocusSignals > 0,
        'Messenger request-link clicks must deliver native focus/visibility signals for the request loader'
    );
    assert(
        Number(messengerWindow.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ || 0) > Date.now(),
        'Messenger request-link clicks must open a short native transport grace window'
    );

    const facebookWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/messages/t/redacted-thread',
        href: 'https://www.facebook.com/messages/t/redacted-thread'
    });
    assert.strictEqual(facebookWindow.document.hasFocus(), false);
    let facebookFocusSignals = 0;
    facebookWindow.addEventListener('focus', () => { facebookFocusSignals += 1; });
    facebookWindow.document.addEventListener('visibilitychange', () => { facebookFocusSignals += 1; });
    facebookWindow.document.addEventListener('focusin', () => { facebookFocusSignals += 1; });
    facebookWindow.document.dispatchEvent({
        type: 'click',
        target: createRequestClickTarget({
            href: '',
            label: 'Message requests'
        })
    });
    assert.strictEqual(
        facebookWindow.document.hasFocus(),
        true,
        'Facebook message-request menu clicks must restore native focus before the SPA URL changes'
    );
    assert(
        facebookFocusSignals > 0,
        'Facebook message-request menu clicks must deliver native focus/visibility signals for the request loader'
    );
    assert(
        Number(facebookWindow.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ || 0) > Date.now(),
        'Facebook message-request menu clicks must open a short native transport grace window'
    );
}

async function testMessageRequestClickGraceKeepsTransportAndBridgeNative() {
    const messengerWindow = makeGhostPage({
        hostname: 'www.messenger.com',
        pathname: '/t/redacted-thread',
        href: 'https://www.messenger.com/t/redacted-thread'
    });
    messengerWindow.document.dispatchEvent({
        type: 'pointerdown',
        target: createRequestClickTarget({
            href: '/requests/t/redacted-thread',
            label: 'Requests · 3 unread'
        })
    });

    assert.strictEqual(
        await fetchOutcome(messengerWindow, lsMessageRequestThreadListLoad),
        'allowed',
        'Messenger request-click grace must not synthesize-block request transition fetches before the SPA URL settles'
    );
    assert.strictEqual(
        websocketOutcome(messengerWindow, lsMessageRequestThreadListLoad),
        'allowed',
        'Messenger request-click grace must not drop request transition WebSocket frames before the SPA URL settles'
    );
    assert.strictEqual(
        xhrSend(messengerWindow, lsMessageRequestThreadListLoad).result,
        'sent',
        'Messenger request-click grace must not synthesize-block request transition XHR before the SPA URL settles'
    );
    assert.strictEqual(
        await fetchOutcome(messengerWindow, messengerReadReceipt),
        'MSG_SEEN',
        'Messenger request-click grace must not allow explicit read-receipt writes'
    );
    assert.strictEqual(
        websocketOutcome(messengerWindow, messengerTyping),
        'blocked',
        'Messenger request-click grace must not allow explicit typing writes'
    );

    const facebookWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/messages/t/redacted-thread',
        href: 'https://www.facebook.com/messages/t/redacted-thread'
    });
    facebookWindow.document.dispatchEvent({
        type: 'click',
        target: createRequestClickTarget({
            href: '',
            label: 'Message requests'
        })
    });

    assert.strictEqual(
        await fetchOutcome(facebookWindow, lsMessageRequestThreadListLoad),
        'allowed',
        'Facebook message-request click grace must not synthesize-block request transition fetches before the SPA URL settles'
    );
    assert.strictEqual(
        await fetchOutcome(facebookWindow, messengerReadReceipt),
        'MSG_SEEN',
        'Facebook message-request click grace must not allow explicit read-receipt writes'
    );

    const patchContext = makeMessengerPatchPage({}, {
        hostname: 'www.messenger.com',
        pathname: '/t/redacted-thread',
        href: 'https://www.messenger.com/t/redacted-thread'
    });
    patchContext.window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ = Date.now() + 15000;
    assert.strictEqual(
        workerOutcome(patchContext, lsMessageRequestThreadListLoad).result,
        'worker-sent',
        'Messenger request-click grace must forward bridge request-loader frames while the request loader hydrates'
    );
    assert.strictEqual(
        workerOutcome(patchContext, JSON.parse(messengerTyping)).result,
        undefined,
        'Messenger request-click grace must not forward explicit bridge typing writes'
    );
}

(async () => {
    await testMessengerSendWatermarkTrafficIsAllowed();
    await testMessengerSendReceiptFlagTrafficIsAllowed();
    await testMessengerBatchedSendTrafficIsAllowed();
    await testMessengerBatchedNetworkTrafficSanitizesPrivacyTasks();
    await testRapidMessengerSendsWithPrivacyMarkersAreAllowed();
    await testMessengerSendUserTextPrivacyTermsAreAllowed();
    await testMessengerDeliveryWatermarkTrafficIsAllowed();
    testMessengerPatchMixedSendTypingBatchPreservesSend();
    testMessengerPatchMixedSendReadStringBatchPreservesSend();
    testMessengerPatchObjectMapBatchSanitizesPrivacyTasks();
    testMessengerPatchSendWithTransferIsForwarded();
    testMessengerPatchMixedTransferBatchesSanitizePrivacyTasks();
    testMessengerPatchReferencedSendTransferIsPreserved();
    await testMessengerTypingAndSeenProtectionsStillBlock();
    testMessengerPatchPurePrivacyTrafficStillBlocks();
    await testMessengerTogglesDisableProtections();
    await testMessageRequestsAndInboxQueriesAreAllowed();
    testMessengerPatchRequestRouteModulesHydrateUntouched();
    testMessengerPatchLocalReadModulesStayUntouchedAfterRequestSpaNavigation();
    testFacebookNormalThreadLocalReadModulesAreSanitized();
    testFacebookMawProxyLocalReadModulesAreSanitized();
    await testFacebookMawProxyNetworkReadReceiptsAreBlocked();
    testNonMawFbsbxPagesAreNotTreatedAsMessenger();
    testManifestInjectsIntoFacebookMawProxyFrames();
    testMessengerPatchRequestRouteExplicitModulesStayProtected();
    await testVideoAdAndMediaTrafficIsAllowed();
    await testPrivacyWritesStillBlockWithRequestOrMediaContext();
    testFacebookWatchDoesNotSpoofFocus();
    testInstagramMediaSurfacesDoNotSpoofFocus();
    testMessageRequestRoutesDoNotSuppressFocusEvents();
    testMawProxyRejectsUntrustedMessageRequestGrace();
    testMessageRequestSpaRouteChangesRestoreNativeFocus();
    testMessageRequestClicksTemporarilyRestoreNativeFocus();
    await testMessageRequestClickGraceKeepsTransportAndBridgeNative();
    console.log('messenger send-stability regression tests passed');
})().catch(error => {
    console.error(error);
    process.exit(1);
});
