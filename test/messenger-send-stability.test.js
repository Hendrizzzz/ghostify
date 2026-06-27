const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const pkg = require('../package.json');

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

class FakeBlob {
    constructor(parts, init = {}) {
        this.parts = parts;
        this.type = init.type || '';
        FakeBlob.instances.push(this);
    }
}
FakeBlob.instances = [];

const createdObjectUrls = [];

const NativeURL = URL;
const SAFE_READ_WATERMARK = 1000000000000;
const SAFE_READ_WATERMARK_STRING = String(SAFE_READ_WATERMARK);

function FakeURL(input, base) {
    return new NativeURL(input, base);
}

FakeURL.createObjectURL = function (blob) {
    const url = `blob:ghostify-worker-${createdObjectUrls.length + 1}`;
    createdObjectUrls.push({ url, blob });
    return url;
};
FakeURL.revokeObjectURL = function () { };

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

const facebookWorkerEdgeChatReadWatermarkFrame = new Uint8Array(Buffer.from(`{}\r\u0000{"app_id":"2220391788200892","payload":"{\\"epoch_id\\":7466158453245587268,\\"tasks\\":[{\\"failure_count\\":null,\\"label\\":\\"21\\",\\"payload\\":\\"{\\\\\\"thread_id\\\\\\":9554524854659116,\\\\\\"last_read_watermark_ts\\\\\\":1780070888819,\\\\\\"sync_group\\\\\\":104}\\",\\"queue_name\\":\\"9554524854659116\\",\\"task_id\\":409}],\\"version_id\\":\\"27029912679952307\\"}","request_id":167,"type":3}`, 'utf8'));

const facebookWorkerEdgeChatLastSeenFrame = new Uint8Array(Buffer.from(`{}\r\u0000{"app_id":"2220391788200892","payload":"{\\"label\\":\\"6\\",\\"payload\\":\\"{\\\\\\"parent_thread_key\\\\\\":1369182074351833,\\\\\\"last_seen_time_ms\\\\\\":1780070890716}\\",\\"version\\":\\"27029912679952307\\"}","request_id":179,"type":4}`, 'utf8'));

const facebookWorkerEdgeChatDeliveryFrame = new Uint8Array(Buffer.from(`{}\r\u0000{"app_id":"2220391788200892","payload":"{\\"label\\":\\"delivery\\",\\"payload\\":\\"{\\\\\\"thread_id\\\\\\":9554524854659116,\\\\\\"delivery_receipt\\\\\\":true}\\",\\"version\\":\\"27029912679952307\\"}","request_id":180,"type":4}`, 'utf8'));

const facebookEdgeChatMixedOpaqueSendTypingFrame = new Uint8Array(Buffer.from(`{}\r\u0000${JSON.stringify({
    app_id: '2220391788200892',
    payload: JSON.stringify({
        epoch_id: 7466158453245588000,
        tasks: [{
            failure_count: null,
            label: '46',
            payload: JSON.stringify({
                thread_id: 9554524854659116,
                offline_threading_id: 'redacted-offline-id',
                send_type: 1,
                message: { text: '1' },
                sync_group: 104
            }),
            queue_name: '9554524854659116',
            task_id: 410
        }, {
            failure_count: null,
            label: 'sendChatStateFromComposer',
            payload: JSON.stringify({
                thread_id: 9554524854659116,
                chatstate: 'typing_indicator',
                send_type: 'typing'
            }),
            queue_name: '9554524854659116',
            task_id: 411
        }],
        version_id: '27029912679952307'
    }),
    request_id: 181,
    type: 3
})}`, 'utf8'));

const facebookEdgeChatQuickReactionSendTypingFrame = new Uint8Array(Buffer.from(`{}\r\u0000${JSON.stringify({
    app_id: '2220391788200892',
    payload: JSON.stringify({
        epoch_id: 7466158453245588001,
        tasks: [{
            failure_count: null,
            label: '46',
            payload: JSON.stringify({
                other_user_id: 'redacted-user',
                offline_threading_id: 'redacted-offline-id',
                send_type: 1,
                reaction: '👍',
                emoji: '👍',
                quick_like: true,
                sync_group: 104
            }),
            queue_name: 'redacted-user',
            task_id: 412
        }, {
            failure_count: null,
            label: 'sendChatStateFromComposer',
            payload: JSON.stringify({
                other_user_id: 'redacted-user',
                chatstate: 'typing_indicator',
                send_type: 'typing'
            }),
            queue_name: 'redacted-user',
            task_id: 413
        }],
        version_id: '27029912679952307'
    }),
    request_id: 182,
    type: 3
})}`, 'utf8'));

const facebookFeedThreadOpenFullFetchFrame = new Uint8Array(Buffer.from(`\u000fg\u0000\u0002\u0000\u0000{}\rg\u0000\u0000{"app_id":"2220391788200892","payload":"{\\"epoch_id\\":7466175527281646890,\\"tasks\\":[{\\"failure_count\\":null,\\"label\\":\\"209\\",\\"payload\\":\\"{\\\\\\"thread_fbid\\\\\\":1594581527264656,\\\\\\"force_upsert\\\\\\":0,\\\\\\"use_open_messenger_transport\\\\\\":0,\\\\\\"sync_group\\\\\\":95,\\\\\\"metadata_only\\\\\\":0,\\\\\\"preview_only\\\\\\":0}\\",\\"queue_name\\":\\"1594581527264656\\",\\"task_id\\":238}],\\"version_id\\":\\"27029912679952307\\"}","request_id":107,"type":3}`, 'utf8'));

const facebookFeedArmadilloOpenThreadFrame = new Uint8Array(Buffer.from(`\u000fg\u0000\u0002\u0000\u0000{}\rg\u0000\u0000{"app_id":"2220391788200892","payload":"{\\"epoch_id\\":7466178972558867308,\\"tasks\\":[{\\"failure_count\\":null,\\"label\\":\\"436\\",\\"payload\\":\\"{\\\\\\"open_message_thread_key\\\\\\":61557782315684,\\\\\\"armadillo_thread_key\\\\\\":61557782315684,\\\\\\"trace_id\\\\\\":\\\\\\"41AA1952E6DBA5E1\\\\\\",\\\\\\"should_copy_messages\\\\\\":0}\\",\\"queue_name\\":\\"61557782315684_61557782315684\\",\\"task_id\\":391}],\\"version_id\\":\\"27029912679952307\\"}","request_id":145,"type":3}`, 'utf8'));

const facebookFeedThreadOpenWithReadMetadataFrame = new Uint8Array(Buffer.from(`\u000fg\u0000\u0002\u0000\u0000{}\rg\u0000\u0000{"app_id":"2220391788200892","payload":"{\\"epoch_id\\":7466175527281646891,\\"tasks\\":[{\\"failure_count\\":null,\\"label\\":\\"209\\",\\"payload\\":\\"{\\\\\\"thread_fbid\\\\\\":1594581527264656,\\\\\\"last_read_watermark\\\\\\":1780070888819,\\\\\\"force_upsert\\\\\\":0,\\\\\\"metadata_only\\\\\\":0,\\\\\\"preview_only\\\\\\":0}\\",\\"queue_name\\":\\"1594581527264656\\",\\"task_id\\":239}],\\"version_id\\":\\"27029912679952307\\"}","request_id":108,"type":3}`, 'utf8'));

const facebookBareBridgeReadReceipt = [{
    label: 'markThreadAsRead',
    thread_key: { thread_fbid: 'redacted-thread' },
    readReceipt: true
}];

const facebookMixedBridgeReadReceiptBatch = [
    {
        label: 'openThreadHistory',
        thread_key: { thread_fbid: 'redacted-thread' },
        queue_name: 'redacted-thread',
        task_id: 'history-task',
        cursor: 'redacted-cursor'
    },
    {
        label: 'markThreadAsRead',
        thread_key: { thread_fbid: 'redacted-thread' },
        readReceipt: true
    },
    {
        label: 'hydrateOlderMessages',
        parent_thread_key: 'redacted-thread',
        queue_name: 'redacted-thread',
        task_id: 'hydrate-task',
        direction: 'older'
    }
];

const facebookTargetlessBridgeReadReceiptBatch = [
    {
        label: 'openThreadHistory',
        queue_name: 'redacted-history',
        task_id: 'history-task',
        cursor: 'redacted-cursor'
    },
    {
        label: 'markThreadAsRead',
        source: 'mini_chat',
        readReceipt: true
    },
    {
        label: 'hydrateOlderMessages',
        queue_name: 'redacted-history',
        task_id: 'older-history-task',
        direction: 'older'
    },
    {
        label: 'presencePing',
        actor: 'viewer'
    },
    {
        label: 'bridgeBatchFlush',
        task_id: 'flush-task'
    }
];

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

const facebookGraphQLShortSendWithReadMetadata = `fb_api_req_friendly_name=CometMessengerSendMessageMutation&doc_id=redacted-doc&variables=${encodeURIComponent(JSON.stringify({
    input: {
        thread_key: { thread_fbid: 'redacted-thread' },
        offline_threading_id: 'redacted-offline-id',
        client_mutation_id: 'redacted-client-mutation',
        send_type: 1,
        message: { text: '1' },
        last_read_watermark_ts: 1779530000000,
        should_send_read_receipt: true
    }
}))}`;

const facebookGraphQLShortSendWithTypingMetadata = `fb_api_req_friendly_name=CometMessengerSendMessageMutation&doc_id=redacted-doc&variables=${encodeURIComponent(JSON.stringify({
    input: {
        thread_key: { thread_fbid: 'redacted-thread' },
        offline_threading_id: 'redacted-offline-id',
        client_mutation_id: 'redacted-client-mutation',
        send_type: 1,
        message: { text: '.' },
        composer: { is_typing: true },
        chatstate: 'typing_indicator'
    }
}))}`;

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
    document.hasFocus = () => page.nativeHasFocus !== undefined ? page.nativeHasFocus : true;
    if (page.facebookMessengerPopoverOpen || page.facebookMiniChatOpen || page.facebookMiniChatLoading) {
        document.querySelector = (selector) => {
            const text = String(selector || '');
            if (page.facebookMessengerPopoverOpen) {
                if (text.includes('aria-label="Messenger"')) return {};
                if (text.includes('aria-label="Chats"')) return {};
            }
            if (page.facebookMiniChatLoading) {
                if (text.includes('aria-label^="Messages in conversation"')) {
                    return {
                        innerText: 'Loading...',
                        textContent: 'Loading...'
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
    const workerConstructs = [];
    FakeBlob.instances = [];
    createdObjectUrls.length = 0;

    function Worker(scriptURL, options) {
        workerConstructs.push({ scriptURL, options });
    }
    Worker.prototype.postMessage = function (message, transfer) {
        workerPosts.push({ target: 'worker', message, transfer });
        return 'worker-sent';
    };

    function SharedWorker(scriptURL, options) {
        workerConstructs.push({ scriptURL, options, shared: true });
        this.port = {
            postMessage(message, transfer) {
                workerPosts.push({ target: 'shared-worker-port', message, transfer });
                return 'shared-worker-port-sent';
            }
        };
    }

    function MessagePort() { }
    MessagePort.prototype.postMessage = function (message, transfer) {
        workerPosts.push({ target: 'port', message, transfer });
        return 'port-sent';
    };

    const document = {
        readyState: 'complete',
        querySelector(selector) {
            const text = String(selector || '');
            if (page.facebookMessengerPopoverOpen) {
                if (text.includes('aria-label="Messenger"')) return {};
                if (text.includes('aria-label="Chats"')) return {};
            }
            if (page.facebookMiniChatOpen) {
                if (text.includes('aria-label="Minimize chat"')) return {};
                if (text.includes('aria-label="Close chat"')) return {};
                if (text.includes('role="textbox"')) return {};
                if (text.includes('aria-label^="Write to"')) return {};
                if (text.includes('aria-label^="Messages in conversation"')) return {};
                if (text.includes('aria-label^="Conversation titled"')) return {};
            }
            return null;
        }
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
        localStorage: { ghostifyDebug: '0', ghostifyMessengerObserve: '0' },
        document
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

function registerMessengerModuleWithDependencies(context, moduleName, dependencies, dependencyExports, factory) {
    let registeredModule;
    context.window.__d = function (_moduleName, _dependencies, moduleFactory) {
        const module = { exports: {} };
        const localRequire = (name) => dependencyExports[name] || {};
        moduleFactory(null, localRequire, localRequire, localRequire, module, module.exports);
        registeredModule = module;
        return module;
    };

    const result = context.window.__d(moduleName, dependencies, factory);
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

function decodeBridgeBytes(value) {
    assert.ok(ArrayBuffer.isView(value), 'expected a typed-array bridge payload');
    return new TextDecoder().decode(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
}

function getLatestWorkerBootstrapSource(context) {
    const blob = context.createdObjectUrls[context.createdObjectUrls.length - 1]?.blob;
    assert.ok(blob, 'expected a worker bootstrap blob to be created');
    return blob.parts.join('');
}

function stripModuleBootstrapImport(bootstrapSource) {
    return String(bootstrapSource || '').replace(/\n(?:await\s+|void\s+)?import\([\s\S]*$/, '\n');
}

function runWorkerBootstrap(bootstrapSource, wsBody, wsUrl = 'wss://edge-chat.facebook.com/chat?region=redacted') {
    const sent = [];
    const workerContext = {
        TextDecoder,
        ArrayBuffer,
        Uint8Array,
        URLSearchParams,
        importScripts() { }
    };

    class WorkerFakeWebSocket {
        constructor(url) {
            this.url = url;
        }

        send(data) {
            sent.push({ url: this.url, data });
            return 'worker-ws-sent';
        }
    }

    workerContext.self = workerContext;
    workerContext.WebSocket = WorkerFakeWebSocket;
    vm.runInNewContext(bootstrapSource, workerContext, { filename: 'ghostify-worker-bootstrap.js' });
    const socket = new workerContext.WebSocket(wsUrl);
    const result = socket.send(wsBody);
    return { result, sent };
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
    fetchWindow.localStorage.ghostifyDebug = '1';
    fetchWindow.localStorage.ghostifyMessengerObserve = '1';
    fetchWindow.__GHOSTIFY_RESET_CAPTURE__('network-sanitize-report-test');

    assert.strictEqual(await fetchOutcome(fetchWindow, messengerBatchedSendWithReadReceipt), 'allowed');
    assert.strictEqual(fetchWindow.fetchCalls.length, 1);
    const forwardedFetch = JSON.parse(fetchWindow.fetchCalls[0].init.body);
    assert.deepStrictEqual(
        forwardedFetch.tasks.map(task => task.label),
        ['send_message'],
        'Fetch send batches should preserve the send task and remove bundled read receipts'
    );
    const report = JSON.parse(fetchWindow.__GHOSTIFY_REPORT__());
    assert.strictEqual(
        report.sanitizedNetworkMessages,
        1,
        'network reports must include sanitized network counters for live Facebook send diagnostics'
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

async function testFacebookGraphQLShortSendsWithPrivacyMetadataAreAllowed() {
    const facebookWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });

    assert.strictEqual(
        await fetchOutcomeAt(facebookWindow, '/api/graphql/', facebookGraphQLShortSendWithReadMetadata),
        'allowed',
        'Facebook short message sends with bundled read metadata must not be blocked as seen'
    );
    assert.strictEqual(
        await fetchOutcomeAt(facebookWindow, '/api/graphql/', facebookGraphQLShortSendWithTypingMetadata),
        'allowed',
        'Facebook short message sends with bundled typing metadata must not be blocked as typing'
    );
    assert.strictEqual(
        xhrSendAt(facebookWindow, '/api/graphql/', facebookGraphQLShortSendWithReadMetadata, 'POST').result,
        'sent',
        'Facebook XHR short message sends with bundled read metadata must still send'
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

function testFacebookPatchMixedSendTypingBatchPreservesSend() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/messages/t/redacted-thread',
        href: 'https://www.facebook.com/messages/t/redacted-thread'
    });
    const outcome = workerOutcome(context, JSON.parse(messengerBatchedSendWithTyping));

    assert.strictEqual(outcome.result, 'worker-sent');
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);

    const forwarded = parseForwardedMessage(outcome.post);
    assert.strictEqual(forwarded.tasks.length, 1);
    assert.strictEqual(forwarded.tasks[0].label, 'send_message');
}

function testFacebookMiniChatSecureSendWithAlternateTargetsIsForwarded() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const message = {
        issue_new_task: true,
        tasks: [{
            label: 'send_message',
            queue_name: 'messenger_send_message',
            payload: {
                target_id: 'redacted-user',
                other_user_fbid: 'redacted-user',
                open_message_thread_key: 'redacted-open-thread',
                armadillo_thread_key: 'redacted-open-thread',
                send_type: 1,
                offline_threading_id: 'redacted-offline-id',
                message: { text: '1' },
                should_send_read_receipt: true,
                chatstate: 'typing_indicator'
            }
        }]
    };
    const outcome = workerOutcome(context, message);

    assert.strictEqual(
        outcome.result,
        'worker-sent',
        'Facebook mini-chat secure sends with alternate thread targets must not be dropped as typing'
    );
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);

    const forwarded = parseForwardedMessage(outcome.post);
    assert.strictEqual(forwarded.tasks.length, 1);
    assert.strictEqual(forwarded.tasks[0].label, 'send_message');
    assert.strictEqual(forwarded.tasks[0].payload.message.text, '1');
}

function testFacebookMiniChatMixedSendTypingBridgeFrameDoesNotEnterTypingSanitizer() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const message = {
        issue_new_task: true,
        tasks: [{
            label: '46',
            queue_name: 'redacted-user',
            payload: JSON.stringify({
                other_user_id: 'redacted-user',
                offline_threading_id: 'redacted-offline-id',
                send_type: 1,
                message: { text: 'a' }
            })
        }, {
            label: 'sendChatStateFromComposer',
            queue_name: 'redacted-user',
            payload: JSON.stringify({
                other_user_id: 'redacted-user',
                chatstate: 'typing_indicator',
                send_type: 'typing'
            })
        }]
    };
    const outcome = workerOutcome(context, message);

    assert.strictEqual(
        outcome.result,
        'worker-sent',
        'Facebook mixed send/typing bridge frames must forward instead of entering the typing sanitizer'
    );
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);
    assert.strictEqual(
        outcome.sanitized,
        0,
        'mixed send/typing frames should not be rewritten when preserving the send requires native frame shape'
    );
    const forwarded = parseForwardedMessage(outcome.post);
    assert.strictEqual(forwarded.tasks.length, 2);
    assert.strictEqual(forwarded.tasks[0].label, '46');
    assert.strictEqual(forwarded.tasks[1].label, 'sendChatStateFromComposer');
}

async function testFacebookSecureEncryptedDirectRecipientSendsAreAllowed() {
    const facebookWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });
    const variables = encodeURIComponent(JSON.stringify({
        input: {
            other_user_id: 'redacted-user',
            otid: 'redacted-otid',
            send_type: 1,
            encrypted_message: 'redacted-ciphertext',
            should_send_read_receipt: true,
            last_read_watermark_ts: 1780070888819
        }
    }));
    const graphQlSend = `fb_api_req_friendly_name=MessengerSendMessageMutation&variables=${variables}`;

    assert.strictEqual(
        await fetchOutcomeAt(facebookWindow, '/api/graphql/', graphQlSend),
        'allowed',
        'Facebook encrypted direct-recipient GraphQL sends must not be replaced as read receipts'
    );

    const miniChatContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const bridgeSend = {
        issue_new_task: true,
        tasks: [{
            label: '46',
            queue_name: 'redacted-user',
            payload: JSON.stringify({
                other_user_id: 'redacted-user',
                offline_threading_id: 'redacted-otid',
                send_type: 1,
                encrypted_message: 'redacted-ciphertext'
            })
        }, {
            label: 'sendChatStateFromComposer',
            payload: JSON.stringify({
                other_user_id: 'redacted-user',
                chatstate: 'typing_indicator',
                send_type: 'typing'
            })
        }]
    };
    const outcome = workerOutcome(miniChatContext, bridgeSend);

    assert.strictEqual(
        outcome.result,
        'worker-sent',
        'Facebook encrypted direct-recipient bridge sends bundled with typing must preserve the send task'
    );
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);
    assert.strictEqual(outcome.sanitized, 0);
    const forwarded = parseForwardedMessage(outcome.post);
    assert.strictEqual(forwarded.tasks.length, 2);
    assert.strictEqual(forwarded.tasks[0].label, '46');
    assert.strictEqual(forwarded.tasks[1].label, 'sendChatStateFromComposer');
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

async function testFacebookSecureTypingStateModulesPreserveReturnContract() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const calls = [];
    const ack = { ok: true, armadillo_thread_key: 'redacted-armadillo-thread' };
    const module = registerMessengerModule(
        context,
        'MAWSecureTypingState',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function secureTypingState(payload) {
                calls.push(payload);
                return Promise.resolve(ack);
            };
        }
    );

    const result = module.exports.default({
        armadillo_thread_key: 'redacted-armadillo-thread',
        offline_threading_id: 'redacted-offline-id'
    });

    assert.strictEqual(
        typeof result?.then,
        'function',
        'Facebook MAW secure typing-state modules must keep promise-like return values for protected chat send state'
    );
    assert.strictEqual(await result, ack);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_TYPING_EXPORT_CALLS__ || 0, 0);

    const typingCalls = [];
    const typingModule = registerMessengerModule(
        makeMessengerPatchPage(),
        'LSSendTypingIndicator',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function sendTypingIndicator(payload) {
                typingCalls.push(payload);
                return 'typing-sent';
            };
        }
    );
    assert.strictEqual(
        typingModule.exports.default({
            thread_key: { thread_fbid: 'redacted-thread' },
            chatstate: 'typing_indicator',
            send_type: 'typing'
        }),
        undefined,
        'explicit typing indicator modules must still be blocked'
    );
    assert.strictEqual(typingCalls.length, 0);
}

async function testFacebookMawSecureTypingStateDependenciesPreserveSecureSend() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const dependencyCalls = [];
    const dependencyExports = {
        LSSendTypingIndicator: {
            default(payload) {
                dependencyCalls.push({ module: 'typing', payload });
                return Promise.resolve('secure-send-state-ok');
            }
        },
        LSUpdateThreadReadWatermark: {
            default(payload) {
                dependencyCalls.push({ module: 'read', payload });
                return 'local-state-ok';
            }
        }
    };
    const module = registerMessengerModuleWithDependencies(
        context,
        'MAWSecureTypingState',
        ['LSSendTypingIndicator', 'LSUpdateThreadReadWatermark'],
        dependencyExports,
        function (_a, require, _c, _d, moduleObject) {
            moduleObject.exports.default = async function secureTypingState(payload) {
                await require('LSSendTypingIndicator').default(payload);
                require('LSUpdateThreadReadWatermark').default(payload);
                return 'secure-send-ok';
            };
        }
    );
    const secureSendPayload = {
        armadillo_thread_key: 'redacted-armadillo-thread',
        offline_threading_id: 'redacted-offline-id',
        send_type: 1,
        encrypted_message: 'redacted-ciphertext',
        last_read_watermark: 1779530000000,
        should_send_read_receipt: false
    };

    assert.strictEqual(await module.exports.default(secureSendPayload), 'secure-send-ok');
    assert.deepStrictEqual(
        dependencyCalls,
        [
            { module: 'typing', payload: secureSendPayload },
            { module: 'read', payload: secureSendPayload }
        ],
        'MAW secure-send dependencies must receive the original payload and preserve their return contracts'
    );
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_TYPING_EXPORT_CALLS__ || 0, 0);
    assert.strictEqual(context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0, 0);
}

async function testFacebookMiniChatComposerSendDependenciesPreserveSecureSend() {
    for (const page of [{
        label: 'Facebook mini-chat',
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    }, {
        label: 'Facebook MAW proxy',
        hostname: 'www.fbsbx.com',
        pathname: '/maw_proxy_page/',
        search: '?__cci=redacted',
        href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
    }]) {
        const context = makeMessengerPatchPage({}, page);
        const dependencyCalls = [];
        const dependencyExports = {
            LSSendTypingIndicator: {
                default(payload) {
                    dependencyCalls.push({ module: 'typing', payload });
                    return Promise.resolve('secure-send-state-ok');
                }
            },
            LSUpdateThreadReadWatermark: {
                default(payload) {
                    dependencyCalls.push({ module: 'read', payload });
                    return 'local-send-state-ok';
                }
            }
        };
        const module = registerMessengerModuleWithDependencies(
            context,
            'MWChatComposerSendMessageAction',
            ['LSSendTypingIndicator', 'LSUpdateThreadReadWatermark'],
            dependencyExports,
            function (_a, require, _c, _d, moduleObject) {
                moduleObject.exports.default = async function sendMessage(payload) {
                    const typingResult = await require('LSSendTypingIndicator').default(payload);
                    const readResult = require('LSUpdateThreadReadWatermark').default(payload);
                    return { typingResult, readResult };
                };
            }
        );
        const secureSendPayload = {
            open_message_thread_key: 'redacted-open-thread',
            armadillo_thread_key: 'redacted-armadillo-thread',
            offline_threading_id: 'redacted-offline-id',
            client_message_id: 'redacted-client-message-id',
            send_type: 1,
            encrypted_payload: 'redacted-ciphertext',
            should_send_read_receipt: false,
            last_read_watermark: 1779530000000
        };

        assert.deepStrictEqual(await module.exports.default(secureSendPayload), {
            typingResult: 'secure-send-state-ok',
            readResult: 'local-send-state-ok'
        }, `${page.label} composer send dependencies must preserve secure-send return values`);
        assert.deepStrictEqual(
            dependencyCalls,
            [
                { module: 'typing', payload: secureSendPayload },
                { module: 'read', payload: secureSendPayload }
            ],
            `${page.label} send modules must receive original secure-send dependency payloads`
        );
        assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_TYPING_EXPORT_CALLS__ || 0, 0);
        assert.strictEqual(context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0, 0);
    }
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
    assert.strictEqual(
        calls[0].last_read_watermark,
        SAFE_READ_WATERMARK,
        'Facebook normal message-thread local read modules must receive a stale read watermark so local UI stays unread'
    );
    assert.strictEqual(calls[0].readReceiptMutation, null);
    assert.strictEqual(
        context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
        1,
        'Facebook normal message-thread local read modules must increment sanitization'
    );
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 0);
}

function testFacebookFeedMiniChatLocalReadModulesSanitizeReadReceiptsWithoutBlockingHistoryLoading() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const calls = [];
    const module = registerMessengerModule(
        context,
        'LSUpdateThreadReadWatermark',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (payload) {
                calls.push(payload);
                return 'feed-mini-chat-read-updated';
            };
        }
    );
    const normalReadPayload = {
        thread_key: { thread_fbid: 'redacted-thread' },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
        readReceiptMutation: { should_send_read_receipt: true }
    };

    assert.strictEqual(module.exports.default(normalReadPayload), 'feed-mini-chat-read-updated');
    assert.strictEqual(calls.length, 1);
    assert.notStrictEqual(
        calls[0],
        normalReadPayload,
        'Facebook feed mini-chat local read modules must receive a sanitized clone while still calling the hydrator'
    );
    assert.deepStrictEqual(calls[0].thread_key, normalReadPayload.thread_key);
    assert.strictEqual(
        calls[0].last_read_watermark,
        SAFE_READ_WATERMARK,
        'Facebook feed mini-chat local read modules must receive a stale read watermark so the real unread UI remains'
    );
    assert.strictEqual(calls[0].should_send_read_receipt, false);
    assert.strictEqual(calls[0].readReceiptMutation, null);
    assert.strictEqual(context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0, 1);
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 0);
}

function testFacebookFeedMiniChatStaleLocalReadModulesSanitizeReadReceiptsWithoutBlockingHistoryLoading() {
    const page = {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: false
    };
    const context = makeMessengerPatchPage({}, page);
    const calls = [];
    const module = registerMessengerModule(
        context,
        'LSUpdateThreadReadWatermark',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (payload) {
                calls.push(payload);
                return 'feed-mini-chat-read-updated';
            };
        }
    );
    const normalReadPayload = {
        thread_key: { thread_fbid: 'redacted-thread' },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
        readReceiptMutation: { should_send_read_receipt: true }
    };

    page.facebookMiniChatOpen = true;

    assert.strictEqual(module.exports.default(normalReadPayload), 'feed-mini-chat-read-updated');
    assert.strictEqual(calls.length, 1);
    assert.notStrictEqual(
        calls[0],
        normalReadPayload,
        'Facebook feed mini-chat stale local read modules must receive a sanitized clone after the chat opens'
    );
    assert.deepStrictEqual(calls[0].thread_key, normalReadPayload.thread_key);
    assert.strictEqual(
        calls[0].last_read_watermark,
        SAFE_READ_WATERMARK,
        'Facebook feed mini-chat stale local read modules must receive a stale read watermark so the real unread UI remains'
    );
    assert.strictEqual(calls[0].should_send_read_receipt, false);
    assert.strictEqual(calls[0].readReceiptMutation, null);
    assert.strictEqual(context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0, 1);
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 0);
}

function testFacebookLocalReadModulesRewriteNestedWatermarksToPreserveUnreadUi() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const calls = [];
    const module = registerMessengerModule(
        context,
        'LSUpdateThreadReadWatermark',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (payload) {
                calls.push(payload);
                return 'feed-mini-chat-read-updated';
            };
        }
    );
    const normalReadPayload = {
        thread_key: { thread_fbid: 'redacted-thread' },
        last_read_watermark: 1779530000000,
        last_read_watermark_ts: '1779530000001',
        last_seen_time_ms: 1779530000002,
        read_watermark: '1779530000003',
        nested: {
            watermark_timestamp: 1779530000004
        },
        should_send_read_receipt: true,
        readReceiptMutation: { should_send_read_receipt: true }
    };

    assert.strictEqual(module.exports.default(normalReadPayload), 'feed-mini-chat-read-updated');
    assert.strictEqual(calls.length, 1);
    assert.notStrictEqual(
        calls[0],
        normalReadPayload,
        'Facebook local read modules must receive a clone when read UI state is neutralized'
    );
    assert.strictEqual(calls[0].last_read_watermark, SAFE_READ_WATERMARK);
    assert.strictEqual(calls[0].last_read_watermark_ts, SAFE_READ_WATERMARK_STRING);
    assert.strictEqual(calls[0].last_seen_time_ms, SAFE_READ_WATERMARK);
    assert.strictEqual(calls[0].read_watermark, SAFE_READ_WATERMARK_STRING);
    assert.strictEqual(calls[0].nested.watermark_timestamp, SAFE_READ_WATERMARK);
    assert.strictEqual(calls[0].should_send_read_receipt, false);
    assert.strictEqual(calls[0].readReceiptMutation, null);
    assert.strictEqual(
        normalReadPayload.last_read_watermark,
        1779530000000,
        'the original Facebook payload must not be mutated while neutralizing local read UI state'
    );
    assert.strictEqual(context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0, 1);
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 0);
}

function testFacebookFeedMiniChatLocalReadModulesPreserveSendAckStatePayloads() {
    for (const moduleName of ['LSUpdateThreadReadWatermark', 'LSMarkThreadRead', 'MWMarkThreadRead']) {
        const context = makeMessengerPatchPage({}, {
            hostname: 'www.facebook.com',
            pathname: '/',
            href: 'https://www.facebook.com/',
            facebookMiniChatOpen: true
        });
        const calls = [];
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function (payload) {
                    calls.push(payload);
                    return 'send-state-applied';
                };
            }
        );
        const sendAckPayload = {
            thread_key: { thread_fbid: 'redacted-thread' },
            offline_threading_id: 'redacted-offline-id',
            client_message_id: 'redacted-client-message-id',
            message_id: 'redacted-message-id',
            send_state: 'sent',
            delivery_receipt: true,
            last_read_watermark: 1779530000000,
            should_send_read_receipt: false
        };

        assert.strictEqual(
            module.exports.default(sendAckPayload),
            'send-state-applied',
            `${moduleName} send ack/state payloads must still call the original implementation`
        );
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(
            calls[0],
            sendAckPayload,
            `${moduleName} send ack/state payloads must not be cloned or stale-watermarked`
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
            0,
            `${moduleName} send ack/state payloads must not increment read sanitization`
        );
        assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 0);

        const pureReadPayload = {
            thread_key: { thread_fbid: 'redacted-thread' },
            last_read_watermark: 1779530000001,
            should_send_read_receipt: true,
            readReceiptMutation: { should_send_read_receipt: true }
        };

        assert.strictEqual(module.exports.default(pureReadPayload), 'send-state-applied');
        assert.strictEqual(calls.length, 2);
        assert.notStrictEqual(
            calls[1],
            pureReadPayload,
            `${moduleName} pure read payloads should still be sanitized for Hide Seen`
        );
        assert.strictEqual(calls[1].last_read_watermark, SAFE_READ_WATERMARK);
        assert.strictEqual(calls[1].should_send_read_receipt, false);
        assert.strictEqual(context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0, 1);
    }
}

function testFacebookFeedMiniChatLocalReadModulesPreservePendingSendStatePayloads() {
    for (const moduleName of ['LSUpdateThreadReadWatermark', 'LSMarkThreadRead', 'MWMarkThreadRead']) {
        const context = makeMessengerPatchPage({}, {
            hostname: 'www.facebook.com',
            pathname: '/',
            href: 'https://www.facebook.com/',
            facebookMiniChatOpen: true
        });
        const calls = [];
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function (payload) {
                    calls.push(payload);
                    return 'pending-send-state-applied';
                };
            }
        );
        const pendingSendPayload = {
            thread_key: { thread_fbid: 'redacted-thread' },
            offline_threading_id: 'redacted-offline-id',
            client_message_id: 'redacted-client-message-id',
            message: { text: '1' },
            send_type: 1,
            send_state: 'sending',
            status: 'Sending',
            last_read_watermark: 1779530000000,
            should_send_read_receipt: true
        };

        assert.strictEqual(
            module.exports.default(pendingSendPayload),
            'pending-send-state-applied',
            `${moduleName} pending send-state payloads must still call the original implementation`
        );
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(
            calls[0],
            pendingSendPayload,
            `${moduleName} pending send-state payloads must not be cloned or stale-watermarked`
        );
        assert.strictEqual(calls[0].last_read_watermark, 1779530000000);
        assert.strictEqual(calls[0].should_send_read_receipt, true);
        assert.strictEqual(
            context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
            0,
            `${moduleName} pending send-state payloads must not increment read sanitization`
        );
        assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 0);
    }
}

function testFacebookMessageRequestGraceLeavesLocalReadModulesUntouched() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });
    context.window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ = Date.now() + 15000;

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
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
        cursor: 'redacted-cursor'
    };

    assert.strictEqual(module.exports.default(requestHydrationPayload), 'request-hydrated');
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(
        calls[0],
        requestHydrationPayload,
        'Facebook message-request click grace must leave local request hydration payloads untouched before URL settles'
    );
    assert.strictEqual(context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0, 0);
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 0);
}

function testFacebookMessageRequestGraceBypassesStaleLocalReadWrappersAtCallTime() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
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
    const normalReadPayload = {
        thread_key: { thread_fbid: 'redacted-thread' },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
        readReceiptMutation: { should_send_read_receipt: true }
    };
    assert.strictEqual(module.exports.default(normalReadPayload), 'request-hydrated');
    assert.notStrictEqual(
        calls[0],
        normalReadPayload,
        'normal Facebook feed local read modules should still sanitize read receipt writes'
    );

    context.window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ = Date.now() + 15000;
    const requestHydrationPayload = {
        folder: 'message_requests',
        thread_key: { thread_fbid: 'redacted-thread' },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
        cursor: 'redacted-cursor'
    };

    assert.strictEqual(module.exports.default(requestHydrationPayload), 'request-hydrated');
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(
        calls[1],
        requestHydrationPayload,
        'stale local read wrappers must bypass sanitization during message-request click grace'
    );
    assert.strictEqual(context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0, 1);
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

function testFacebookEdgeChatRealtimeReadWatermarkFramesAreBlocked() {
    const window = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });
    const edgeChatUrl = 'wss://edge-chat.facebook.com/chat?region=redacted';

    assert.strictEqual(
        websocketOutcome(window, facebookWorkerEdgeChatReadWatermarkFrame, edgeChatUrl),
        'blocked',
        'Facebook edge-chat label 21 last_read_watermark_ts frames must be blocked'
    );
    assert.strictEqual(
        websocketOutcome(window, facebookWorkerEdgeChatLastSeenFrame, edgeChatUrl),
        'blocked',
        'Facebook edge-chat label 6 last_seen_time_ms frames must be blocked'
    );
    assert.strictEqual(
        websocketOutcome(window, facebookWorkerEdgeChatDeliveryFrame, edgeChatUrl),
        'allowed',
        'Facebook edge-chat delivery frames without read-watermark intent must still pass'
    );

    const lightspeedUrl = 'wss://gateway.facebook.com/ws/lightspeed';
    assert.strictEqual(
        websocketOutcome(window, facebookWorkerEdgeChatReadWatermarkFrame, lightspeedUrl),
        'blocked',
        'Facebook lightspeed label 21 last_read_watermark_ts frames must be blocked'
    );
    assert.strictEqual(
        websocketOutcome(window, facebookWorkerEdgeChatLastSeenFrame, lightspeedUrl),
        'blocked',
        'Facebook lightspeed label 6 last_seen_time_ms frames must be blocked'
    );
    assert.strictEqual(
        websocketOutcome(window, facebookWorkerEdgeChatDeliveryFrame, lightspeedUrl),
        'allowed',
        'Facebook lightspeed delivery frames without read-watermark intent must still pass'
    );
}

function testFacebookEdgeChatMixedShortSendTypingFrameIsAllowed() {
    const edgeChatUrl = 'wss://edge-chat.facebook.com/chat?region=redacted';
    const lightspeedUrl = 'wss://gateway.facebook.com/ws/lightspeed';
    const pages = [{
        label: 'Facebook top page',
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    }, {
        label: 'Facebook MAW proxy',
        hostname: 'www.fbsbx.com',
        pathname: '/maw_proxy_page/',
        search: '?__cci=redacted',
        href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
    }];

    for (const page of pages) {
        for (const url of [edgeChatUrl, lightspeedUrl]) {
            const window = makeGhostPage(page);
            const outcome = websocketSend(window, facebookEdgeChatMixedOpaqueSendTypingFrame, url);

            assert.strictEqual(
                outcome.result,
                'sent',
                `${page.label} mixed mini-chat send/typing frames must not be dropped as typing`
            );
            assert.strictEqual(outcome.socket.sent.length, 1);
            assert.deepStrictEqual(
                Array.from(outcome.socket.sent[0]),
                Array.from(facebookEdgeChatMixedOpaqueSendTypingFrame),
                `${page.label} mixed mini-chat send/typing frames must forward byte-for-byte`
            );
        }
    }
}

function testFacebookEdgeChatQuickReactionSendTypingFrameIsAllowed() {
    for (const page of [
        {
            label: 'Facebook top page',
            hostname: 'www.facebook.com',
            pathname: '/',
            href: 'https://www.facebook.com/'
        },
        {
            label: 'Facebook MAW proxy',
            hostname: 'www.fbsbx.com',
            pathname: '/maw_proxy_page/',
            search: '?__cci=redacted',
            href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
        }
    ]) {
        const window = makeGhostPage(page);
        const edgeChatUrl = 'wss://edge-chat.facebook.com/chat?region=redacted';
        const lightspeedUrl = 'wss://gateway.facebook.com/ws/lightspeed';

        assert.strictEqual(
            websocketOutcome(window, facebookEdgeChatQuickReactionSendTypingFrame, edgeChatUrl),
            'allowed',
            `${page.label} quick-like/reaction send frames must not be dropped as typing`
        );
        assert.strictEqual(
            websocketOutcome(window, facebookEdgeChatQuickReactionSendTypingFrame, lightspeedUrl),
            'allowed',
            `${page.label} quick-like/reaction lightspeed frames must not be dropped as typing`
        );
    }
}

function testFacebookThreadOpenRealtimeLoadsStayAllowed() {
    const lightspeedUrl = 'wss://gateway.facebook.com/ws/lightspeed';
    const normalWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });
    assert.strictEqual(
        websocketOutcome(normalWindow, facebookFeedThreadOpenFullFetchFrame, lightspeedUrl),
        'allowed',
        'Facebook full-thread realtime loads must stay allowed during normal browsing'
    );
    assert.strictEqual(
        websocketOutcome(normalWindow, facebookFeedArmadilloOpenThreadFrame, lightspeedUrl),
        'allowed',
        'Facebook Armadillo open-thread realtime loads must stay allowed during normal browsing'
    );

    const focusedWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMessengerPopoverOpen: true
    });
    assert.strictEqual(
        websocketOutcome(focusedWindow, facebookFeedThreadOpenFullFetchFrame, lightspeedUrl),
        'allowed',
        'Facebook full-thread realtime loads must remain allowed so unread mini-chats can render history'
    );
    assert.strictEqual(
        websocketOutcome(focusedWindow, facebookFeedArmadilloOpenThreadFrame, lightspeedUrl),
        'allowed',
        'Facebook Armadillo open-thread realtime loads must remain allowed so unread mini-chats can render history'
    );
}

function testFacebookGenericLightspeedHistoryWithReadMetadataStaysAllowed() {
    const lightspeedUrl = 'wss://gateway.facebook.com/ws/lightspeed';
    const window = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });

    assert.strictEqual(
        websocketOutcome(window, facebookFeedThreadOpenWithReadMetadataFrame, lightspeedUrl),
        'allowed',
        'Generic Facebook thread-history frames must not be blocked just because they carry queue_name, task_id, and read metadata'
    );
}

function testFacebookBareBridgeReadReceiptsAreBlocked() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });
    context.window.localStorage.ghostifyDebug = '1';
    context.window.localStorage.ghostifyMessengerObserve = '1';
    context.window.__GHOSTIFY_RESET_CAPTURE__('bare-bridge-read-drop-test');

    const outcome = workerOutcome(context, facebookBareBridgeReadReceipt);
    assert.strictEqual(
        outcome.result,
        undefined,
        'Facebook bare bridge markThreadAsRead/readReceipt payloads with only a thread target must be dropped'
    );
    assert.strictEqual(
        outcome.postCount,
        0,
        'bare read-receipt bridge commands must not be forwarded to the worker'
    );
    assert.strictEqual(outcome.blocked, 1);

    const report = JSON.parse(context.window.__GHOSTIFY_REPORT__());
    const dropOutcome = report.observations.find(event =>
        event.transport === 'worker.postMessage' &&
        String(event.action || '').startsWith('drop') &&
        event.blockType === 'MSG_SEEN'
    );
    assert.ok(dropOutcome, 'read bridge drop outcomes must be reported for live debugging');
    assert.ok(dropOutcome.dataShape, 'drop outcomes must include redacted postMessage shape metadata');
    assert.ok(Array.isArray(dropOutcome.terms), 'drop outcomes must include redacted matching terms');
    assert.ok(dropOutcome.terms.includes('markthreadasread'));
    assert.strictEqual(dropOutcome.flags?.hasReadReceipt, true);
    assert.ok(Array.isArray(dropOutcome.callSite), 'drop outcomes must include a sanitized call site');
    assert.strictEqual(
        report.blockedWorkerMessages,
        1,
        'patch reports must include blocked worker counters for live Facebook send diagnostics'
    );
    assert.strictEqual(
        report.sanitizedSeenBridgeMessages,
        0,
        'patch reports must include sanitized seen bridge counters for live Facebook send diagnostics'
    );
    assert.strictEqual(
        report.messengerUnsafeBlocksSkipped,
        0,
        'patch reports must include Messenger unsafe-forward counters for live Facebook send diagnostics'
    );
    assert.strictEqual(
        report.unsafeTransferBlocksSkipped,
        0,
        'patch reports must include unsafe transfer counters for live Facebook send diagnostics'
    );
}

function testFacebookMixedBridgeReadReceiptBatchesAreSanitizedNotDropped() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });

    const outcome = portOutcome(context, facebookMixedBridgeReadReceiptBatch);
    assert.strictEqual(
        outcome.result,
        'port-sent',
        'mixed Facebook bridge batches must still reach the worker so older mini-chat history can load'
    );
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);
    assert.strictEqual(outcome.sanitizedSeen, 1);
    assert.ok(Array.isArray(outcome.post.message));
    assert.strictEqual(
        outcome.post.message.length,
        2,
        'only the read-receipt item should be removed from a mixed local bridge batch'
    );
    assert.strictEqual(outcome.post.message[0], facebookMixedBridgeReadReceiptBatch[0]);
    assert.strictEqual(outcome.post.message[1], facebookMixedBridgeReadReceiptBatch[2]);
}

function testFacebookTargetlessBridgeReadReceiptBatchesAreSanitizedBeforeSharedWorkerStateUpdates() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });

    const outcome = portOutcome(context, facebookTargetlessBridgeReadReceiptBatch);
    assert.strictEqual(
        outcome.result,
        'port-sent',
        'targetless Facebook bridge batches must still reach the worker so mini-chat history can load'
    );
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);
    assert.strictEqual(outcome.sanitizedSeen, 1);
    assert.ok(Array.isArray(outcome.post.message));
    assert.strictEqual(
        outcome.post.message.length,
        4,
        'only the targetless local read-receipt command should be removed from a mixed bridge batch'
    );
    assert.strictEqual(outcome.post.message[0], facebookTargetlessBridgeReadReceiptBatch[0]);
    assert.strictEqual(outcome.post.message[1], facebookTargetlessBridgeReadReceiptBatch[2]);
    assert.strictEqual(outcome.post.message[2], facebookTargetlessBridgeReadReceiptBatch[3]);
    assert.strictEqual(outcome.post.message[3], facebookTargetlessBridgeReadReceiptBatch[4]);
}

function testFacebookBridgeLightspeedReadFramesAreSanitizedBeforeSharedWorkerStateUpdates() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });

    const workerWatermark = workerOutcome(context, facebookWorkerEdgeChatReadWatermarkFrame);
    assert.strictEqual(
        workerWatermark.result,
        'worker-sent',
        'Worker bridge label 21 frames must still reach Facebook so old mini-chat history can finish loading'
    );
    assert.strictEqual(workerWatermark.postCount, 1);
    assert.strictEqual(workerWatermark.blocked, 0);
    assert.strictEqual(workerWatermark.sanitizedSeen, 1);
    assert.notStrictEqual(workerWatermark.post.message, facebookWorkerEdgeChatReadWatermarkFrame);
    assert.ok(ArrayBuffer.isView(workerWatermark.post.message));
    assert.match(decodeBridgeBytes(workerWatermark.post.message), /last_read_watermark_ts\\+":1000000000000/);
    assert.doesNotMatch(decodeBridgeBytes(workerWatermark.post.message), /last_read_watermark_ts\\+":1780070888819/);

    const portLastSeen = portOutcome(context, facebookWorkerEdgeChatLastSeenFrame);
    assert.strictEqual(
        portLastSeen.result,
        'port-sent',
        'MessagePort bridge label 6 frames must still reach Facebook so old mini-chat history can finish loading'
    );
    assert.strictEqual(portLastSeen.postCount, 2);
    assert.strictEqual(portLastSeen.blocked, 0);
    assert.strictEqual(portLastSeen.sanitizedSeen, 2);
    assert.notStrictEqual(portLastSeen.post.message, facebookWorkerEdgeChatLastSeenFrame);
    assert.ok(ArrayBuffer.isView(portLastSeen.post.message));
    assert.match(decodeBridgeBytes(portLastSeen.post.message), /last_seen_time_ms\\+":1000000000000/);
    assert.doesNotMatch(decodeBridgeBytes(portLastSeen.post.message), /last_seen_time_ms\\+":1780070890716/);

    const delivery = workerOutcome(context, facebookWorkerEdgeChatDeliveryFrame);
    assert.strictEqual(
        delivery.result,
        'worker-sent',
        'Delivery frames without read-watermark intent must still reach the shared worker'
    );
    assert.strictEqual(delivery.postCount, 3);
    assert.strictEqual(delivery.blocked, 0);
    assert.strictEqual(delivery.sanitizedSeen, 2);
}

function testFacebookBridgeThreadOpenFramesStayAllowed() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });

    const fullFetch = workerOutcome(context, facebookFeedThreadOpenFullFetchFrame);
    assert.strictEqual(
        fullFetch.result,
        'worker-sent',
        'Facebook full-thread bridge loads must stay allowed so unread mini-chat history can render'
    );
    assert.strictEqual(fullFetch.blocked, 0);

    const metadataFetch = portOutcome(context, facebookFeedThreadOpenWithReadMetadataFrame);
    assert.strictEqual(
        metadataFetch.result,
        'port-sent',
        'Facebook history bridge frames with queue_name/task_id/read metadata must stay allowed unless they are label 6 or label 21 read writes'
    );
    assert.strictEqual(metadataFetch.blocked, 0);
}

function testFacebookWorkersKeepNativeScriptUrls() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });

    const worker = new context.Worker('https://www.facebook.com/rsrc.php/v4/yx/r/redacted-worker.js');
    assert.ok(worker, 'worker construction should still return a worker');
    assert.strictEqual(
        context.workerConstructs[0].scriptURL,
        'https://www.facebook.com/rsrc.php/v4/yx/r/redacted-worker.js',
        'Facebook Worker script URLs must stay native so realtime/chat loaders keep their original worker identity'
    );

    const sharedWorker = new context.SharedWorker(
        'https://www.facebook.com/static_resources/webworker/init_script/?worker_type=MODULE',
        { type: 'module', name: 'redacted-shared-worker' }
    );

    assert.ok(sharedWorker.port, 'test SharedWorker should expose a port like the browser surface');
    assert.strictEqual(context.workerConstructs.length, 2);
    assert.strictEqual(context.workerConstructs[1].shared, true);
    assert.strictEqual(
        context.workerConstructs[1].scriptURL,
        'https://www.facebook.com/static_resources/webworker/init_script/?worker_type=MODULE',
        'Facebook SharedWorker URLs must not be replaced with per-page blob URLs'
    );
    assert.strictEqual(
        context.workerConstructs[1].options?.type,
        'module',
        'SharedWorker module options must be preserved while leaving the native script URL intact'
    );
}

async function testNonMawFbsbxPagesAreNotTreatedAsMessenger() {
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
    assert.notStrictEqual(
        window.__GHOSTIFY_GHOST_HOOKED__,
        true,
        'non-MAW fbsbx pages must not install the main Ghostify hook set'
    );
    assert.strictEqual(
        window.document.hasFocus(),
        true,
        'non-MAW fbsbx pages must not get Messenger focus spoofing'
    );
    assert.strictEqual(
        await fetchOutcome(window, messengerReadReceipt),
        'allowed',
        'non-MAW fbsbx pages must not install Ghostify fetch privacy hooks'
    );
    assert.strictEqual(
        websocketOutcome(window, facebookWorkerEdgeChatLastSeenFrame),
        'allowed',
        'non-MAW fbsbx pages must not install Ghostify WebSocket privacy hooks'
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
        ['www.facebook.com', '/', true, 'General Facebook feed startup must keep native focus during the short restored-chat boot grace'],
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

function testFacebookFeedMessengerSurfacesSpoofFocusPassivelyForReadPrivacyAndLoaders() {
    const popoverWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMessengerPopoverOpen: true
    });
    assert.strictEqual(
        popoverWindow.document.hasFocus(),
        false,
        'Facebook feed Messenger popover must report unfocused so an already-open chat does not send seen receipts'
    );
    assert.strictEqual(
        popoverWindow.document.visibilityState,
        'visible',
        'Facebook feed Messenger popover should keep native visibility so feed media and chat loaders can run'
    );
    assert.strictEqual(
        popoverWindow.document.hidden,
        false,
        'Facebook feed Messenger popover should not mark the whole feed hidden'
    );
    assert.strictEqual(
        countDeliveredFocusEvents(popoverWindow),
        4,
        'Facebook feed Messenger popover must not suppress focus events needed by mini-chat loaders'
    );

    const miniChatWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    assert.strictEqual(
        miniChatWindow.document.hasFocus(),
        false,
        'Facebook feed floating mini-chat must report unfocused while the purple header is open'
    );
    assert.strictEqual(
        miniChatWindow.document.visibilityState,
        'visible',
        'Facebook feed floating mini-chat should keep native visibility for chat history loaders'
    );
    assert.strictEqual(
        miniChatWindow.document.hidden,
        false,
        'Facebook feed floating mini-chat should not set document.hidden'
    );
    assert.strictEqual(
        countDeliveredFocusEvents(miniChatWindow),
        4,
        'Facebook feed floating mini-chat must still deliver focus events so old messages continue loading'
    );
}

function testFacebookFeedStartupKeepsNativeFocusBrieflyBeforePreloadedMiniChatDomExists() {
    const window = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });

    assert.strictEqual(
        window.document.hasFocus(),
        true,
        'Facebook feed startup must keep native focus briefly so restored mini-chat boot can hydrate before its DOM exists'
    );
    assert.strictEqual(
        window.document.visibilityState,
        'visible',
        'Facebook feed startup should keep native visibility so videos and chat history can load'
    );
    assert.strictEqual(window.document.hidden, false);
    assert.strictEqual(
        countDeliveredFocusEvents(window),
        4,
        'Facebook feed startup must still deliver focus events; only document.hasFocus is spoofed'
    );

    window.__GHOSTIFY_FACEBOOK_ROOT_NATIVE_UNTIL__ = Date.now() - 1;
    assert.strictEqual(
        window.document.hasFocus(),
        false,
        'Facebook feed startup grace must expire back to passive-unfocused privacy mode'
    );
}

function testFacebookRestoredMiniChatLoadingKeepsNativeFocusUntilHydrated() {
    const loadingWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatLoading: true
    });

    assert.strictEqual(
        loadingWindow.document.hasFocus(),
        true,
        'Facebook restored mini-chat loading surface must keep native focus until the thread hydrates'
    );
    assert.strictEqual(
        loadingWindow.document.visibilityState,
        'visible',
        'Restored mini-chat loading should keep native visibility so the history loader can finish'
    );
    assert.strictEqual(loadingWindow.document.hidden, false);
    assert.strictEqual(
        countDeliveredFocusEvents(loadingWindow),
        4,
        'Restored mini-chat loading must still deliver focus events to Facebook loaders'
    );

    const hydratedWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    assert.strictEqual(
        hydratedWindow.document.hasFocus(),
        false,
        'Facebook restored mini-chat must return to unfocused privacy mode after hydration'
    );
}

function testFacebookUnreadFeedMessageClicksKeepDocumentVisibleForThreadLoading() {
    const window = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMessengerPopoverOpen: true
    });
    window.__GHOSTIFY_FACEBOOK_ROOT_NATIVE_UNTIL__ = Date.now() - 1;
    assert.strictEqual(
        window.document.visibilityState,
        'visible',
        'Facebook feed Messenger popover should stay visible before selecting an unread conversation'
    );
    assert.strictEqual(
        window.document.hasFocus(),
        false,
        'Idle Facebook feed Messenger popover should stay unfocused for read privacy'
    );

    window.document.dispatchEvent({
        type: 'pointerdown',
        target: createRequestClickTarget({
            label: 'Jayy Zz Unread message: testing 17 · 1m'
        })
    });

    assert.strictEqual(
        window.document.visibilityState,
        'visible',
        'Opening an unread Facebook feed Messenger row must keep document visibility visible so history loads'
    );
    assert.strictEqual(window.document.hidden, false);
    assert.strictEqual(
        window.document.hasFocus(),
        true,
        'Opening a Facebook feed Messenger row needs a short native-focus grace so an already-restored mini-chat can hydrate'
    );
    assert.strictEqual(
        countDeliveredFocusEvents(window),
        4,
        'Opening a Facebook feed Messenger row must keep loader focus events flowing even while hasFocus is spoofed'
    );
    window.__GHOSTIFY_FACEBOOK_CHAT_OPEN_FOCUS_UNTIL__ = Date.now() - 1;
    assert.strictEqual(
        window.document.hasFocus(),
        false,
        'Facebook feed Messenger row click grace must expire back to passive-unfocused privacy mode'
    );
}

function testFacebookUnreadFeedMessageChildClicksKeepDocumentVisibleForThreadLoading() {
    const window = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMessengerPopoverOpen: true
    });
    window.__GHOSTIFY_FACEBOOK_ROOT_NATIVE_UNTIL__ = Date.now() - 1;
    const row = {
        parentElement: null,
        innerText: 'Jayy Zz Unread message: testing 18 · 1m',
        textContent: 'Jayy Zz Unread message: testing 18 · 1m',
        getAttribute() { return ''; },
        closest() { return this; }
    };
    const child = {
        parentElement: row,
        innerText: '',
        textContent: '',
        getAttribute() { return ''; },
        closest() { return this; }
    };

    window.document.dispatchEvent({
        type: 'pointerdown',
        target: child
    });

    assert.strictEqual(
        window.document.visibilityState,
        'visible',
        'Unread child clicks must not hide the page because hidden visibility stalls old-message loading'
    );
    assert.strictEqual(window.document.hidden, false);
    assert.strictEqual(
        window.document.hasFocus(),
        true,
        'Unread child clicks must open the same short native-focus grace for restored mini-chat hydration'
    );
    assert.strictEqual(
        countDeliveredFocusEvents(window),
        4,
        'Unread child clicks must not suppress focus events needed by history hydration'
    );
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

    for (const folder of ['pending_threads', 'filtered_threads', 'spam_threads']) {
        const facebookRequestAliasWindow = makeGhostPage({
            hostname: 'www.facebook.com',
            pathname: '/messages/t/redacted-thread',
            search: `?folder=${folder}`,
            href: `https://www.facebook.com/messages/t/redacted-thread?folder=${folder}`
        });
        assert.strictEqual(
            countDeliveredFocusEvents(facebookRequestAliasWindow),
            4,
            `Facebook ${folder} request alias routes must not suppress focus events needed by the request loader`
        );
    }

    const facebookProxyWindow = makeGhostPage({
        hostname: 'www.fbsbx.com',
        pathname: '/maw_proxy_page/',
        search: '?__cci=redacted',
        href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
    });
    assert.strictEqual(
        facebookProxyWindow.document.hasFocus(),
        false,
        'Facebook MAW proxy frames should still report unfocused for read privacy'
    );
    assert.strictEqual(
        facebookProxyWindow.document.visibilityState,
        'visible',
        'Facebook MAW proxy frames should keep native visibility so chat history can hydrate'
    );
    assert.strictEqual(facebookProxyWindow.document.hidden, false);
    assert.strictEqual(
        countDeliveredFocusEvents(facebookProxyWindow),
        4,
        'Facebook MAW proxy frames must pass focus events through so restored mini-chat history can hydrate'
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

function createNestedRequestClickTarget({ parentHref = '', parentLabel = '', childLabel = '' }) {
    const parent = createRequestClickTarget({
        href: parentHref,
        label: parentLabel
    });
    const child = createRequestClickTarget({
        href: '',
        label: childLabel
    });
    child.parentElement = parent;
    child.closest = function () {
        return this;
    };
    return child;
}

function createNestedConversationClickTargetWithRequestSibling({ rowLabel = '', containerLabel = '' }) {
    const container = createRequestClickTarget({
        href: '',
        label: containerLabel
    });
    const row = createRequestClickTarget({
        href: '/messages/t/redacted-thread',
        label: rowLabel
    });
    const child = createRequestClickTarget({
        href: '',
        label: ''
    });
    row.parentElement = container;
    child.parentElement = row;
    child.closest = function () {
        return this;
    };
    return child;
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

function testFacebookNestedMessageRequestClicksTemporarilyRestoreNativeFocus() {
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
        target: createNestedRequestClickTarget({
            parentLabel: 'New message requests From Princess Hannah Bermudez and others',
            childLabel: ''
        })
    });

    assert.strictEqual(
        facebookWindow.document.hasFocus(),
        true,
        'Facebook nested New message requests clicks must restore native focus before the SPA URL changes'
    );
    assert(
        facebookFocusSignals > 0,
        'Facebook nested New message requests clicks must deliver native focus/visibility signals for the request loader'
    );
    assert(
        Number(facebookWindow.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ || 0) > Date.now(),
        'Facebook nested New message requests clicks must open a short native transport grace window'
    );
}

function testFacebookNormalConversationClicksDoNotInheritSiblingMessageRequestText() {
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
        target: createNestedConversationClickTargetWithRequestSibling({
            rowLabel: 'Jayy Zz You: thumbs up 2d',
            containerLabel: 'New message requests From Princess Hannah Bermudez Jayy Zz You: thumbs up 2d'
        })
    });

    assert.strictEqual(
        facebookWindow.document.hasFocus(),
        false,
        'Normal Facebook conversation clicks must not inherit sibling Message requests text from a broad container'
    );
    assert.strictEqual(
        facebookFocusSignals,
        0,
        'Normal Facebook conversation clicks must not open request-loader focus grace from sibling request text'
    );
    assert.strictEqual(
        Number(facebookWindow.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ || 0) > Date.now(),
        false,
        'Normal Facebook conversation clicks must not activate message-request native grace'
    );
}

function testPopupMessengerSeenNoteExplainsLocalFacebookReadUi() {
    const popupHtml = fs.readFileSync('dist/popup.html', 'utf8');
    const popupCss = fs.readFileSync('dist/css/popup.css', 'utf8');
    const note = 'Ghostify is active. Facebook may make chats look read here. Refresh Facebook or Messenger before judging.';

    assert(
        popupHtml.includes(note),
        'Messenger/Facebook Hide Seen should explain Facebook local read UI in concise user-facing wording'
    );
    assert(
        popupHtml.includes(`data-tooltip="${note}"`),
        'Messenger/Facebook Hide Seen should use a custom tooltip so it appears immediately'
    );
    assert(
        !popupHtml.includes(' title='),
        'Messenger/Facebook Hide Seen should not use the delayed native title tooltip'
    );
    assert(
        !popupHtml.includes('sender-side') &&
        !popupHtml.includes('manual verification'),
        'Messenger/Facebook Hide Seen tooltip should avoid technical verification language'
    );
    assert(
        popupCss.includes('.info-icon::after') &&
        popupCss.includes('content: attr(data-tooltip);') &&
        popupCss.includes('white-space: normal;') &&
        popupCss.includes('transition: none;'),
        'Messenger/Facebook Hide Seen tooltip should wrap and appear without hover delay'
    );
}

function testPopupSupportLinksUseGuidedIssueForms() {
    const popupHtml = fs.readFileSync('dist/popup.html', 'utf8');
    const popupCss = fs.readFileSync('dist/css/popup.css', 'utf8');
    const popupJs = fs.readFileSync('dist/js/popup.js', 'utf8');
    const privacyPolicy = fs.readFileSync('PRIVACY.md', 'utf8');
    const websiteUrl = 'https://ghostify-extension.vercel.app/';
    const surveyBaseUrl = 'https://tally.so/r/D4W0Jq';
    const footerSurveyUrl = `${surveyBaseUrl}?source=popup_footer&amp;version=${pkg.version}`;
    const labsSurveyUrls = [
        `${surveyBaseUrl}?source=popup_labs&amp;feature=instagram_video_controls&amp;version=${pkg.version}`,
        `${surveyBaseUrl}?source=popup_labs&amp;feature=per_site_control_presets&amp;version=${pkg.version}`,
        `${surveyBaseUrl}?source=popup_labs&amp;feature=compatibility_alerts&amp;version=${pkg.version}`
    ];
    const directHelpFormUrl = 'https://github.com/Hendrizzzz/Ghostify/issues/new?template=help_feedback.yml';
    const surveyTooltip = 'Share which Labs ideas you want next. Do not include private messages.';
    const thanksTooltip = 'Helpful bug reports or ideas will be credited in release notes and on the website, with permission.';
    const directHelpPlaceholder = 'Example: On facebook.com, I clicked New message requests and it opened a blank chat page instead of the request list. I expected Ghostify to keep the real UI working while Seen stays blocked.';
    const issueTemplateFiles = [
        '.github/ISSUE_TEMPLATE/config.yml',
        '.github/ISSUE_TEMPLATE/bug_report.yml',
        '.github/ISSUE_TEMPLATE/feature_request.yml',
        '.github/ISSUE_TEMPLATE/feedback.yml',
        '.github/ISSUE_TEMPLATE/question.yml',
        '.github/ISSUE_TEMPLATE/help_feedback.yml'
    ];
    const issueTemplateNames = [
        'name: Report a bug',
        'name: Share an idea',
        'name: Share feedback',
        'name: Ask a question'
    ];

    assert(
        popupHtml.includes(`href="${websiteUrl}"`) &&
        popupHtml.includes('aria-label="Open the Ghostify website"'),
        'Popup brand should open the Ghostify website when clicked'
    );
    assert(
        popupHtml.includes(`href="${directHelpFormUrl}"`) &&
        popupHtml.includes('Help &amp; feedback') &&
        popupHtml.includes(`data-tooltip="${thanksTooltip}"`) &&
        !popupHtml.includes('issues/new/choose') &&
        !popupHtml.includes('Report issue'),
        'Popup should open one guided Help & feedback draft directly instead of the issue chooser'
    );
    assert(
        popupHtml.includes(`href="${footerSurveyUrl}"`) &&
        popupHtml.includes('Per-site Control Presets') &&
        popupHtml.includes(`data-tooltip="${surveyTooltip}"`),
        'Popup should include the Tally feature survey as a quiet Labs vote path'
    );
    assert(
        popupHtml.includes('class="footer-link survey-link"') &&
        popupHtml.includes('class="footer-link support-link"') &&
        popupHtml.includes('id="version-number"') &&
        popupCss.includes('.survey-link::after') &&
        popupCss.includes('left: -88px;') &&
        popupCss.includes('width: 220px;'),
        'Popup footer should keep the quiet version, Feature survey, and Help & feedback layout'
    );
    assert(
        popupCss.includes('.footer-link:hover::after') &&
        popupCss.includes('.support-link:hover::after'),
        'Popup footer should reveal helpful text on hover and keyboard focus'
    );
    assert(
        popupHtml.includes('id="open-labs"') &&
        popupHtml.includes('id="labs-view"') &&
        !popupHtml.includes('Pick the next Labs idea to test') &&
        popupHtml.includes('Instagram Video Controls') &&
        !popupHtml.includes('Cleaner Instagram Videos &amp; Reels') &&
        !popupHtml.includes('Fewer distractions around the player') &&
        popupHtml.includes('Per-site Control Presets') &&
        popupHtml.includes('Compatibility Alerts') &&
        !popupHtml.includes('Save Instagram View-Once Media') &&
        !popupHtml.includes('Re-watch or download one-time photos/videos') &&
        !popupHtml.includes('View Deleted Messages') &&
        !popupHtml.includes('Only messages deleted after Ghostify saw them') &&
        !popupHtml.includes('Clean Facebook Videos') &&
        !popupHtml.includes('Save Facebook Media') &&
        !popupHtml.includes('View-Once Media Preview') &&
        !popupHtml.includes('Clean Video Player</span>') &&
        !popupHtml.includes('Save Best Available Media</span>') &&
        !popupHtml.includes('View Once Privacy Lab') &&
        !popupHtml.includes('Message Memory') &&
        labsSurveyUrls.every(url => popupHtml.includes(`href="${url}"`)) &&
        (popupHtml.match(/https:\/\/tally\.so\/r\/D4W0Jq/g) || []).length >= 4 &&
        !popupHtml.includes('docs.google.com/forms') &&
        !popupHtml.includes('feature_request.yml&title=Vote%3A') &&
        !popupHtml.includes('<input type="checkbox" disabled'),
        'Popup Labs should route quiet Vote rows to the shared Tally survey instead of Google Forms or GitHub issue drafts'
    );
    assert(
        privacyPolicy.includes('GitHub issue forms or Tally forms') &&
        privacyPolicy.includes('privacy practices of GitHub or Tally') &&
        !privacyPolicy.includes('Google Forms'),
        'Privacy policy should disclose Tally as the external feature survey provider'
    );
    assert(
        popupCss.includes('.labs-row') &&
        popupCss.includes('.labs-row-title') &&
        popupCss.includes('.vote-pill') &&
        !popupCss.includes('.labs-row-copy') &&
        !popupCss.includes('.labs-row-detail') &&
        !popupCss.includes('.labs-note') &&
        popupCss.includes('padding: 8px 12px 14px;') &&
        popupCss.includes('line-height: 1.25;') &&
        popupCss.includes('min-height: 42px;') &&
        /\.row-label\s*\{[^}]*font-weight:\s*400;/.test(popupCss) &&
        /\.labs-row-title\s*\{[^}]*font-weight:\s*400;/.test(popupCss) &&
        /\.trust-row\s*\{[^}]*font-weight:\s*400;/.test(popupCss) &&
        !popupCss.includes('0 0 10px var(--ghost-red-glow)') &&
        popupCss.includes('.trust-row') &&
        popupJs.includes('attachViewListeners') &&
        popupJs.includes('open-labs') &&
        popupJs.includes('close-labs'),
        'Popup Labs view should stay compact and use local view switching'
    );
    const headerHtml = popupHtml.slice(
        popupHtml.indexOf('<header class="header">'),
        popupHtml.indexOf('</header>') + '</header>'.length
    );
    assert(
        headerHtml.includes('id="public-status-link"') &&
        headerHtml.includes('id="public-status-summary"') &&
        !headerHtml.includes('id="public-status-action"') &&
        !headerHtml.includes('>Verification</span>') &&
        !popupHtml.includes('>View</span>') &&
        popupCss.includes('.header-verification') &&
        popupCss.includes('width: 112px;') &&
        popupCss.includes('max-width: 112px;') &&
        popupCss.includes('min-height: 20px;') &&
        popupCss.includes('align-self: flex-end;') &&
        popupCss.includes('text-overflow: ellipsis;') &&
        !popupHtml.includes('class="verification-panel"') &&
        !popupHtml.includes('id="local-refresh"') &&
        !popupHtml.includes('id="local-refresh-message"') &&
        !popupHtml.includes('id="status-refresh"') &&
        !popupHtml.includes('Refresh this tab to load Ghostify.') &&
        !popupHtml.includes('Status Check') &&
        !popupHtml.includes('id="status-pill"') &&
        !popupHtml.includes('id="status-message"') &&
        !popupJs.includes('GHOSTIFY_STATUS_CHECK') &&
        !popupJs.includes('refreshActiveStatusTab') &&
        !popupJs.includes('chrome.tabs.reload') &&
        !popupJs.includes('SUPPORTED_TAB_URL_PATTERNS') &&
        !popupJs.includes('getStatusTargetTab') &&
        !popupJs.includes('hasRequiredHooks') &&
        !popupJs.includes('state === \'needsRefresh\' || state === \'someChecksFailed\'') &&
        !popupJs.includes("summaryElement.textContent = 'Status unavailable.';") &&
        !popupJs.includes('PACKAGED_PUBLIC_STATUS') &&
        !popupJs.includes('fallbackPublicStatusSummary') &&
        !popupJs.includes('last packaged proof') &&
        !popupJs.includes('2026-06-27T00:00:00Z') &&
        popupJs.includes('formatCompactWorkingSummary') &&
        popupJs.includes('provenWorking') &&
        !popupJs.includes('dataset.action') &&
        !popupCss.includes('.verification-panel') &&
        !popupCss.includes('.local-refresh') &&
        !popupCss.includes('.status-refresh') &&
        !popupJs.includes('smoke test') &&
        !popupJs.includes('Local hooks active.') &&
        !popupJs.includes('platformMayHaveChanged') &&
        !popupHtml.includes('Seen is definitely blocked') &&
        !popupHtml.includes('sender-side') &&
        !popupHtml.includes('sender-side Seen is verified'),
        'Popup should keep compact public status proof in the header and remove the local Ghostify-loaded checker'
    );

    for (const file of issueTemplateFiles) {
        assert(fs.existsSync(file), `${file} should exist so users are guided before filing reports`);
    }

    const issueTemplateConfig = fs.readFileSync('.github/ISSUE_TEMPLATE/config.yml', 'utf8');
    assert(
        issueTemplateConfig.includes('blank_issues_enabled: false'),
        'GitHub blank issues should be disabled so users do not draft from scratch'
    );

    const forms = issueTemplateFiles
        .filter(file => file.endsWith('.yml') && !file.endsWith('config.yml'))
        .map(file => fs.readFileSync(file, 'utf8'));
    for (const name of issueTemplateNames) {
        assert(
            forms.some(form => form.includes(name)),
            `Guided issue chooser should include the action label "${name}"`
        );
    }
    assert(
        !fs.existsSync('.github/ISSUE_TEMPLATE/platform_update.yml'),
        'Guided issue chooser should avoid extra overlapping issue types beyond bug, idea, feedback, and question'
    );
    const directHelpForm = fs.readFileSync('.github/ISSUE_TEMPLATE/help_feedback.yml', 'utf8');
    const bugReportForm = fs.readFileSync('.github/ISSUE_TEMPLATE/bug_report.yml', 'utf8');
    assert(
        directHelpForm.includes('name: Help & feedback') &&
        directHelpForm.includes('Report a bug') &&
        directHelpForm.includes('Share an idea') &&
        directHelpForm.includes('Share feedback') &&
        directHelpForm.includes('Ask a question') &&
        directHelpForm.includes(`placeholder: "${directHelpPlaceholder}"`),
        'Popup direct Help & feedback form should guide users into bug, idea, feedback, or question paths'
    );
    assert(
        forms.every(form =>
            form.includes('type: dropdown') &&
            form.includes('type: textarea') &&
            form.includes('id: public-thanks') &&
            form.includes('Thank-you credit preview:') &&
            form.includes('Do not include private messages, credentials, or account-sensitive details') &&
            form.includes('Can we thank you publicly if this helps Ghostify?') &&
            form.includes('Yes means we can credit your GitHub name and avatar in release notes and on the Ghostify website.') &&
            form.includes('- Yes, name and avatar') &&
            form.includes('- No thanks') &&
            !form.includes('- GitHub username only')
        ),
        'Guided issue forms should collect structured details and public-thanks consent with a clear two-option thank-you credit'
    );
    assert(
        forms.every(form => !/^\s*placeholder:\s+[^"|\n][^\n]*:\s/m.test(form)),
        'Guided issue forms should quote colon-containing placeholder text so GitHub does not reject the YAML'
    );
    assert(
        !directHelpForm.includes('type: upload') &&
        directHelpForm.includes('id: attachments') &&
        directHelpForm.includes('Screenshots or screen recording links') &&
        directHelpForm.includes('Do not include private messages, credentials, or account-sensitive details') &&
        directHelpForm.includes('Remove private messages, credentials, and account-sensitive details first') &&
        bugReportForm.includes('id: attachments') &&
        bugReportForm.includes('Screenshots or screen recording links') &&
        bugReportForm.includes('Do not include private messages, credentials, or account-sensitive details') &&
        !bugReportForm.includes('type: upload'),
        'Guided bug and feedback forms should explain how to attach safe screenshots or videos without using unsupported issue-form upload fields'
    );
    assert(
        directHelpForm.includes('type: textarea') &&
        directHelpForm.includes('id: attachments') &&
        directHelpForm.includes('short video') &&
        bugReportForm.includes('id: attachments'),
        'Guided bug and feedback forms should keep a screenshot/video attachment field'
    );
}

function testLocalStatusCheckerIsRemovedFromPopupRuntime() {
    const popupSource = fs.readFileSync('dist/js/popup.js', 'utf8');
    const contentSource = fs.readFileSync('src/content.js', 'utf8');
    const ghostSource = fs.readFileSync('src/ghost.js', 'utf8');

    for (const source of [popupSource, contentSource, ghostSource]) {
        assert(
            !source.includes('GHOSTIFY_STATUS_CHECK') &&
            !source.includes('GHOSTIFY_STATUS_REQUEST') &&
            !source.includes('GHOSTIFY_STATUS_RESPONSE') &&
            !source.includes('createStatusSnapshot'),
            'Popup and runtime code should not keep the removed local Ghostify-loaded checker'
        );
    }
}

function testPopupPublicStatusSummaryUsesWorkingProofDate() {
    const popupSource = fs.readFileSync('dist/js/popup.js', 'utf8');
    const context = {
        console,
        Date,
        Intl,
        setTimeout,
        clearTimeout,
        window: null,
        chrome: {
            runtime: {
                getManifest: () => ({ version: pkg.version }),
                lastError: null
            },
            storage: {
                local: {
                    get() { },
                    set() { }
                }
            }
        },
        document: {
            addEventListener() { },
            querySelectorAll() { return []; },
            getElementById() { return null; }
        }
    };
    context.window = context;
    vm.runInNewContext(popupSource, context, { filename: 'popup.js' });

    const workingEntry = {
        publicStatus: 'maintainer_verified',
        verifiedAt: '2026-06-27T00:00:00Z',
        expiresAt: '2026-07-11T00:00:00Z'
    };
    const workingData = {
        schemaVersion: 1,
        productVersion: pkg.version,
        provenWorking: {
            lastVerifiedAt: '2026-06-27T00:00:00Z',
            currentWindowStartedAt: '2026-06-04'
        },
        entries: Array.from({ length: 9 }, () => ({ ...workingEntry }))
    };

    assert.strictEqual(
        context.summarizePublicStatus(workingData, new Date('2026-06-27T12:00:00Z')),
        'Working today',
        'Popup should summarize a fully green status feed as the last all-working proof date'
    );
    assert.strictEqual(
        context.summarizePublicStatus(workingData, new Date('2026-06-28T12:00:00Z')),
        'Working Jun 27',
        'Popup should avoid saying today after the proof date has passed'
    );
}

async function testPopupFetchFailureDoesNotClaimWorking() {
    const popupSource = fs.readFileSync('dist/js/popup.js', 'utf8');
    const classNames = new Set();
    const summaryElement = { textContent: '' };
    const linkElement = {
        attributes: new Map(),
        classList: {
            add(name) { classNames.add(name); },
            remove(name) { classNames.delete(name); },
            contains(name) { return classNames.has(name); }
        },
        setAttribute(name, value) {
            this.attributes.set(name, value);
        },
        getAttribute(name) {
            return this.attributes.get(name) || null;
        }
    };
    const context = {
        console,
        Date,
        Intl,
        Promise,
        setTimeout,
        clearTimeout,
        AbortController: undefined,
        fetch: () => Promise.reject(new Error('public feed unavailable')),
        window: null,
        chrome: {
            runtime: {
                getManifest: () => ({ version: pkg.version }),
                lastError: null
            },
            storage: {
                local: {
                    get() { },
                    set() { }
                }
            }
        },
        document: {
            addEventListener() { },
            querySelectorAll() { return []; },
            getElementById(id) {
                if (id === 'public-status-summary') return summaryElement;
                if (id === 'public-status-link') return linkElement;
                return null;
            }
        }
    };
    context.window = context;
    vm.runInNewContext(popupSource, context, { filename: 'popup.js' });

    await context.updatePublicStatusSummary();

    assert.strictEqual(
        summaryElement.textContent,
        'Check status',
        'Popup should show a neutral compact fallback when the public status feed cannot load'
    );
    assert(
        !summaryElement.textContent.toLowerCase().includes('working') &&
        !linkElement.getAttribute('aria-label').toLowerCase().includes('working'),
        'Popup fetch failures must not claim the controls are working'
    );
    assert(linkElement.classList.contains('is-fallback'), 'Popup should mark the public-status link as fallback on fetch failure');
}

function testReleaseDocsIncludeMessengerFacebookStorySmokeIds() {
    const qaFixtures = fs.readFileSync('docs/QA_FIXTURES.md', 'utf8');
    const releaseChecklist = fs.readFileSync('RELEASE_CHECKLIST.md', 'utf8');

    for (const smokeId of ['GH-MSG-STORY-001', 'GH-FB-STORY-001']) {
        assert(
            qaFixtures.includes(smokeId) && releaseChecklist.includes(smokeId),
            `${smokeId} should be part of release smoke coverage when public copy claims Messenger/Facebook story-view support`
        );
    }
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
    await testFacebookGraphQLShortSendsWithPrivacyMetadataAreAllowed();
    testMessengerPatchMixedSendTypingBatchPreservesSend();
    testFacebookPatchMixedSendTypingBatchPreservesSend();
    testFacebookMiniChatSecureSendWithAlternateTargetsIsForwarded();
    testFacebookMiniChatMixedSendTypingBridgeFrameDoesNotEnterTypingSanitizer();
    await testFacebookSecureEncryptedDirectRecipientSendsAreAllowed();
    testMessengerPatchMixedSendReadStringBatchPreservesSend();
    testMessengerPatchObjectMapBatchSanitizesPrivacyTasks();
    testMessengerPatchSendWithTransferIsForwarded();
    testMessengerPatchMixedTransferBatchesSanitizePrivacyTasks();
    testMessengerPatchReferencedSendTransferIsPreserved();
    await testMessengerTypingAndSeenProtectionsStillBlock();
    await testFacebookSecureTypingStateModulesPreserveReturnContract();
    await testFacebookMawSecureTypingStateDependenciesPreserveSecureSend();
    await testFacebookMiniChatComposerSendDependenciesPreserveSecureSend();
    testMessengerPatchPurePrivacyTrafficStillBlocks();
    await testMessengerTogglesDisableProtections();
    await testMessageRequestsAndInboxQueriesAreAllowed();
    testMessengerPatchRequestRouteModulesHydrateUntouched();
    testMessengerPatchLocalReadModulesStayUntouchedAfterRequestSpaNavigation();
    testFacebookNormalThreadLocalReadModulesAreSanitized();
    testFacebookFeedMiniChatLocalReadModulesSanitizeReadReceiptsWithoutBlockingHistoryLoading();
    testFacebookFeedMiniChatStaleLocalReadModulesSanitizeReadReceiptsWithoutBlockingHistoryLoading();
    testFacebookLocalReadModulesRewriteNestedWatermarksToPreserveUnreadUi();
    testFacebookFeedMiniChatLocalReadModulesPreserveSendAckStatePayloads();
    testFacebookFeedMiniChatLocalReadModulesPreservePendingSendStatePayloads();
    testFacebookMessageRequestGraceLeavesLocalReadModulesUntouched();
    testFacebookMessageRequestGraceBypassesStaleLocalReadWrappersAtCallTime();
    testFacebookMawProxyLocalReadModulesAreSanitized();
    await testFacebookMawProxyNetworkReadReceiptsAreBlocked();
    testFacebookEdgeChatRealtimeReadWatermarkFramesAreBlocked();
    testFacebookEdgeChatMixedShortSendTypingFrameIsAllowed();
    testFacebookEdgeChatQuickReactionSendTypingFrameIsAllowed();
    testFacebookThreadOpenRealtimeLoadsStayAllowed();
    testFacebookBridgeLightspeedReadFramesAreSanitizedBeforeSharedWorkerStateUpdates();
    testFacebookGenericLightspeedHistoryWithReadMetadataStaysAllowed();
    testFacebookBareBridgeReadReceiptsAreBlocked();
    testFacebookMixedBridgeReadReceiptBatchesAreSanitizedNotDropped();
    testFacebookTargetlessBridgeReadReceiptBatchesAreSanitizedBeforeSharedWorkerStateUpdates();
    testFacebookBridgeThreadOpenFramesStayAllowed();
    testFacebookWorkersKeepNativeScriptUrls();
    await testNonMawFbsbxPagesAreNotTreatedAsMessenger();
    testManifestInjectsIntoFacebookMawProxyFrames();
    testMessengerPatchRequestRouteExplicitModulesStayProtected();
    await testVideoAdAndMediaTrafficIsAllowed();
    await testPrivacyWritesStillBlockWithRequestOrMediaContext();
    testFacebookWatchDoesNotSpoofFocus();
    testFacebookFeedStartupKeepsNativeFocusBrieflyBeforePreloadedMiniChatDomExists();
    testFacebookRestoredMiniChatLoadingKeepsNativeFocusUntilHydrated();
    testFacebookFeedMessengerSurfacesSpoofFocusPassivelyForReadPrivacyAndLoaders();
    testFacebookUnreadFeedMessageClicksKeepDocumentVisibleForThreadLoading();
    testFacebookUnreadFeedMessageChildClicksKeepDocumentVisibleForThreadLoading();
    testInstagramMediaSurfacesDoNotSpoofFocus();
    testMessageRequestRoutesDoNotSuppressFocusEvents();
    testMawProxyRejectsUntrustedMessageRequestGrace();
    testMessageRequestSpaRouteChangesRestoreNativeFocus();
    testMessageRequestClicksTemporarilyRestoreNativeFocus();
    testFacebookNestedMessageRequestClicksTemporarilyRestoreNativeFocus();
    testFacebookNormalConversationClicksDoNotInheritSiblingMessageRequestText();
    testPopupMessengerSeenNoteExplainsLocalFacebookReadUi();
    testPopupSupportLinksUseGuidedIssueForms();
    testLocalStatusCheckerIsRemovedFromPopupRuntime();
    testPopupPublicStatusSummaryUsesWorkingProofDate();
    await testPopupFetchFailureDoesNotClaimWorking();
    testReleaseDocsIncludeMessengerFacebookStorySmokeIds();
    await testMessageRequestClickGraceKeepsTransportAndBridgeNative();
    console.log('messenger send-stability regression tests passed');
})().catch(error => {
    console.error(error);
    process.exit(1);
});
