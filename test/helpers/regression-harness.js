const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const ghostSource = fs.readFileSync("dist/js/ghost.js", "utf8");

const messengerPatchSource = fs.readFileSync(
    "dist/js/messenger_patch.js",
    "utf8",
);

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
        return "sent";
    }
}

class FakeXHR {
    open(method, url) {
        this._ghostifyMethod = method;
        this._ghostifyUrl = url;
    }

    send(body) {
        this.sent = body;
        return "sent";
    }
}

class FakeBlob {
    constructor(parts, init = {}) {
        this.parts = parts;
        this.type = init.type || "";
        FakeBlob.instances.push(this);
    }
}

FakeBlob.instances = [];

const createdObjectUrls = [];

const NativeURL = URL;

const SAFE_READ_WATERMARK = 1000000000000;

function FakeURL(input, base) {
    return new NativeURL(input, base);
}

FakeURL.createObjectURL = function (blob) {
    const url = `blob:ghostify-worker-${createdObjectUrls.length + 1}`;
    createdObjectUrls.push({ url, blob });
    return url;
};

FakeURL.revokeObjectURL = function () {};

function FakeEventTarget() {}

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
        if (typeof listener === "function") {
            listener.call(this, targetEvent);
        } else if (listener && typeof listener.handleEvent === "function") {
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
            this.url = String(input || "");
            this.method = init.method || "GET";
            this.headers = init.headers || {};
            this.body = init.body;
        }
        this.mode = init.mode || "same-origin";
        this.credentials = init.credentials || "same-origin";
        this.cache = init.cache || "default";
        this.redirect = init.redirect || "follow";
        this.referrer = init.referrer || "";
        this.integrity = init.integrity || "";
        this.keepalive = !!init.keepalive;
    }

    clone() {
        return new FakeRequest(this);
    }

    async text() {
        return this.body || "";
    }
}

function FakeDocument() {}

FakeDocument.prototype = Object.create(FakeEventTarget.prototype);

FakeDocument.prototype.constructor = FakeDocument;

Object.defineProperty(FakeDocument.prototype, "visibilityState", {
    get() {
        return "visible";
    },
    configurable: true,
});

Object.defineProperty(FakeDocument.prototype, "hidden", {
    get() {
        return false;
    },
    configurable: true,
});

const messengerSendWithWatermark = JSON.stringify({
    issue_new_task: true,
    tasks: [
        {
            label: "send_message",
            queue_name: "messenger_send_message",
            payload: {
                thread_key: { thread_fbid: "redacted-thread" },
                send_type: 1,
                message: { text: "<redacted-user-text>" },
                last_read_watermark_ts: 1779530000000,
            },
        },
    ],
});

const messengerSendWithReadReceiptFlag = JSON.stringify({
    issue_new_task: true,
    tasks: [
        {
            label: "send_message",
            queue_name: "messenger_send_message",
            payload: {
                thread_key: { thread_fbid: "redacted-thread" },
                send_type: 1,
                offline_threading_id: "redacted-offline-id",
                message: { text: "<redacted-user-text>" },
                last_read_watermark_ts: 1779530000000,
                shouldSendReadReceipt: false,
            },
        },
    ],
});

const messengerBatchedSendWithReadReceipt = JSON.stringify({
    issue_new_task: true,
    tasks: [
        {
            label: "send_message",
            queue_name: "messenger_send_message",
            payload: {
                thread_key: { thread_fbid: "redacted-thread" },
                send_type: 1,
                offline_threading_id: "redacted-offline-id",
                message: { text: "<redacted-user-text>" },
            },
        },
        {
            label: "read_receipt",
            queue_name: "read_receipt",
            payload: {
                thread_key: { thread_fbid: "redacted-thread" },
                sendReadReceipt: true,
            },
        },
    ],
});

const messengerSendWithUserAuthoredPrivacyTerms = JSON.stringify({
    issue_new_task: true,
    tasks: [
        {
            label: "send_message",
            queue_name: "messenger_send_message",
            payload: {
                thread_key: { thread_fbid: "redacted-thread" },
                send_type: 1,
                offline_threading_id: "redacted-offline-id",
                message: {
                    text: "mark_read reel_seen typing_indicator delivery_receipt",
                },
            },
        },
    ],
});

const messengerDeliveryWithWatermark = JSON.stringify({
    issue_new_task: true,
    tasks: [
        {
            label: "delivery_receipt",
            queue_name: "message_delivered",
            payload: {
                thread_key: { thread_fbid: "redacted-thread" },
                message_delivered: true,
                last_read_watermark_ts: 1779530000000,
            },
        },
    ],
});

const messengerTyping = JSON.stringify({
    issue_new_task: true,
    tasks: [
        {
            label: "sendChatStateFromComposer",
            payload: {
                thread_key: { thread_fbid: "redacted-thread" },
                chatstate: "typing_indicator",
                send_type: "typing",
            },
        },
    ],
});

const messengerReadReceipt = JSON.stringify({
    issue_new_task: true,
    tasks: [
        {
            label: "read_receipt",
            payload: {
                thread_key: { thread_fbid: "redacted-thread" },
                sendReadReceipt: true,
            },
        },
    ],
});

const facebookWorkerEdgeChatLastSeenFrame = new Uint8Array(
    Buffer.from(
        `{}\r\u0000{"app_id":"2220391788200892","payload":"{\\"label\\":\\"6\\",\\"payload\\":\\"{\\\\\\"parent_thread_key\\\\\\":1000000000000002,\\\\\\"last_seen_time_ms\\\\\\":1780070890716}\\",\\"version\\":\\"27029912679952307\\"}","request_id":179,"type":4}`,
        "utf8",
    ),
);

const facebookFramePrefix = "\u000fg\u0000\u0002\u0000\u0000{}\rg\u0000\u0000";

const lsMessageRequestThreadListLoad = JSON.stringify({
    issue_new_task: true,
    tasks: [
        {
            label: "MWMessageRequestsThreadListPaginationQuery",
            queue_name: "mwchat_fetch_thread_list",
            payload: {
                folder: "message_requests",
                thread_key: { thread_fbid: "redacted-thread" },
                cursor: "redacted-cursor",
                last_read_watermark: 1779530000000,
            },
        },
    ],
});

function makeGhostPage(page = {}, settings = {}) {
    const fetchCalls = [];
    const beaconCalls = [];
    const document = new FakeDocument();
    document.readyState = "complete";
    document.hasFocus = () =>
        page.nativeHasFocus !== undefined ? page.nativeHasFocus : true;
    if (
        page.facebookMessengerPopoverOpen ||
        page.facebookMiniChatOpen ||
        page.facebookMiniChatLoading
    ) {
        document.querySelector = (selector) => {
            const text = String(selector || "");
            if (page.facebookMessengerPopoverOpen) {
                if (text.includes('aria-label="Messenger"')) return {};
                if (text.includes('aria-label="Chats"')) return {};
            }
            if (page.facebookMiniChatLoading) {
                if (text.includes('aria-label^="Messages in conversation"')) {
                    return {
                        innerText: "Loading...",
                        textContent: "Loading...",
                    };
                }
            }
            if (page.facebookMiniChatOpen) {
                if (text.includes('aria-label="Minimize chat"')) return {};
                if (text.includes('aria-label="Close chat"')) return {};
                if (text.includes('role="textbox"')) return {};
                if (text.includes('aria-label^="Write to"')) return {};
            }
            return null;
        };
    }

    class PageFakeWebSocket extends FakeWebSocket {}
    class PageFakeXHR extends FakeXHR {}

    const window = Object.assign(Object.create(FakeEventTarget.prototype), {
        location: {
            hostname: page.hostname || "www.messenger.com",
            pathname: page.pathname || "/t/123",
            search: page.search || "",
            hash: page.hash || "",
            href:
                page.href ||
                `https://${page.hostname || "www.messenger.com"}${page.pathname || "/t/123"}${page.search || ""}${page.hash || ""}`,
        },
        document,
        postMessage(message) {
            window.dispatchEvent({
                type: "message",
                source: window,
                data: message,
                target: window,
            });
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
                return "beacon";
            },
        },
        beaconCalls,
        localStorage: { ghostifyDebug: "0", ghostifyMessengerObserve: "0" },
        Response: FakeResponse,
        Request: FakeRequest,
        TextDecoder,
        TextEncoder,
        ArrayBuffer,
        URL,
        URLSearchParams,
        FormData: class {},
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
        TextEncoder,
        ArrayBuffer,
        URL,
        URLSearchParams,
        FormData: window.FormData,
        localStorage: window.localStorage,
        console: {
            debug() {},
            log() {},
            error() {},
        },
    };
    context.globalThis = context;

    vm.runInNewContext(ghostSource, context, { filename: "ghost.js" });
    window.postMessage({
        type: "GHOSTIFY_SETTINGS_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        settings: {
            igTyping: true,
            igSeen: true,
            igStory: true,
            msgTyping: true,
            msgSeen: true,
            msgStory: true,
            ...settings,
        },
    });

    return window;
}

function makeMessengerPage(settings = {}) {
    return makeGhostPage(
        {
            hostname: "www.messenger.com",
            pathname: "/t/123",
            href: "https://www.messenger.com/t/123",
        },
        settings,
    );
}

function makeMessengerPatchPage(settings = {}, page = {}) {
    const listeners = {};
    const workerPosts = [];
    const workerConstructs = [];
    FakeBlob.instances = [];
    createdObjectUrls.length = 0;

    function Worker(scriptURL, options) {
        workerConstructs.push({ scriptURL, options });
    }
    Worker.prototype.postMessage = function (message, transfer) {
        workerPosts.push({ target: "worker", message, transfer });
        return "worker-sent";
    };

    function SharedWorker(scriptURL, options) {
        workerConstructs.push({ scriptURL, options, shared: true });
        this.port = new MessagePort("shared-worker-port");
    }

    function MessagePort(target = "port") {
        this.target = target;
    }
    MessagePort.prototype.postMessage = function (message, transfer) {
        workerPosts.push({ target: this.target || "port", message, transfer });
        return this.target === "shared-worker-port"
            ? "shared-worker-port-sent"
            : "port-sent";
    };

    const document = {
        readyState: "complete",
        querySelector(selector) {
            const text = String(selector || "");
            if (page.facebookMessengerPopoverOpen) {
                if (text.includes('aria-label="Messenger"')) return {};
                if (text.includes('aria-label="Chats"')) return {};
            }
            if (page.facebookMiniChatOpen) {
                if (text.includes('aria-label="Minimize chat"')) return {};
                if (text.includes('aria-label="Close chat"')) return {};
                if (text.includes('role="textbox"')) return {};
                if (text.includes('aria-label^="Write to"')) return {};
                if (text.includes('aria-label^="Messages in conversation"'))
                    return {};
                if (text.includes('aria-label^="Conversation titled"'))
                    return {};
            }
            return null;
        },
    };

    const window = {
        location: {
            hostname: page.hostname || "www.messenger.com",
            pathname: page.pathname || "/t/123",
            search: page.search || "",
            hash: page.hash || "",
            href:
                page.href ||
                `https://${page.hostname || "www.messenger.com"}${page.pathname || "/t/123"}${page.search || ""}${page.hash || ""}`,
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
        localStorage: { ghostifyDebug: "0", ghostifyMessengerObserve: "0" },
        document,
    };
    window.Worker = Worker;
    window.SharedWorker = SharedWorker;
    window.Blob = FakeBlob;
    window.URL = FakeURL;
    window.window = window;

    const context = {
        window,
        Worker,
        SharedWorker,
        Blob: FakeBlob,
        URL: FakeURL,
        MessagePort,
        workerPosts,
        workerConstructs,
        createdObjectUrls,
        document,
        TextDecoder,
        TextEncoder,
        ArrayBuffer,
        URLSearchParams,
        console: {
            debug() {},
            log() {},
            error() {},
        },
    };
    context.globalThis = context;

    vm.runInNewContext(messengerPatchSource, context, {
        filename: "messenger_patch.js",
    });
    window.postMessage({
        type: "GHOSTIFY_SETTINGS_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        settings: {
            msgTyping: true,
            msgSeen: true,
            ...settings,
        },
    });

    return context;
}

function registerMessengerModule(context, moduleName, factory) {
    let registeredModule;
    context.window.__d = function (_moduleName, _dependencies, moduleFactory) {
        const module = { exports: {} };
        const localRequire = () => ({});
        moduleFactory(
            null,
            localRequire,
            localRequire,
            localRequire,
            module,
            module.exports,
        );
        registeredModule = module;
        return module;
    };

    const result = context.window.__d(moduleName, [], factory);
    return registeredModule || result;
}

function registerMessengerModuleWithDependencies(
    context,
    moduleName,
    dependencies,
    dependencyExports,
    factory,
) {
    let registeredModule;
    context.window.__d = function (_moduleName, _dependencies, moduleFactory) {
        const module = { exports: {} };
        const localRequire = (name) => dependencyExports[name] || {};
        moduleFactory(
            null,
            localRequire,
            localRequire,
            localRequire,
            module,
            module.exports,
        );
        registeredModule = module;
        return module;
    };

    const result = context.window.__d(moduleName, dependencies, factory);
    return registeredModule || result;
}

async function fetchOutcome(window, body) {
    const response = await window.fetch("/ls_req", {
        method: "POST",
        body,
    });
    return response.ghostifyResponse
        ? JSON.parse(response.body).blocked
        : "allowed";
}

async function fetchOutcomeAt(window, url, body, method = "POST") {
    const response = await window.fetch(url, {
        method,
        body,
    });
    if (!response.ghostifyResponse) return "allowed";
    const payload = JSON.parse(response.body);
    return payload.blocked || "blocked";
}

function websocketOutcome(
    window,
    body,
    url = "wss://edge-chat.messenger.com/chat?region=redacted",
) {
    const socket = new window.WebSocket(url);
    return socket.send(body) === "sent" ? "allowed" : "blocked";
}

function websocketSend(
    window,
    body,
    url = "wss://edge-chat.messenger.com/chat?region=redacted",
) {
    const socket = new window.WebSocket(url);
    const result = socket.send(body);
    return { result, socket };
}

function xhrSend(window, body, url = "/ls_req") {
    const xhr = new window.XMLHttpRequest();
    xhr.open("POST", url);
    const result = xhr.send(body);
    return { result, xhr };
}

function xhrSendAt(window, url, body, method = "GET") {
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
        sanitizedSeen:
            context.window.__GHOSTIFY_SANITIZED_SEEN_BRIDGE_MESSAGES__ || 0,
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
        sanitizedSeen:
            context.window.__GHOSTIFY_SANITIZED_SEEN_BRIDGE_MESSAGES__ || 0,
    };
}

function decodeBridgeBytes(value) {
    if (Object.prototype.toString.call(value) === "[object ArrayBuffer]") {
        return new TextDecoder().decode(new Uint8Array(value));
    }
    assert.ok(ArrayBuffer.isView(value), "expected a binary bridge payload");
    return new TextDecoder().decode(
        new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
    );
}

function decodeFacebookFramedTasks(value, prefix = facebookFramePrefix) {
    const text = decodeBridgeBytes(value);
    assert.ok(
        text.startsWith(prefix),
        "Facebook realtime frame prefix must stay byte-for-byte intact",
    );
    const outer = JSON.parse(text.slice(prefix.length));
    return { outer, inner: JSON.parse(outer.payload) };
}

function createRequestClickTarget({ href = "", label = "" }) {
    return {
        innerText: label,
        textContent: label,
        getAttribute(name) {
            if (name === "href") return href;
            if (name === "aria-label") return label;
            if (name === "title") return label;
            return null;
        },
        closest() {
            return this;
        },
    };
}

module.exports = {
    SAFE_READ_WATERMARK,
    messengerSendWithWatermark,
    messengerSendWithReadReceiptFlag,
    messengerBatchedSendWithReadReceipt,
    messengerSendWithUserAuthoredPrivacyTerms,
    messengerDeliveryWithWatermark,
    messengerTyping,
    messengerReadReceipt,
    facebookWorkerEdgeChatLastSeenFrame,
    facebookFramePrefix,
    lsMessageRequestThreadListLoad,
    makeGhostPage,
    makeMessengerPage,
    makeMessengerPatchPage,
    registerMessengerModule,
    registerMessengerModuleWithDependencies,
    fetchOutcome,
    fetchOutcomeAt,
    websocketOutcome,
    websocketSend,
    xhrSend,
    xhrSendAt,
    workerOutcome,
    portOutcome,
    decodeBridgeBytes,
    decodeFacebookFramedTasks,
    createRequestClickTarget,
};
