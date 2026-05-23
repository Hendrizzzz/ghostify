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
FakeEventTarget.prototype.addEventListener = function () { };
FakeEventTarget.prototype.removeEventListener = function () { };

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

function makeMessengerPage(settings = {}) {
    const listeners = {};
    const fetchCalls = [];
    const document = new FakeDocument();
    document.readyState = 'complete';
    document.hasFocus = () => true;
    document.addEventListener = function () { };

    class PageFakeWebSocket extends FakeWebSocket { }
    class PageFakeXHR extends FakeXHR { }

    const window = {
        location: {
            hostname: 'www.messenger.com',
            pathname: '/t/123',
            href: 'https://www.messenger.com/t/123'
        },
        document,
        addEventListener(type, listener) {
            listeners[type] = listeners[type] || [];
            listeners[type].push(listener);
        },
        postMessage(message) {
            for (const listener of listeners.message || []) {
                listener({ source: window, data: message });
            }
        },
        fetch: async (input, init) => {
            fetchCalls.push({ input, init });
            return { original: true };
        },
        fetchCalls,
        WebSocket: PageFakeWebSocket,
        XMLHttpRequest: PageFakeXHR,
        EventTarget: FakeEventTarget,
        navigator: { sendBeacon: () => 'beacon' },
        localStorage: { ghostifyDebug: '0', ghostifyMessengerObserve: '0' },
        Response: FakeResponse,
        Request: FakeRequest,
        TextDecoder,
        ArrayBuffer,
        URLSearchParams,
        FormData: class { }
    };
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

function makeMessengerPatchPage(settings = {}) {
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
            hostname: 'www.messenger.com',
            pathname: '/t/123',
            href: 'https://www.messenger.com/t/123'
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

async function fetchOutcome(window, body) {
    const response = await window.fetch('/ls_req', {
        method: 'POST',
        body
    });
    return response.ghostifyResponse ? JSON.parse(response.body).blocked : 'allowed';
}

async function fetchRequestOutcome(window, body) {
    const request = new window.Request('/ls_req', {
        method: 'POST',
        body
    });
    const response = await window.fetch(request);
    return response.ghostifyResponse ? JSON.parse(response.body).blocked : 'allowed';
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
    console.log('messenger send-stability regression tests passed');
})().catch(error => {
    console.error(error);
    process.exit(1);
});
