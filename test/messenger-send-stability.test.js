const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const pkg = require('../package.json');

const ghostSource = fs.readFileSync('dist/js/ghost.js', 'utf8');
const messengerPatchSource = fs.readFileSync('dist/js/messenger_patch.js', 'utf8');
const binaryJsonSource = fs.readFileSync('src/utils/binary-json.js', 'utf8');

function loadBinaryJsonSourceHelpers() {
    const context = { JSON, String, Object, Array };
    context.globalThis = context;
    vm.runInNewContext(
        `${binaryJsonSource.replace(/^export\s+/gm, '')}\nthis.sanitizeJsonTaskBatchStringSource = sanitizeJsonTaskBatchStringSource;`,
        context,
        { filename: 'binary-json.js' }
    );
    return context;
}

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
                message: { text: 'markThreadAsRead readReceipt' },
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

const facebookFramePrefix = '\u000fg\u0000\u0002\u0000\u0000{}\rg\u0000\u0000';
const facebookFramedRestoredGroupInnerPayload = JSON.stringify({
    epoch_id: '__UNSAFE_EPOCH_ID__',
    tasks: [{
        label: '209',
        payload: JSON.stringify({
            thread_fbid: 'redacted-group',
            force_upsert: 0,
            sync_group: 95,
            metadata_only: 0,
            preview_only: 0
        }),
        queue_name: 'redacted-group',
        task_id: 501
    }, {
        label: 'markThreadAsRead',
        payload: JSON.stringify({
            thread_key: { thread_fbid: 'redacted-group' },
            last_read_watermark_ts: 1779530000000,
            should_send_read_receipt: true
        }),
        queue_name: 'redacted-group',
        task_id: 502
    }, {
        label: 'hydrateOlderMessages',
        payload: JSON.stringify({
            parent_thread_key: 'redacted-group',
            cursor: 'redacted-cursor'
        }),
        queue_name: 'redacted-group',
        task_id: 503
    }]
}).replace('"__UNSAFE_EPOCH_ID__"', '7466175527281646891');
const facebookFramedRestoredGroupMixedReadBatch = new Uint8Array(Buffer.from(
    facebookFramePrefix + JSON.stringify({
        app_id: '2220391788200892',
        payload: facebookFramedRestoredGroupInnerPayload,
        request_id: 199,
        type: 3
    }),
    'utf8'
));

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
const facebookMixedBridgeReadReceiptEnvelope = {
    issue_new_task: true,
    tasks: facebookMixedBridgeReadReceiptBatch
};
const facebookMixedBridgeReadReceiptEnvelopeString = JSON.stringify({
    issue_new_task: true,
    epoch_id: '__UNSAFE_ENVELOPE_EPOCH_ID__',
    tasks: facebookMixedBridgeReadReceiptBatch.map((task, index) => index === 2
        ? Object.assign({}, task, { hydration_id: '__UNSAFE_HYDRATION_ID__' })
        : task)
})
    .replace('"__UNSAFE_ENVELOPE_EPOCH_ID__"', '7466175527281646891')
    .replace('"__UNSAFE_HYDRATION_ID__"', '7466175527281646893');

const facebookMixedBridgeReadReceiptBinarySource = JSON.stringify(
    facebookMixedBridgeReadReceiptBatch.map((task, index) => index === 0
        ? Object.assign({}, task, { epoch_id: '__UNSAFE_BATCH_EPOCH_ID__' })
        : task)
).replace('"__UNSAFE_BATCH_EPOCH_ID__"', '7466175527281646892');
const facebookMixedBridgeReadReceiptBinary = new Uint8Array(Buffer.from(
    facebookMixedBridgeReadReceiptBinarySource,
    'utf8'
));

const facebookBareBridgeReadReceiptBinary = new Uint8Array(Buffer.from(
    JSON.stringify(facebookBareBridgeReadReceipt),
    'utf8'
));

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

const facebookNormalThreadListPaginationTask = {
    label: 'MWChatThreadListPaginationQuery',
    queue_name: 'mwchat_fetch_thread_list',
    task_id: 'pagination-task',
    payload: {
        folder: 'inbox',
        cursor: 'redacted-next-cursor',
        direction: 'older',
        thread_list: true,
        should_send_read_receipt: false,
        seen_by_viewer: false
    }
};
const facebookNormalThreadListPaginationEnvelopeSource = JSON.stringify({
    issue_new_task: true,
    epoch_id: '__UNSAFE_PAGINATION_EPOCH_ID__',
    tasks: [facebookNormalThreadListPaginationTask]
}).replace('"__UNSAFE_PAGINATION_EPOCH_ID__"', '7466175527281646897');
const facebookNormalThreadListPaginationBinary = new Uint8Array(Buffer.from(
    JSON.stringify([facebookNormalThreadListPaginationTask]),
    'utf8'
));

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
        TextEncoder,
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
        TextEncoder,
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
        this.port = new MessagePort('shared-worker-port');
    }

    function MessagePort(target = 'port') {
        this.target = target;
    }
    MessagePort.prototype.postMessage = function (message, transfer) {
        workerPosts.push({ target: this.target || 'port', message, transfer });
        return this.target === 'shared-worker-port' ? 'shared-worker-port-sent' : 'port-sent';
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
        TextEncoder,
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
    if (Object.prototype.toString.call(value) === '[object ArrayBuffer]') {
        return new TextDecoder().decode(new Uint8Array(value));
    }
    assert.ok(ArrayBuffer.isView(value), 'expected a binary bridge payload');
    return new TextDecoder().decode(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
}

function decodeFacebookFramedTasks(value) {
    const text = decodeBridgeBytes(value);
    assert.ok(text.startsWith(facebookFramePrefix), 'Facebook realtime frame prefix must stay byte-for-byte intact');
    const outer = JSON.parse(text.slice(facebookFramePrefix.length));
    return { outer, inner: JSON.parse(outer.payload) };
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
        TextEncoder,
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

async function testFacebookJsonShapedPrivacyTextInsideRealSendsIsPreserved() {
    const userText = JSON.stringify({
        tasks: [{
            label: 'openThreadHistory',
            cursor: 'user-authored-example'
        }, {
            label: 'markThreadAsRead',
            thread_key: { thread_fbid: 'user-authored-example' },
            readReceipt: true
        }]
    });
    const envelope = {
        issue_new_task: true,
        tasks: [{
            label: 'send_message',
            queue_name: 'messenger_send_message',
            payload: {
                thread_key: { thread_fbid: 'redacted-thread' },
                send_type: 1,
                offline_threading_id: 'redacted-offline',
                message: { text: userText }
            }
        }]
    };
    const body = JSON.stringify(envelope);
    const assertTextPreserved = value => {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        assert.strictEqual(parsed.tasks[0].payload.message.text, userText);
    };

    const fetchWindow = makeGhostPage({
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/'
    });
    assert.strictEqual(await fetchOutcome(fetchWindow, body), 'allowed');
    assertTextPreserved(fetchWindow.fetchCalls[0].init.body);

    const websocketWindow = makeGhostPage({
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/'
    });
    const websocket = websocketSend(websocketWindow, body, 'wss://gateway.facebook.com/ws/lightspeed');
    assert.strictEqual(websocket.result, 'sent');
    assertTextPreserved(websocket.socket.sent[0]);

    const xhrWindow = makeGhostPage({
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/'
    });
    const xhr = xhrSend(xhrWindow, body);
    assert.strictEqual(xhr.result, 'sent');
    assertTextPreserved(xhr.xhr.sent);

    for (const outcome of ['worker', 'port']) {
        const context = makeMessengerPatchPage({}, {
            hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/'
        });
        const result = outcome === 'worker'
            ? workerOutcome(context, envelope)
            : portOutcome(context, envelope);
        assert.ok(result.result, `${outcome} send envelopes must be forwarded`);
        assertTextPreserved(result.post.message);
    }
}

function testFacebookExactMarkThreadAsReadModulesSuppressLocalMutation() {
    for (const moduleName of ['LSMarkThreadAsRead', 'MWMarkThreadAsRead', 'MarkThreadAsRead']) {
        for (const exportName of ['default', 'markThreadAsRead']) {
            const context = makeMessengerPatchPage({}, {
                hostname: 'www.facebook.com',
                pathname: '/',
                href: 'https://www.facebook.com/',
                facebookMiniChatOpen: true
            });
            const calls = [];
            const state = { unread: true };
            const module = registerMessengerModule(
                context,
                moduleName,
                function (_a, _b, _c, _d, moduleObject) {
                    moduleObject.exports[exportName] = function markThreadAsRead(payload) {
                        calls.push(payload);
                        state.unread = false;
                        return 'mark-thread-as-read-updated';
                    };
                }
            );
            const readPayload = {
                thread_key: { thread_fbid: 'redacted-thread' },
                last_read_watermark: 1779530000000,
                should_send_read_receipt: true,
                readReceiptMutation: { should_send_read_receipt: true }
            };

            assert.strictEqual(
                module.exports[exportName](readPayload),
                undefined,
                `${moduleName}.${exportName} must return a neutral value when its local read mutation is suppressed`
            );
            assert.strictEqual(calls.length, 0, `${moduleName}.${exportName} must not execute its local read mutation`);
            assert.strictEqual(state.unread, true, `${moduleName}.${exportName} must preserve modeled unread UI state`);
            assert.strictEqual(readPayload.last_read_watermark, 1779530000000);
            assert.strictEqual(context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0, 0);
            assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 1);
        }
    }
}

function testFacebookExactMarkThreadAsReadDependencyIsSuppressedWithoutBreakingOpen() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const calls = [];
    let historyHydrations = 0;
    const dependencyExports = {
        LSMarkThreadAsRead: {
            markThreadAsRead(payload) {
                calls.push(payload);
                return 'dependency-mark-thread-as-read-updated';
            }
        }
    };
    const module = registerMessengerModuleWithDependencies(
        context,
        'CometChatOpenHandler',
        ['LSMarkThreadAsRead'],
        dependencyExports,
        function (_a, require, _c, _d, moduleObject) {
            const readState = require('LSMarkThreadAsRead');
            moduleObject.exports.openThread = payload => {
                readState.markThreadAsRead(payload);
                historyHydrations += 1;
                return 'thread-opened';
            };
        }
    );
    const readPayload = {
        thread_key: { thread_fbid: 'redacted-thread' },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
        readReceiptMutation: { should_send_read_receipt: true }
    };

    assert.strictEqual(module.exports.openThread(readPayload), 'thread-opened');
    assert.strictEqual(historyHydrations, 1, 'thread opening and history hydration must continue after suppression');
    assert.strictEqual(calls.length, 0, 'the required MarkThreadAsRead dependency must not mutate local unread state');
    assert.strictEqual(context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0, 0);
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 1);
}

async function testFacebookUseMarkThreadAsReadHookReturnsSuppressedCallback() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    let hookCalls = 0;
    let mutationCalls = 0;
    const state = { unread: true };
    const originalMarkThreadAsRead = function markThreadAsRead(payload) {
        mutationCalls += 1;
        state.unread = false;
        return payload;
    };
    const module = registerMessengerModule(
        context,
        'useMWLSMarkThreadAsRead',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function useMWLSMarkThreadAsRead() {
                hookCalls += 1;
                return originalMarkThreadAsRead;
            };
        }
    );
    const markThreadAsRead = module.exports.default();
    const secondMarkThreadAsRead = module.exports.default();
    const readPayload = {
        thread_key: { thread_fbid: 'redacted-thread' },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true
    };

    assert.strictEqual(hookCalls, 2, 'the React hook itself must still execute on every render');
    assert.strictEqual(typeof markThreadAsRead, 'function', 'the hook contract must remain a callback');
    assert.strictEqual(markThreadAsRead, secondMarkThreadAsRead, 'stable hook callbacks must keep stable wrapper identity');
    assert.strictEqual(await markThreadAsRead(readPayload), undefined);
    assert.strictEqual(mutationCalls, 0, 'the callback returned by the hook must not mutate local unread state');
    assert.strictEqual(state.unread, true);
    assert.strictEqual(context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0, 0);
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 1);
    assert.strictEqual(context.window.__GHOSTIFY_WRAPPED_MARK_THREAD_AS_READ_CALLBACKS__ || 0, 1);

    context.window.__GHOSTIFY_SETTINGS__.msgSeen = false;
    assert.strictEqual(markThreadAsRead(readPayload), readPayload, 'disabling Hide Seen must restore native callback behavior');
    assert.strictEqual(mutationCalls, 1);
}

async function testFacebookGroupReadOperationsPreserveUnreadAndPromiseContracts() {
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);
    const groupOptions = Object.freeze({
        threadType: 'GROUP',
        readWatermarkTimestampMs: watermarkI64,
        shouldSendReadReceipt: true
    });

    for (const moduleName of ['MAWMarkThreadAsRead']) {
        const context = makeMessengerPatchPage({}, {
            hostname: moduleName.startsWith('MAW') ? 'www.fbsbx.com' : 'www.facebook.com',
            pathname: moduleName.startsWith('MAW') ? '/maw_proxy_page/' : '/',
            search: moduleName.startsWith('MAW') ? '?__cci=redacted' : '',
            href: moduleName.startsWith('MAW')
                ? 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
                : 'https://www.facebook.com/',
            facebookMiniChatOpen: !moduleName.startsWith('MAW')
        });
        let mutationCalls = 0;
        const state = { unread: true };
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.markThreadAsReadImpl = async function (...args) {
                    mutationCalls += 1;
                    state.unread = false;
                    return args;
                };
            }
        );

        const result = module.exports.markThreadAsReadImpl(threadKeyI64, watermarkI64, groupOptions);
        assert.ok(result && typeof result.then === 'function', `${moduleName} suppression must preserve thenability`);
        assert.strictEqual(await result, undefined);
        assert.strictEqual(mutationCalls, 0, `${moduleName} must not execute the local group-read mutation`);
        assert.strictEqual(state.unread, true);
        assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0, 1);
    }
}

function registerFacebookOptimisticMarkThreadReadFixture(context, options = {}) {
    const dependencyName = options.dependencyName || 'LSMarkThreadRead';
    const consumerName = options.consumerName || 'LSOptimisticMarkThreadReadV2';
    const nativeThis = Object.freeze({ contract: 'native-leaf-this' });
    const nativeResult = Object.freeze({ contract: 'native-leaf-result' });
    const nativeCalls = [];
    const nativeLeaf = function () {
        nativeCalls.push({ args: Array.from(arguments), thisArg: this });
        return nativeResult;
    };
    const tables = Object.freeze(['threads']);
    Object.defineProperties(nativeLeaf, {
        __sproc_name__: {
            configurable: true,
            value: 'LSMailboxMarkThreadReadStoredProcedure'
        },
        __tables__: {
            configurable: true,
            value: tables
        }
    });
    const issueNewTask = function () { return 'native-issue-task'; };
    let requiredLeaf;
    let requiredSibling;
    let secondaryRequire;
    let tertiaryRequire;
    let storedProcedureLeaf;
    const module = registerMessengerModuleWithDependencies(
        context,
        consumerName,
        ['LSIssueNewTask', dependencyName],
        {
            LSIssueNewTask: issueNewTask,
            [dependencyName]: nativeLeaf
        },
        function (_a, require, requireSecondary, requireTertiary, moduleObject) {
            secondaryRequire = requireSecondary;
            tertiaryRequire = requireTertiary;
            moduleObject.exports = function optimisticMarkThreadRead(threadKey, watermark, runtime, leafRuntime = runtime) {
                requiredLeaf = require(dependencyName);
                requiredSibling = require('LSIssueNewTask');
                return runtime.storedProcedure(requiredLeaf, watermark, threadKey, leafRuntime);
            };
        }
    );

    const createRuntime = (leafRuntime = undefined) => {
        const resolveCalls = [];
        const runtimeResult = Object.freeze({ contract: 'lightspeed-runtime-result' });
        const runtime = {
            resolve(value) {
                resolveCalls.push(value);
                return runtimeResult;
            },
            storedProcedure(leaf, watermark, threadKey, explicitLeafRuntime) {
                storedProcedureLeaf = leaf;
                return Reflect.apply(
                    leaf,
                    nativeThis,
                    [watermark, threadKey, leafRuntime === undefined ? explicitLeafRuntime : leafRuntime]
                );
            }
        };
        return { resolveCalls, runtime, runtimeResult };
    };

    return {
        createRuntime,
        get requiredLeaf() { return requiredLeaf; },
        get requiredSibling() { return requiredSibling; },
        issueNewTask,
        module,
        nativeCalls,
        nativeLeaf,
        nativeResult,
        nativeThis,
        get secondaryRequire() { return secondaryRequire; },
        get storedProcedureLeaf() { return storedProcedureLeaf; },
        tables,
        get tertiaryRequire() { return tertiaryRequire; }
    };
}

function testFacebookOptimisticMarkThreadReadShadowsOnlyNativeLeaf() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const fixture = registerFacebookOptimisticMarkThreadReadFixture(context);
    const threadKey = Object.freeze([135791357, 246802468]);
    const watermark = Object.freeze([1779530000, 417]);
    const { resolveCalls, runtime, runtimeResult } = fixture.createRuntime();

    const result = fixture.module.exports(threadKey, watermark, runtime);

    assert.strictEqual(result, runtimeResult, 'the neutral leaf must preserve the Lightspeed runtime return contract');
    assert.strictEqual(resolveCalls.length, 1, 'the neutral leaf must resolve exactly once');
    assert.ok(Array.isArray(resolveCalls[0]), 'the neutral leaf must resolve the native empty-array result shape');
    assert.strictEqual(resolveCalls[0].length, 0);
    assert.strictEqual(fixture.nativeCalls.length, 0, 'the native local watermark mutation must not execute');
    assert.notStrictEqual(fixture.storedProcedureLeaf, fixture.nativeLeaf, 'only the exact consumer must receive a leaf shadow');
    assert.strictEqual(fixture.storedProcedureLeaf.name, fixture.nativeLeaf.name);
    assert.strictEqual(fixture.storedProcedureLeaf.length, fixture.nativeLeaf.length);
    assert.strictEqual(fixture.storedProcedureLeaf.__sproc_name__, fixture.nativeLeaf.__sproc_name__);
    assert.strictEqual(fixture.storedProcedureLeaf.__tables__, fixture.tables);
    assert.strictEqual(fixture.requiredSibling, fixture.issueNewTask, 'LSIssueNewTask must remain completely native');
    assert.strictEqual(
        fixture.secondaryRequire,
        fixture.tertiaryRequire,
        'the exact consumer must leave unrelated require slots untouched'
    );
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0, 1);
}

function testFacebookTopFrameModuleInterceptorIsExactScopedForLoaderSafety() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const definitions = [];
    context.window.__d = function (moduleName, dependencies, factory) {
        definitions.push({ dependencies, factory, moduleName });
        return 'registered';
    };

    const hydrationFactory = function nativeHydrationFactory() { return 'hydrate'; };
    const hydrationDependencies = ['LSUpdateThreadReadWatermark', 'LSIssueNewTask'];
    assert.strictEqual(
        context.window.__d('MWThreadListHydration', hydrationDependencies, hydrationFactory),
        'registered'
    );
    assert.strictEqual(definitions[0].factory, hydrationFactory, 'hydration factories must retain native identity');
    assert.strictEqual(definitions[0].dependencies, hydrationDependencies);

    const broadReadFactory = function nativeBroadReadFactory() { return 'read'; };
    assert.strictEqual(
        context.window.__d('LSUpdateThreadReadWatermark', [], broadReadFactory),
        'registered'
    );
    assert.strictEqual(definitions[1].factory, broadReadFactory, 'broad local-read factories must remain native');

    const exactFactory = function exactOptimisticFactory() { return 'exact'; };
    assert.strictEqual(
        context.window.__d('LSOptimisticMarkThreadReadV2', ['LSMarkThreadRead'], exactFactory),
        'registered'
    );
    assert.notStrictEqual(definitions[2].factory, exactFactory, 'only the confirmed optimistic consumer may be wrapped');
}

function testFacebookOptimisticMarkThreadReadPreservesNativeBypasses() {
    const page = () => ({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const threadKey = Object.freeze([135791357, 246802468]);
    const watermark = Object.freeze([1779530000, 417]);
    const assertNative = (fixture, runtime, label) => {
        const result = fixture.module.exports(threadKey, watermark, runtime);
        assert.strictEqual(result, fixture.nativeResult, `${label} must preserve the native leaf result`);
        assert.strictEqual(fixture.nativeCalls.length, 1, `${label} must execute the native leaf exactly once`);
        assert.strictEqual(fixture.nativeCalls[0].thisArg, fixture.nativeThis, `${label} must preserve native this`);
        assert.deepStrictEqual(
            fixture.nativeCalls[0].args,
            [watermark, threadKey, runtime],
            `${label} must preserve the live leaf argument order`
        );
    };

    const settingsOffContext = makeMessengerPatchPage({ msgSeen: false }, page());
    const settingsOff = registerFacebookOptimisticMarkThreadReadFixture(settingsOffContext);
    assertNative(settingsOff, settingsOff.createRuntime().runtime, 'settings-off behavior');

    const killedContext = makeMessengerPatchPage({}, page());
    const killed = registerFacebookOptimisticMarkThreadReadFixture(killedContext);
    killedContext.window.postMessage({
        type: 'GHOSTIFY_CONFIG_UPDATE',
        source: 'GHOSTIFY_EXTENSION',
        config: { killSwitch: ['msgSeen'] }
    });
    assertNative(killed, killed.createRuntime().runtime, 'kill-switched behavior');

    const requestContext = makeMessengerPatchPage({}, {
        ...page(),
        pathname: '/messages/requests',
        href: 'https://www.facebook.com/messages/requests'
    });
    const request = registerFacebookOptimisticMarkThreadReadFixture(requestContext);
    assertNative(request, request.createRuntime().runtime, 'Message Requests behavior');

    const graceContext = makeMessengerPatchPage({}, page());
    const grace = registerFacebookOptimisticMarkThreadReadFixture(graceContext);
    graceContext.window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ = Date.now() + 15000;
    assertNative(grace, grace.createRuntime().runtime, 'Message Requests transition grace');

    const invalidRuntimeContext = makeMessengerPatchPage({}, page());
    const invalidRuntime = registerFacebookOptimisticMarkThreadReadFixture(invalidRuntimeContext);
    const outerRuntime = invalidRuntime.createRuntime(Object.freeze({ contract: 'invalid-leaf-runtime' })).runtime;
    const invalidResult = invalidRuntime.module.exports(threadKey, watermark, outerRuntime);
    assert.strictEqual(invalidResult, invalidRuntime.nativeResult, 'an invalid injected runtime must fall back to the native leaf');
    assert.strictEqual(invalidRuntime.nativeCalls.length, 1);
}

function testFacebookOptimisticMarkThreadReadShadowIsConsumerAndHostScoped() {
    const facebookPage = () => ({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const threadKey = Object.freeze([135791357, 246802468]);
    const watermark = Object.freeze([1779530000, 417]);
    const fixtures = [];

    fixtures.push({
        label: 'suffix consumer',
        fixture: registerFacebookOptimisticMarkThreadReadFixture(
            makeMessengerPatchPage({}, facebookPage()),
            { consumerName: 'LSOptimisticMarkThreadReadV2Analytics' }
        )
    });
    fixtures.push({
        label: 'suffix dependency',
        fixture: registerFacebookOptimisticMarkThreadReadFixture(
            makeMessengerPatchPage({}, facebookPage()),
            { dependencyName: 'LSMarkThreadRead.bs' }
        )
    });
    fixtures.push({
        label: 'Messenger.com',
        fixture: registerFacebookOptimisticMarkThreadReadFixture(makeMessengerPatchPage({}, {
            hostname: 'www.messenger.com',
            pathname: '/t/redacted-thread',
            href: 'https://www.messenger.com/t/redacted-thread'
        }))
    });
    fixtures.push({
        label: 'MAW proxy',
        fixture: registerFacebookOptimisticMarkThreadReadFixture(makeMessengerPatchPage({}, {
            hostname: 'www.fbsbx.com',
            pathname: '/maw_proxy_page/',
            search: '?__cci=redacted',
            href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
        }))
    });

    const childContext = makeMessengerPatchPage({}, facebookPage());
    childContext.window.top = {};
    fixtures.push({
        label: 'Facebook child frame',
        fixture: registerFacebookOptimisticMarkThreadReadFixture(childContext)
    });

    for (const { fixture, label } of fixtures) {
        const runtime = fixture.createRuntime().runtime;
        assert.strictEqual(fixture.module.exports(threadKey, watermark, runtime), fixture.nativeResult);
        assert.strictEqual(fixture.nativeCalls.length, 1, `${label} must keep the native leaf`);
        assert.strictEqual(fixture.requiredLeaf, fixture.nativeLeaf, `${label} must not receive a shadow`);
    }
}

async function testFacebookOptimisticMarkThreadReadAdapterRemainsNative() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const optimisticProcedure = function () { return 'native-optimistic-procedure'; };
    const maybeExtractCalls = [];
    const synchronousPromise = {
        maybeExtractValueIfSynchronousPromise(value) {
            maybeExtractCalls.push(value);
            return value;
        }
    };
    let adapterCalls = 0;
    const module = registerMessengerModuleWithDependencies(
        context,
        'LSOptimisticMarkThreadReadV2StoredProcedure',
        ['LSOptimisticMarkThreadReadV2', 'LSSynchronousPromise', 'Promise', 'cr:8709'],
        {
            LSOptimisticMarkThreadReadV2: optimisticProcedure,
            LSSynchronousPromise: synchronousPromise,
            Promise
        },
        function (_a, promiseRequire, optimisticRequire, syncRequire, _moduleObject, exportsObject) {
            exportsObject.default = function adapter(store, args) {
                adapterCalls += 1;
                const result = store.storedProcedure(
                    optimisticRequire('LSOptimisticMarkThreadReadV2'),
                    args.threadKey,
                    args.readWatermarkTimestampMs
                );
                return promiseRequire('Promise').resolve(
                    syncRequire('LSSynchronousPromise').maybeExtractValueIfSynchronousPromise(result)
                );
            };
        }
    );
    const threadKey = Object.freeze([135791357, 246802468]);
    const watermark = Object.freeze([1779530000, 417]);
    const nativeResolvedValue = Object.freeze([]);
    const storedProcedureCalls = [];
    const store = {
        storedProcedure() {
            storedProcedureCalls.push(Array.from(arguments));
            return nativeResolvedValue;
        }
    };

    const result = module.exports.default(store, {
        readWatermarkTimestampMs: watermark,
        threadKey
    });
    assert.ok(result && typeof result.then === 'function', 'the adapter must retain its native Promise contract');
    assert.strictEqual(await result, nativeResolvedValue, 'the adapter must preserve its native resolved value');
    assert.strictEqual(adapterCalls, 1, 'the native adapter orchestration must execute');
    assert.deepStrictEqual(storedProcedureCalls[0], [optimisticProcedure, threadKey, watermark]);
    assert.deepStrictEqual(maybeExtractCalls, [nativeResolvedValue]);
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0, 0);

    const nativeError = new Error('native optimistic adapter rejection');
    const rejectingStore = {
        storedProcedure() { return Promise.reject(nativeError); }
    };
    await assert.rejects(
        module.exports.default(rejectingStore, {
            readWatermarkTimestampMs: watermark,
            threadKey
        }),
        error => error === nativeError,
        'native adapter rejections must propagate unchanged'
    );
    assert.strictEqual(adapterCalls, 2);
}

function testFacebookUnprovenGroupReadLeavesPreserveNativeContracts() {
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);

    for (const moduleName of ['LSOptimisticMarkThreadReadV2', 'LSMarkThreadRead']) {
        const context = makeMessengerPatchPage({}, {
            hostname: 'www.facebook.com',
            pathname: '/',
            href: 'https://www.facebook.com/',
            facebookMiniChatOpen: true
        });
        let mutationCalls = 0;
        const state = { unread: true };
        const nativeResult = Object.freeze({ moduleName });
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function (...args) {
                    mutationCalls += 1;
                    state.unread = false;
                    assert.deepStrictEqual(args, [threadKeyI64, watermarkI64, 95]);
                    return nativeResult;
                };
            }
        );

        assert.strictEqual(module.exports.default(threadKeyI64, watermarkI64, 95), nativeResult);
        assert.strictEqual(mutationCalls, 1, `${moduleName} must preserve its unconfirmed native leaf contract`);
        assert.strictEqual(state.unread, false, `${moduleName} must not be suppressed by an unproven alias`);
        assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0, 0);

        context.window.__GHOSTIFY_SETTINGS__.msgSeen = false;
        assert.strictEqual(module.exports.default(threadKeyI64, watermarkI64, 95), nativeResult);
        assert.strictEqual(mutationCalls, 2, `${moduleName} remains native when Hide Seen is disabled`);

        const requestContext = makeMessengerPatchPage({}, {
            hostname: 'www.facebook.com',
            pathname: '/messages/requests',
            href: 'https://www.facebook.com/messages/requests',
            facebookMiniChatOpen: true
        });
        let requestCalls = 0;
        const requestModule = registerMessengerModule(
            requestContext,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function () {
                    requestCalls += 1;
                    return nativeResult;
                };
            }
        );
        assert.strictEqual(requestModule.exports.default(threadKeyI64, watermarkI64, 95), nativeResult);
        assert.strictEqual(requestCalls, 1, `${moduleName} must remain native for Message Requests`);
    }
}

function testFacebookReadWrappersUpgradeAcrossLateAliasReexports() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);
    let mutationCalls = 0;
    const sharedLeaf = function () {
        mutationCalls += 1;
        return 'mutated';
    };

    const sanitizeModule = registerMessengerModule(
        context,
        'LSUpdateThreadReadWatermark',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = sharedLeaf;
        }
    );
    const exactModule = registerMessengerModule(
        context,
        'LSMarkThreadRead',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = sanitizeModule.exports.default;
        }
    );

    assert.strictEqual(exactModule.exports.default(threadKeyI64, watermarkI64, 95), undefined);
    assert.strictEqual(mutationCalls, 0, 'a late exact alias must upgrade an earlier sanitize wrapper');

    const reverseContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    });
    let reverseCalls = 0;
    const reverseLeaf = function () {
        reverseCalls += 1;
        return 'mutated';
    };
    const blockModule = registerMessengerModule(
        reverseContext,
        'LSMarkThreadRead',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = reverseLeaf;
        }
    );
    const laterSanitizeModule = registerMessengerModule(
        reverseContext,
        'LSUpdateThreadReadWatermark',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = blockModule.exports.default;
        }
    );
    assert.strictEqual(laterSanitizeModule.exports.default(threadKeyI64, watermarkI64, 95), undefined);
    assert.strictEqual(reverseCalls, 0, 'a late generic alias must not downgrade an exact block wrapper');

    const hookContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    });
    let hookNativeCalls = 0;
    const hookLeaf = function () {
        hookNativeCalls += 1;
        return function () { return Promise.resolve('native-hook-callback'); };
    };
    const hookModule = registerMessengerModule(
        hookContext,
        'useMWLSMarkThreadAsRead',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = hookLeaf;
        }
    );
    const hookToExactModule = registerMessengerModule(
        hookContext,
        'LSMarkThreadRead',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = hookModule.exports.default;
        }
    );
    const inheritedHookResult = hookToExactModule.exports.default(threadKeyI64, watermarkI64, 95);
    assert.strictEqual(typeof inheritedHookResult, 'function');
    assert.strictEqual(hookNativeCalls, 1, 'an unconfirmed alias must preserve the already-wrapped hook contract');

    const positionalToCursorContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    });
    let positionalToCursorCalls = 0;
    const positionalModule = registerMessengerModule(
        positionalToCursorContext,
        'LSUpdateThreadReadWatermark',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function () { positionalToCursorCalls += 1; return 'cursor-loaded'; };
        }
    );
    const cursorModule = registerMessengerModule(
        positionalToCursorContext,
        'LSReadWatermarkPaginationCursor',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = positionalModule.exports.default;
        }
    );
    assert.strictEqual(
        cursorModule.exports.default(threadKeyI64, watermarkI64, { cursor: 'redacted-cursor', direction: 'older' }),
        'cursor-loaded',
        'positional blocking must not spread from an allowlisted alias into a broad cursor helper re-export'
    );
    assert.strictEqual(positionalToCursorCalls, 1);
}

function testFacebookSendOpenMessageHooksForceNativeDisableMarkRead() {
    for (const moduleName of [
        'useMWV2SendOpenMessage',
        'useMWV2SendOpenMessageImpl',
        'useMWV2SendOpenMessageImplShared'
    ]) {
        const context = makeMessengerPatchPage({}, {
            hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
        });
        const nativeCallback = function () { return 'opened'; };
        const received = [];
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function (options) {
                    received.push(options);
                    return nativeCallback;
                };
            }
        );
        const options = Object.freeze({
            disableMarkRead: false,
            entryPoint: 'chat_list',
            thread: Object.freeze({ threadKey: 'redacted-thread', threadType: 'GROUP' })
        });

        const callback = module.exports.default(options);
        assert.strictEqual(callback, nativeCallback, `${moduleName} must preserve the native open callback identity`);
        assert.strictEqual(callback(), 'opened');
        assert.strictEqual(received.length, 1);
        assert.notStrictEqual(received[0], options, `${moduleName} must not mutate Facebook's frozen options object`);
        assert.strictEqual(received[0].disableMarkRead, true, `${moduleName} must use Facebook's native disableMarkRead control`);
        assert.strictEqual(received[0].thread, options.thread);
        assert.strictEqual(options.disableMarkRead, false);
    }

    for (const moduleName of [
        'useMWV2SendOpenMessage',
        'useMWV2SendOpenMessageImpl',
        'useMWV2SendOpenMessageImplShared'
    ]) {
        const context = makeMessengerPatchPage({}, {
            hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
        });
        const received = [];
        const unrelatedCalls = [];
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports[moduleName] = function (options) { received.push(options); return 'named-open'; };
                moduleObject.exports.unrelated = function (options) { unrelatedCalls.push(options); return 'unrelated'; };
            }
        );
        const options = Object.freeze({ disableMarkRead: false });
        assert.strictEqual(module.exports[moduleName](options), 'named-open');
        assert.notStrictEqual(received[0], options);
        assert.strictEqual(received[0].disableMarkRead, true, `${moduleName} exact named export must be patched`);
        assert.strictEqual(module.exports.unrelated(options), 'unrelated');
        assert.strictEqual(unrelatedCalls[0], options, `${moduleName} unrelated sibling export must remain native`);
    }

    const groupContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    });
    let receivedGroupOptions;
    const groupModule = registerMessengerModule(
        groupContext,
        'useMWV2SendOpenMessageImplShared',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (options) {
                receivedGroupOptions = options;
                return 'group-opened';
            };
        }
    );
    const groupOptionsWithoutFlag = Object.freeze({
        entryPoint: 'chat_list',
        thread: Object.freeze({ threadKey: 'redacted-group', threadType: 'GROUP' })
    });
    assert.strictEqual(groupModule.exports.default(groupOptionsWithoutFlag), 'group-opened');
    assert.notStrictEqual(receivedGroupOptions, groupOptionsWithoutFlag, 'group options without an explicit flag must be cloned');
    assert.strictEqual(receivedGroupOptions.disableMarkRead, true, 'group opens must opt into Facebook native unread preservation');
    assert.strictEqual(receivedGroupOptions.thread, groupOptionsWithoutFlag.thread);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(groupOptionsWithoutFlag, 'disableMarkRead'), false);

    const shapeContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    });
    const shapeCalls = [];
    const shapeModule = registerMessengerModule(
        shapeContext,
        'useMWV2SendOpenMessage',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (options) { shapeCalls.push(options); return 'shape-open'; };
        }
    );
    class CustomOpenOptions {
        constructor() { this.disableMarkRead = false; }
        open() { return true; }
    }
    const customOptions = new CustomOpenOptions();
    assert.strictEqual(shapeModule.exports.default(customOptions), 'shape-open');
    assert.strictEqual(shapeCalls[0], customOptions, 'custom-prototype options must remain native');
    assert.strictEqual(shapeCalls[0].open(), true);
    const nullPrototypeOptions = Object.assign(Object.create(null), { disableMarkRead: false, sibling: true });
    assert.strictEqual(shapeModule.exports.default(nullPrototypeOptions), 'shape-open');
    assert.notStrictEqual(shapeCalls[1], nullPrototypeOptions);
    assert.strictEqual(Object.getPrototypeOf(shapeCalls[1]), null, 'null-prototype options must retain their prototype');
    assert.strictEqual(shapeCalls[1].disableMarkRead, true);
    assert.strictEqual(shapeCalls[1].sibling, true);

    const settingsOffContext = makeMessengerPatchPage({ msgSeen: false }, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    });
    let settingsOffOptions;
    const settingsOffModule = registerMessengerModule(
        settingsOffContext,
        'useMWV2SendOpenMessage',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (options) {
                settingsOffOptions = options;
                return 'native-open';
            };
        }
    );
    const nativeOptions = { disableMarkRead: false, thread: { threadKey: 'redacted-thread' } };
    assert.strictEqual(settingsOffModule.exports.default(nativeOptions), 'native-open');
    assert.strictEqual(settingsOffOptions, nativeOptions, 'settings-off behavior must remain byte-for-byte native');

    const requestContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/messages/requests',
        href: 'https://www.facebook.com/messages/requests',
        facebookMiniChatOpen: true
    });
    let requestOptions;
    const requestModule = registerMessengerModule(
        requestContext,
        'useMWV2SendOpenMessage',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (options) {
                requestOptions = options;
                return 'request-opened';
            };
        }
    );
    const requestNativeOptions = { disableMarkRead: false, thread: { threadKey: 'redacted-request' } };
    assert.strictEqual(requestModule.exports.default(requestNativeOptions), 'request-opened');
    assert.strictEqual(requestOptions, requestNativeOptions, 'Message Requests must keep native open-message semantics');

    const identityContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    });
    const identityCalls = [];
    const identityThis = Object.freeze({ kind: 'native-this' });
    const identityCallback = function () { return 'stable-open'; };
    const identityModule = registerMessengerModule(
        identityContext,
        'useMWV2SendOpenMessageImplShared',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (...args) {
                identityCalls.push({ args, thisArg: this });
                return identityCallback;
            };
        }
    );
    const before = Object.freeze({ context: true });
    const firstOptions = Object.freeze({ disableMarkRead: false, threadKey: 'redacted-thread' });
    const laterOptions = Object.freeze({ disableMarkRead: false, threadKey: 'redacted-later-thread' });
    const after = Object.freeze({ trailing: true });
    assert.strictEqual(
        identityModule.exports.default.call(identityThis, before, firstOptions, laterOptions, after),
        identityCallback
    );
    assert.strictEqual(identityCalls[0].thisArg, identityThis);
    assert.strictEqual(identityCalls[0].args[0], before);
    assert.notStrictEqual(identityCalls[0].args[1], firstOptions);
    assert.strictEqual(identityCalls[0].args[1].disableMarkRead, true);
    assert.strictEqual(identityCalls[0].args[2], laterOptions, 'only the first exact options object may be cloned');
    assert.strictEqual(identityCalls[0].args[3], after);

    const alreadyDisabled = Object.freeze({ disableMarkRead: true, threadKey: 'redacted-thread' });
    assert.strictEqual(identityModule.exports.default(alreadyDisabled), identityCallback);
    assert.strictEqual(identityCalls[1].args[0], alreadyDisabled, 'already-disabled options must preserve identity');
    const absentFlag = Object.freeze({ context: 'not-open-options' });
    assert.strictEqual(identityModule.exports.default(absentFlag), identityCallback);
    assert.strictEqual(identityCalls[2].args[0], absentFlag, 'unrelated objects without a thread target must remain untouched');
    assert.strictEqual(identityModule.exports.default(firstOptions), identityCallback);
    assert.strictEqual(identityModule.exports.default(firstOptions), identityCallback);
    assert.strictEqual(identityCalls.length, 5, 'repeated calls must invoke the native hook exactly once each');

    const killedContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    });
    let killedOptions;
    const killedModule = registerMessengerModule(
        killedContext,
        'useMWV2SendOpenMessage',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (options) { killedOptions = options; return 'killed-open'; };
        }
    );
    killedContext.window.postMessage({
        type: 'GHOSTIFY_CONFIG_UPDATE',
        source: 'GHOSTIFY_EXTENSION',
        config: { killSwitch: ['msgSeen'] }
    });
    const killedNativeOptions = { disableMarkRead: false };
    assert.strictEqual(killedModule.exports.default(killedNativeOptions), 'killed-open');
    assert.strictEqual(killedOptions, killedNativeOptions, 'kill-switched behavior must remain native');

    const staleRequestContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    });
    let staleRequestOptions;
    const staleRequestModule = registerMessengerModule(
        staleRequestContext,
        'useMWV2SendOpenMessage',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (options) { staleRequestOptions = options; return 'stale-request-open'; };
        }
    );
    staleRequestContext.window.location.pathname = '/messages/requests';
    staleRequestContext.window.location.href = 'https://www.facebook.com/messages/requests';
    const staleRequestNativeOptions = { disableMarkRead: false };
    assert.strictEqual(staleRequestModule.exports.default(staleRequestNativeOptions), 'stale-request-open');
    assert.strictEqual(staleRequestOptions, staleRequestNativeOptions, 'a stale inbox wrapper must become native after request navigation');

    for (const page of [{
        label: 'Messenger.com',
        hostname: 'www.messenger.com', pathname: '/t/redacted-thread', href: 'https://www.messenger.com/t/redacted-thread'
    }, {
        label: 'Facebook MAW proxy',
        hostname: 'www.fbsbx.com', pathname: '/maw_proxy_page/', href: 'https://www.fbsbx.com/maw_proxy_page/'
    }]) {
        const context = makeMessengerPatchPage({}, page);
        let receivedOptions;
        const module = registerMessengerModule(
            context,
            'useMWV2SendOpenMessage',
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function (options) { receivedOptions = options; return 'host-native'; };
            }
        );
        const hostOptions = { disableMarkRead: false };
        assert.strictEqual(module.exports.default(hostOptions), 'host-native');
        assert.strictEqual(receivedOptions, hostOptions, `${page.label} must remain native`);
    }

    const negativeContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    });
    let negativeOptions;
    const negativeModule = registerMessengerModule(
        negativeContext,
        'useMWV2SendOpenMessageAnalytics',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (options) { negativeOptions = options; return 'analytics-native'; };
        }
    );
    const negativeNativeOptions = { disableMarkRead: false };
    assert.strictEqual(negativeModule.exports.default(negativeNativeOptions), 'analytics-native');
    assert.strictEqual(negativeOptions, negativeNativeOptions, 'unobserved suffix aliases must not be patched');
}

async function testFacebookThreadListPressUsesConsumerScopedUnreadSelector() {
    const facebookPage = {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    };
    const selectorError = new Error('native unread selector failure');
    const selectorCalls = [];
    const nativeRowHook = function (threadKey) {
        return `row:${threadKey}`;
    };
    const nativeSelector = function (...args) {
        selectorCalls.push({ args, thisArg: this });
        if (args[0]?.throwSelectorError) throw selectorError;
        return args[0]?.unread === true;
    };
    const selectorExports = Object.freeze({
        isThreadUnread: nativeSelector,
        useIsThreadUnread: nativeRowHook,
        sibling: Object.freeze({ contract: 'native' })
    });
    const navigationCalls = [];
    const callback = function () { return 'thread-opened'; };
    let requiredSelector;
    const context = makeMessengerPatchPage({}, facebookPage);
    const module = registerMessengerModuleWithDependencies(
        context,
        'useOnPressMWThreadListItem',
        ['MWPIsThreadUnread'],
        { MWPIsThreadUnread: selectorExports },
        function (_a, require, importDefault, importAll, moduleObject) {
            const first = require('MWPIsThreadUnread');
            const second = importDefault('MWPIsThreadUnread');
            const third = importAll('MWPIsThreadUnread');
            requiredSelector = first;
            moduleObject.exports.requiredSelectors = [first, second, third];
            moduleObject.exports.openThread = function (record, returnMode) {
                const isUnread = first.isThreadUnread.call(first, record, 'preserve-args');
                const payload = {
                    clientThreadKey: record.clientThreadKey,
                    isUnread,
                    threadKey: record.threadKey,
                    threadType: record.threadType
                };
                navigationCalls.push(payload);
                if (isUnread) record.modeledLocalReadMutations += 1;
                if (returnMode === 'promise') return Promise.resolve(payload);
                return callback;
            };
        }
    );

    const unreadGroup = {
        clientThreadKey: 'redacted-client-thread',
        modeledLocalReadMutations: 0,
        threadKey: 'redacted-group-thread',
        threadType: 'GROUP',
        unread: true
    };
    assert.strictEqual(module.exports.openThread(unreadGroup, 'callback'), callback);
    assert.strictEqual(callback(), 'thread-opened', 'the native navigation callback contract must remain intact');
    assert.strictEqual(navigationCalls[0].isUnread, false, 'only the OnPress navigation descriptor must see unread=false');
    assert.strictEqual(unreadGroup.modeledLocalReadMutations, 0, 'the modeled local read transition must not run');
    assert.strictEqual(selectorCalls.length, 1, 'the native selector must still run exactly once');
    assert.strictEqual(selectorCalls[0].thisArg, requiredSelector, 'the selector wrapper must preserve its received this value');
    assert.strictEqual(selectorCalls[0].args[0], unreadGroup);
    assert.strictEqual(selectorCalls[0].args[1], 'preserve-args', 'the selector wrapper must preserve every argument');
    assert.notStrictEqual(requiredSelector, selectorExports, 'the OnPress consumer must receive a scoped dependency shadow');
    assert.strictEqual(Object.getPrototypeOf(requiredSelector), Object.getPrototypeOf(selectorExports));
    assert.strictEqual(requiredSelector.useIsThreadUnread, nativeRowHook, 'the React row hook must remain native');
    assert.strictEqual(requiredSelector.sibling, selectorExports.sibling, 'unrelated selector exports must remain native');
    assert.strictEqual(Object.isFrozen(selectorExports), true, 'the frozen native export object must stay untouched');
    assert.strictEqual(selectorExports.isThreadUnread, nativeSelector);
    assert.strictEqual(module.exports.requiredSelectors[0], module.exports.requiredSelectors[1]);
    assert.strictEqual(module.exports.requiredSelectors[1], module.exports.requiredSelectors[2], 'all require forms must share one stable shadow');

    const alreadyReadGroup = {
        clientThreadKey: 'redacted-client-thread-2',
        modeledLocalReadMutations: 0,
        threadKey: 'redacted-read-group',
        threadType: 'GROUP',
        unread: false
    };
    const asyncResult = module.exports.openThread(alreadyReadGroup, 'promise');
    assert.ok(asyncResult && typeof asyncResult.then === 'function', 'Promise navigation must remain thenable');
    assert.strictEqual((await asyncResult).isUnread, false, 'native false must remain false');
    assert.strictEqual(alreadyReadGroup.modeledLocalReadMutations, 0);
    assert.strictEqual(selectorCalls.length, 2);

    assert.throws(
        () => module.exports.openThread({ throwSelectorError: true }, 'callback'),
        error => error === selectorError,
        'native selector errors must propagate without translation'
    );

    let rowRequiredSelector;
    const rowModule = registerMessengerModuleWithDependencies(
        context,
        'MWThreadListItemReact',
        ['MWPIsThreadUnread'],
        { MWPIsThreadUnread: selectorExports },
        function (_a, require, _c, _d, moduleObject) {
            rowRequiredSelector = require('MWPIsThreadUnread');
            moduleObject.exports.render = function (record) {
                return {
                    hook: rowRequiredSelector.useIsThreadUnread(record.threadKey),
                    unread: rowRequiredSelector.isThreadUnread(record)
                };
            };
        }
    );
    const renderedRow = rowModule.exports.render({ threadKey: 'redacted-group-thread', unread: true });
    assert.notStrictEqual(rowRequiredSelector, selectorExports, 'row rendering must receive only a consumer-scoped selector shadow');
    assert.strictEqual(rowRequiredSelector.sibling, selectorExports.sibling);
    assert.strictEqual(selectorExports.isThreadUnread, nativeSelector, 'the global native selector export must remain untouched');
    assert.deepStrictEqual(renderedRow, { hook: 'row:redacted-group-thread', unread: true });
}

function testFacebookMessageListUsesNativeManualUnreadGuard() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const dependencyName = 'useMWPMessageListOnScrollToBottom';
    const nativeHookError = new Error('native message-list hook failure');
    const nativeHookThis = Object.freeze({ contract: 'native-hook-this' });
    const nativeGuardThis = Object.freeze({ contract: 'native-guard-this' });
    const nativeHookCalls = [];
    const nativeGuardCalls = [];
    const nativeReturn = function (...args) {
        return { args, contract: 'native-return' };
    };
    nativeReturn.cleanup = function () { return 'native-cleanup'; };
    const nativeGuard = function (...args) {
        nativeGuardCalls.push({ args, thisArg: this });
        return false;
    };
    const nativeHook = function (...args) {
        nativeHookCalls.push({ args, thisArg: this });
        if (args[5]?.throwHookError) throw nativeHookError;
        assert.strictEqual(args[0].call(nativeGuardThis, 'guard-arg'), true);
        return nativeReturn;
    };
    let requiredHook;
    const module = registerMessengerModuleWithDependencies(
        context,
        'MWPRelayBaseMessageListReact',
        [dependencyName],
        { [dependencyName]: nativeHook },
        function (_a, require, importDefault, importAll, moduleObject) {
            const first = require(dependencyName);
            const second = importDefault(dependencyName);
            const third = importAll(dependencyName);
            requiredHook = first;
            moduleObject.exports.requiredHooks = [first, second, third];
            moduleObject.exports.render = function (guard, entryPoint, hasNext, onScrollToBottom, scrollAreaRef, thread) {
                return first.call(
                    nativeHookThis,
                    guard,
                    entryPoint,
                    hasNext,
                    onScrollToBottom,
                    scrollAreaRef,
                    thread
                );
            };
        }
    );

    const entryPoint = Object.freeze({ entryPoint: 'popup-chat-box' });
    const onScrollToBottom = function () { return 'native-scroll'; };
    const scrollAreaRef = Object.freeze({ current: null });
    const thread = Object.freeze({ threadKey: 'redacted-group-thread', threadType: 'GROUP' });
    const firstResult = module.exports.render(
        nativeGuard,
        entryPoint,
        false,
        onScrollToBottom,
        scrollAreaRef,
        thread
    );
    assert.strictEqual(firstResult, nativeReturn, 'the native hook return must be forwarded by identity');
    assert.deepStrictEqual(firstResult('return-arg'), {
        args: ['return-arg'],
        contract: 'native-return'
    });
    assert.strictEqual(firstResult.cleanup(), 'native-cleanup', 'native cleanup behavior must remain intact');
    assert.strictEqual(nativeHookCalls.length, 1, 'the native message-list hook must execute exactly once');
    assert.strictEqual(nativeHookCalls[0].thisArg, nativeHookThis, 'the hook shadow must preserve this');
    assert.notStrictEqual(nativeHookCalls[0].args[0], nativeGuard, 'only the native manual-unread predicate may be shadowed');
    assert.strictEqual(nativeHookCalls[0].args[1], entryPoint);
    assert.strictEqual(nativeHookCalls[0].args[2], false);
    assert.strictEqual(nativeHookCalls[0].args[3], onScrollToBottom);
    assert.strictEqual(nativeHookCalls[0].args[4], scrollAreaRef);
    assert.strictEqual(nativeHookCalls[0].args[5], thread, 'all non-predicate arguments must preserve identity');
    assert.strictEqual(nativeGuardCalls.length, 0, 'active Hide Seen must use the native manual-unread branch without calling the original predicate');
    assert.notStrictEqual(requiredHook, nativeHook, 'the exact consumer must receive a scoped hook shadow');
    assert.strictEqual(module.exports.requiredHooks[0], module.exports.requiredHooks[1]);
    assert.strictEqual(module.exports.requiredHooks[1], module.exports.requiredHooks[2], 'all require forms must share one stable hook shadow');

    assert.strictEqual(
        module.exports.render(nativeGuard, entryPoint, false, onScrollToBottom, scrollAreaRef, thread),
        nativeReturn
    );
    assert.strictEqual(nativeHookCalls.length, 2);
    assert.strictEqual(
        nativeHookCalls[1].args[0],
        nativeHookCalls[0].args[0],
        'the predicate wrapper must keep stable identity across renders'
    );
    assert.strictEqual(nativeGuardCalls.length, 0);

    assert.throws(
        () => module.exports.render(
            nativeGuard,
            entryPoint,
            false,
            onScrollToBottom,
            scrollAreaRef,
            { throwHookError: true }
        ),
        error => error === nativeHookError,
        'native hook errors must propagate without translation'
    );
}

function testFacebookMessageListManualUnreadGuardPreservesNativeBypasses() {
    const facebookPage = () => ({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const dependencyName = 'useMWPMessageListOnScrollToBottom';
    const registerConsumer = (
        context,
        moduleName = 'MWPRelayBaseMessageListReact',
        requiredName = dependencyName
    ) => {
        const guardError = new Error('native manual-unread predicate failure');
        const guardThis = Object.freeze({ contract: 'native-guard-this' });
        const guardCalls = [];
        const nativeGuard = function (...args) {
            guardCalls.push({ args, thisArg: this });
            if (args[0] === 'throw') throw guardError;
            return 'native-guard-result';
        };
        const nativeHook = function (guard, ...args) {
            return {
                args,
                guardResult: guard.call(guardThis, args[4]?.guardInput || 'guard-arg')
            };
        };
        let requiredHook;
        const module = registerMessengerModuleWithDependencies(
            context,
            moduleName,
            [requiredName],
            { [requiredName]: nativeHook },
            function (_a, require, _c, _d, moduleObject) {
                requiredHook = require(requiredName);
                moduleObject.exports.render = function (thread = {}) {
                    return requiredHook(
                        nativeGuard,
                        'entry-point',
                        false,
                        'scroll-callback',
                        'scroll-ref',
                        thread
                    );
                };
            }
        );
        return {
            context,
            guardCalls,
            guardError,
            guardThis,
            module,
            nativeGuard,
            nativeHook,
            get requiredHook() { return requiredHook; }
        };
    };
    const assertNative = (fixture, label) => {
        const before = fixture.guardCalls.length;
        const result = fixture.module.exports.render();
        assert.strictEqual(result.guardResult, 'native-guard-result', `${label} must call the native predicate`);
        assert.strictEqual(fixture.guardCalls.length, before + 1);
        assert.strictEqual(fixture.guardCalls[before].thisArg, fixture.guardThis, `${label} must preserve predicate this`);
        assert.deepStrictEqual(fixture.guardCalls[before].args, ['guard-arg'], `${label} must preserve predicate arguments`);
    };

    const toggled = registerConsumer(makeMessengerPatchPage({}, facebookPage()));
    assert.strictEqual(toggled.module.exports.render().guardResult, true);
    assert.strictEqual(toggled.guardCalls.length, 0);
    toggled.context.window.postMessage({
        type: 'GHOSTIFY_SETTINGS_UPDATE',
        source: 'GHOSTIFY_EXTENSION',
        settings: { msgSeen: false }
    });
    assertNative(toggled, 'settings-off behavior');
    assert.throws(
        () => toggled.module.exports.render({ guardInput: 'throw' }),
        error => error === toggled.guardError,
        'native predicate errors must propagate when the runtime bypass is active'
    );
    toggled.context.window.postMessage({
        type: 'GHOSTIFY_SETTINGS_UPDATE',
        source: 'GHOSTIFY_EXTENSION',
        settings: { msgSeen: true }
    });
    assert.strictEqual(toggled.module.exports.render().guardResult, true, 'reenabling Hide Seen must affect the existing shadow');

    const killed = registerConsumer(makeMessengerPatchPage({}, facebookPage()));
    killed.context.window.postMessage({
        type: 'GHOSTIFY_CONFIG_UPDATE',
        source: 'GHOSTIFY_EXTENSION',
        config: { killSwitch: ['msgSeen'] }
    });
    assertNative(killed, 'kill-switched behavior');
    killed.context.window.postMessage({
        type: 'GHOSTIFY_CONFIG_UPDATE',
        source: 'GHOSTIFY_EXTENSION',
        config: { killSwitch: [] }
    });
    assert.strictEqual(killed.module.exports.render().guardResult, true, 'removing the kill switch must reactivate the existing shadow');

    const request = registerConsumer(makeMessengerPatchPage({}, {
        ...facebookPage(),
        pathname: '/messages/requests',
        href: 'https://www.facebook.com/messages/requests'
    }));
    assertNative(request, 'Message Requests');

    const staleRequest = registerConsumer(makeMessengerPatchPage({}, facebookPage()));
    assert.strictEqual(staleRequest.module.exports.render().guardResult, true);
    staleRequest.context.window.location.pathname = '/messages/requests';
    staleRequest.context.window.location.href = 'https://www.facebook.com/messages/requests';
    assertNative(staleRequest, 'stale wrapper after Message Requests navigation');

    for (const page of [{
        label: 'Messenger.com',
        hostname: 'www.messenger.com',
        pathname: '/t/redacted-thread',
        href: 'https://www.messenger.com/t/redacted-thread'
    }]) {
        const fixture = registerConsumer(makeMessengerPatchPage({}, page));
        assertNative(fixture, page.label);
        assert.strictEqual(fixture.requiredHook, fixture.nativeHook, `${page.label} must retain the native dependency`);
    }

    const childContext = makeMessengerPatchPage({}, facebookPage());
    childContext.window.top = {};
    const child = registerConsumer(childContext);
    assertNative(child, 'Facebook child frame');
    assert.strictEqual(child.requiredHook, child.nativeHook);

    const wrongConsumer = registerConsumer(
        makeMessengerPatchPage({}, facebookPage()),
        'MWPRelayBaseMessageListReactAnalytics'
    );
    assertNative(wrongConsumer, 'suffix consumer identity');
    assert.strictEqual(wrongConsumer.requiredHook, wrongConsumer.nativeHook);

    const wrongDependency = registerConsumer(
        makeMessengerPatchPage({}, facebookPage()),
        'MWPRelayBaseMessageListReact',
        'useMWPMessageListOnScrollToBottom.bs'
    );
    assertNative(wrongDependency, 'suffix dependency identity');
    assert.strictEqual(wrongDependency.requiredHook, wrongDependency.nativeHook);
}

function testFacebookMessageListManualUnreadGuardPreservesExportShapes() {
    const dependencyName = 'useMWPMessageListOnScrollToBottom';
    const registerShape = (dependencyExports, selectHook) => {
        const context = makeMessengerPatchPage({}, {
            hostname: 'www.facebook.com',
            pathname: '/',
            href: 'https://www.facebook.com/',
            facebookMiniChatOpen: true
        });
        let first;
        let second;
        let third;
        const module = registerMessengerModuleWithDependencies(
            context,
            'MWPRelayBaseMessageListReact',
            [dependencyName],
            { [dependencyName]: dependencyExports },
            function (_a, require, importDefault, importAll, moduleObject) {
                first = require(dependencyName);
                second = importDefault(dependencyName);
                third = importAll(dependencyName);
                moduleObject.exports.render = guard => selectHook(first)(
                    guard,
                    'entry-point',
                    false,
                    'scroll-callback',
                    'scroll-ref',
                    'thread'
                );
            }
        );
        return { first, module, second, third };
    };
    const createNativeHook = calls => function (...args) {
        calls.push({ args, thisArg: this });
        return Object.freeze({ contract: 'native-return', guardResult: args[0]('guard-arg') });
    };
    const nativeGuard = function () { throw new Error('active wrapper must not call the native guard'); };

    const directCalls = [];
    const directHook = createNativeHook(directCalls);
    const direct = registerShape(directHook, value => value);
    assert.deepStrictEqual(direct.module.exports.render(nativeGuard), {
        contract: 'native-return',
        guardResult: true
    });
    assert.strictEqual(directCalls.length, 1);
    assert.notStrictEqual(direct.first, directHook);
    assert.strictEqual(direct.first, direct.second);
    assert.strictEqual(direct.second, direct.third, 'direct-function require forms must share one stable shadow');

    const defaultCalls = [];
    const defaultHook = createNativeHook(defaultCalls);
    const defaultSibling = Object.freeze({ contract: 'native-default-sibling' });
    const defaultExports = Object.freeze({ default: defaultHook, sibling: defaultSibling });
    const defaultShape = registerShape(defaultExports, value => value.default);
    assert.strictEqual(defaultShape.module.exports.render(nativeGuard).guardResult, true);
    assert.notStrictEqual(defaultShape.first, defaultExports);
    assert.strictEqual(defaultShape.first, defaultShape.second);
    assert.strictEqual(defaultShape.second, defaultShape.third);
    assert.strictEqual(defaultShape.first.sibling, defaultSibling);
    assert.strictEqual(defaultExports.default, defaultHook, 'frozen default exports must remain untouched');

    const namedCalls = [];
    const namedHook = createNativeHook(namedCalls);
    const namedExports = Object.freeze({
        useMWPMessageListOnScrollToBottom: namedHook,
        sibling: 'native-named-sibling'
    });
    const named = registerShape(namedExports, value => value.useMWPMessageListOnScrollToBottom);
    assert.strictEqual(named.module.exports.render(nativeGuard).guardResult, true);
    assert.strictEqual(named.first.sibling, 'native-named-sibling');
    assert.strictEqual(namedExports.useMWPMessageListOnScrollToBottom, namedHook);

    let getterCalls = 0;
    const accessorCalls = [];
    const accessorHook = createNativeHook(accessorCalls);
    const accessorExports = {};
    Object.defineProperties(accessorExports, {
        default: {
            configurable: false,
            enumerable: false,
            get() {
                getterCalls += 1;
                return accessorHook;
            }
        },
        sibling: {
            configurable: false,
            enumerable: true,
            value: 'native-accessor-sibling',
            writable: false
        }
    });
    Object.freeze(accessorExports);
    const accessor = registerShape(accessorExports, value => value.default);
    assert.strictEqual(accessor.module.exports.render(nativeGuard).guardResult, true);
    assert.ok(getterCalls >= 1, 'the native accessor must still supply the hook');
    assert.strictEqual(Object.getOwnPropertyDescriptor(accessor.first, 'default').enumerable, false);
    assert.strictEqual(accessor.first.sibling, 'native-accessor-sibling');
    assert.strictEqual(accessorExports.default, accessorHook, 'the frozen native accessor must remain untouched');
}

function testFacebookSafelyMarkReadConsumerShadowsNativeTriggerCallback() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const dependencyName = 'useMWMarkThreadAsReadWhenNewMessagesArrive';
    const nativeError = new Error('native mark-read trigger hook failure');
    const nativeThis = Object.freeze({ contract: 'native-this' });
    const nativeHookCalls = [];
    const nativeReturns = [];
    let modeledLocalReadMutations = 0;
    const nativeMarkRead = function () {
        modeledLocalReadMutations += 1;
        return 'native-mark-read';
    };
    const nativeTriggerHook = function (...args) {
        nativeHookCalls.push({ args, thisArg: this });
        if (args[0]?.throwNative) throw nativeError;
        const capturedMarkRead = args[1];
        capturedMarkRead('effect');
        const nativeReturn = function (...callbackArgs) {
            capturedMarkRead('returned-callback');
            return { callbackArgs, contract: 'native-return' };
        };
        nativeReturn.cleanup = function () { return 'native-cleanup'; };
        nativeReturns.push(nativeReturn);
        return nativeReturn;
    };
    let requiredTrigger;
    const module = registerMessengerModuleWithDependencies(
        context,
        'useMWPSafelyMarkThreadAsRead',
        [dependencyName],
        { [dependencyName]: nativeTriggerHook },
        function (_a, require, _c, _d, moduleObject) {
            requiredTrigger = require(dependencyName);
            moduleObject.exports.openThread = function (thread, predicateA, predicateL) {
                return requiredTrigger.call(
                    nativeThis,
                    thread,
                    nativeMarkRead,
                    predicateA,
                    predicateL
                );
            };
        }
    );

    const thread = Object.freeze({ threadKey: 'redacted-group-thread', threadType: 'GROUP' });
    const predicateA = function () { return true; };
    const predicateL = function () { return false; };
    const first = module.exports.openThread(thread, predicateA, predicateL);
    assert.strictEqual(first, nativeReturns[0], 'the native hook return must be forwarded by identity');
    assert.strictEqual(first.cleanup(), 'native-cleanup', 'cleanup behavior on the native return must remain intact');
    assert.deepStrictEqual(first('preserve-callback-args'), {
        callbackArgs: ['preserve-callback-args'],
        contract: 'native-return'
    });
    assert.strictEqual(modeledLocalReadMutations, 0, 'neither the internal effect nor returned callback may invoke native mark-read');
    assert.strictEqual(nativeHookCalls.length, 1, 'the native trigger hook must execute exactly once');
    assert.strictEqual(nativeHookCalls[0].thisArg, nativeThis, 'the dependency shadow must preserve this');
    assert.strictEqual(nativeHookCalls[0].args[0], thread);
    assert.strictEqual(nativeHookCalls[0].args[2], predicateA);
    assert.strictEqual(nativeHookCalls[0].args[3], predicateL, 'all arguments except the mark-read callback must remain exact');
    assert.notStrictEqual(nativeHookCalls[0].args[1], nativeMarkRead, 'the consumer-scoped hook must not capture native mark-read');
    assert.strictEqual(nativeHookCalls[0].args[1]('sync-contract'), undefined, 'the replacement callback must be a synchronous no-op');

    const second = module.exports.openThread(thread, predicateA, predicateL);
    assert.strictEqual(second, nativeReturns[1]);
    assert.strictEqual(
        nativeHookCalls[1].args[1],
        nativeHookCalls[0].args[1],
        'the replacement callback must have stable identity across renders'
    );
    assert.strictEqual(modeledLocalReadMutations, 0);

    assert.throws(
        () => module.exports.openThread({ throwNative: true }, predicateA, predicateL),
        error => error === nativeError,
        'native hook errors must propagate without translation'
    );
}

function testFacebookSafelyMarkReadConsumerPreservesNativeBypasses() {
    const facebookPage = () => ({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const dependencyName = 'useMWMarkThreadAsReadWhenNewMessagesArrive';
    const registerConsumer = (
        context,
        moduleName = 'useMWPSafelyMarkThreadAsRead',
        requiredName = dependencyName
    ) => {
        let modeledMutations = 0;
        const receivedMarkReads = [];
        const nativeMarkRead = function () { modeledMutations += 1; };
        const nativeTrigger = function (thread, markRead, predicateA, predicateL) {
            receivedMarkReads.push(markRead);
            markRead('effect');
            return function () {
                markRead('returned-callback');
                return { predicateA, predicateL, thread };
            };
        };
        let requiredTrigger;
        const module = registerMessengerModuleWithDependencies(
            context,
            moduleName,
            [requiredName],
            { [requiredName]: nativeTrigger },
            function (_a, require, _c, _d, moduleObject) {
                requiredTrigger = require(requiredName);
                moduleObject.exports.openThread = function () {
                    return requiredTrigger(
                        { threadKey: 'redacted-thread' },
                        nativeMarkRead,
                        'predicate-a',
                        'predicate-l'
                    );
                };
            }
        );
        return {
            get modeledMutations() { return modeledMutations; },
            module,
            nativeMarkRead,
            nativeTrigger,
            receivedMarkReads,
            requiredTrigger
        };
    };
    const assertNative = (fixture, label) => {
        const result = fixture.module.exports.openThread();
        assert.strictEqual(fixture.modeledMutations, 1, `${label} must keep the native internal effect`);
        assert.deepStrictEqual(result(), {
            predicateA: 'predicate-a',
            predicateL: 'predicate-l',
            thread: { threadKey: 'redacted-thread' }
        });
        assert.strictEqual(fixture.modeledMutations, 2, `${label} must keep the native returned callback`);
    };

    assertNative(
        registerConsumer(makeMessengerPatchPage({ msgSeen: false }, facebookPage())),
        'settings-off behavior'
    );

    const killedContext = makeMessengerPatchPage({}, facebookPage());
    const killed = registerConsumer(killedContext);
    killedContext.window.postMessage({
        type: 'GHOSTIFY_CONFIG_UPDATE',
        source: 'GHOSTIFY_EXTENSION',
        config: { killSwitch: ['msgSeen'] }
    });
    assertNative(killed, 'kill-switched behavior');

    const request = registerConsumer(makeMessengerPatchPage({}, {
        ...facebookPage(),
        pathname: '/messages/requests',
        href: 'https://www.facebook.com/messages/requests'
    }));
    assertNative(request, 'Message Requests');

    const staleContext = makeMessengerPatchPage({}, facebookPage());
    const stale = registerConsumer(staleContext);
    const blocked = stale.module.exports.openThread();
    blocked();
    assert.strictEqual(stale.modeledMutations, 0);
    staleContext.window.location.pathname = '/messages/requests';
    staleContext.window.location.href = 'https://www.facebook.com/messages/requests';
    assertNative(stale, 'stale wrapper after Message Requests navigation');

    for (const page of [{
        label: 'Messenger.com',
        hostname: 'www.messenger.com',
        pathname: '/t/redacted-thread',
        href: 'https://www.messenger.com/t/redacted-thread'
    }]) {
        const fixture = registerConsumer(makeMessengerPatchPage({}, page));
        assert.strictEqual(fixture.requiredTrigger, fixture.nativeTrigger);
        assertNative(fixture, page.label);
    }

    const childFrameContext = makeMessengerPatchPage({}, facebookPage());
    childFrameContext.window.top = {};
    const childFrame = registerConsumer(childFrameContext);
    childFrame.module.exports.openThread();
    assert.strictEqual(childFrame.modeledMutations, 1, 'the exact consumer shadow must not replace child-frame mark-read');
    assert.strictEqual(childFrame.receivedMarkReads[0], childFrame.nativeMarkRead);

    const wrongConsumer = registerConsumer(
        makeMessengerPatchPage({}, facebookPage()),
        'useMWPSafelyMarkThreadAsReadAnalytics'
    );
    wrongConsumer.module.exports.openThread();
    assert.strictEqual(wrongConsumer.modeledMutations, 1, 'the exact consumer shadow must not replace suffix-consumer mark-read');
    assert.strictEqual(wrongConsumer.receivedMarkReads[0], wrongConsumer.nativeMarkRead);

    const wrongDependency = registerConsumer(
        makeMessengerPatchPage({}, facebookPage()),
        'useMWPSafelyMarkThreadAsRead',
        'useMWMarkThreadAsReadWhenNewMessagesArrive.bs'
    );
    assert.strictEqual(wrongDependency.requiredTrigger, wrongDependency.nativeTrigger);
    assertNative(wrongDependency, 'suffix dependency identity');
}

function testFacebookSafelyMarkReadConsumerPreservesExportDescriptors() {
    const dependencyName = 'useMWMarkThreadAsReadWhenNewMessagesArrive';
    const registerShape = (dependencyExports, selectHook) => {
        const context = makeMessengerPatchPage({}, {
            hostname: 'www.facebook.com',
            pathname: '/',
            href: 'https://www.facebook.com/',
            facebookMiniChatOpen: true
        });
        let first;
        let second;
        let third;
        let mutations = 0;
        const nativeMarkRead = function () { mutations += 1; };
        const module = registerMessengerModuleWithDependencies(
            context,
            'useMWPSafelyMarkThreadAsRead',
            [dependencyName],
            { [dependencyName]: dependencyExports },
            function (_a, require, importDefault, importAll, moduleObject) {
                first = require(dependencyName);
                second = importDefault(dependencyName);
                third = importAll(dependencyName);
                moduleObject.exports.openThread = function () {
                    return selectHook(first)({ threadKey: 'redacted-group' }, nativeMarkRead, true, false);
                };
            }
        );
        return {
            first,
            get mutations() { return mutations; },
            module,
            second,
            third
        };
    };
    const createNativeHook = calls => function (thread, markRead, predicateA, predicateL) {
        calls.push({ predicateA, predicateL, thread });
        markRead('effect');
        return function () { markRead('returned-callback'); return 'native-return'; };
    };

    const directCalls = [];
    const directHook = createNativeHook(directCalls);
    const direct = registerShape(directHook, value => value);
    const directResult = direct.module.exports.openThread();
    assert.strictEqual(directResult(), 'native-return');
    assert.strictEqual(direct.mutations, 0);
    assert.strictEqual(directCalls.length, 1);
    assert.strictEqual(direct.first, direct.second);
    assert.strictEqual(direct.second, direct.third, 'all require forms must share the same direct-function shadow');
    assert.notStrictEqual(direct.first, directHook);

    const defaultCalls = [];
    const defaultHook = createNativeHook(defaultCalls);
    const defaultExports = Object.freeze({
        default: defaultHook,
        sibling: Object.freeze({ contract: 'native-default-sibling' })
    });
    const defaultShape = registerShape(defaultExports, value => value.default);
    const defaultResult = defaultShape.module.exports.openThread();
    assert.strictEqual(defaultResult(), 'native-return');
    assert.strictEqual(defaultShape.mutations, 0);
    assert.notStrictEqual(defaultShape.first, defaultExports);
    assert.strictEqual(defaultShape.first, defaultShape.second);
    assert.strictEqual(defaultShape.second, defaultShape.third);
    assert.strictEqual(defaultShape.first.sibling, defaultExports.sibling);
    assert.strictEqual(defaultExports.default, defaultHook, 'frozen default exports must remain untouched');

    const namedCalls = [];
    const namedHook = createNativeHook(namedCalls);
    const namedExports = Object.freeze({
        useMWMarkThreadAsReadWhenNewMessagesArrive: namedHook,
        sibling: 'native-named-sibling'
    });
    const named = registerShape(
        namedExports,
        value => value.useMWMarkThreadAsReadWhenNewMessagesArrive
    );
    const namedResult = named.module.exports.openThread();
    assert.strictEqual(namedResult(), 'native-return');
    assert.strictEqual(named.mutations, 0);
    assert.strictEqual(named.first.sibling, 'native-named-sibling');
    assert.strictEqual(namedExports.useMWMarkThreadAsReadWhenNewMessagesArrive, namedHook);

    let getterCalls = 0;
    const accessorCalls = [];
    const accessorHook = createNativeHook(accessorCalls);
    const accessorExports = {};
    Object.defineProperties(accessorExports, {
        default: {
            configurable: false,
            enumerable: false,
            get() {
                getterCalls += 1;
                return accessorHook;
            }
        },
        sibling: {
            configurable: false,
            enumerable: true,
            value: 'native-accessor-sibling',
            writable: false
        }
    });
    Object.freeze(accessorExports);
    const accessor = registerShape(accessorExports, value => value.default);
    const accessorResult = accessor.module.exports.openThread();
    assert.strictEqual(accessorResult(), 'native-return');
    assert.strictEqual(accessor.mutations, 0);
    assert.ok(getterCalls >= 1, 'the native accessor must still supply the trigger hook');
    assert.strictEqual(Object.getOwnPropertyDescriptor(accessor.first, 'default').enumerable, false);
    assert.strictEqual(accessor.first.sibling, 'native-accessor-sibling');
    assert.strictEqual(accessorExports.default, accessorHook, 'the frozen native accessor must remain untouched');
}

function testFacebookThreadListPressUnreadSelectorPreservesNativeBypasses() {
    const makePage = () => ({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const registerSelectorConsumer = (context, moduleName = 'useOnPressMWThreadListItem', dependencyName = 'MWPIsThreadUnread') => {
        const selectorExports = {
            isThreadUnread() { return true; },
            useIsThreadUnread() { return true; }
        };
        let requiredSelector;
        const module = registerMessengerModuleWithDependencies(
            context,
            moduleName,
            [dependencyName],
            { [dependencyName]: selectorExports },
            function (_a, require, _c, _d, moduleObject) {
                requiredSelector = require(dependencyName);
                moduleObject.exports.openThread = record => requiredSelector.isThreadUnread(record);
            }
        );
        return { module, requiredSelector, selectorExports };
    };

    const settingsOffContext = makeMessengerPatchPage({ msgSeen: false }, makePage());
    const settingsOff = registerSelectorConsumer(settingsOffContext);
    assert.strictEqual(settingsOff.module.exports.openThread({}), true, 'settings-off behavior must remain native');

    const killedContext = makeMessengerPatchPage({}, makePage());
    const killed = registerSelectorConsumer(killedContext);
    killedContext.window.postMessage({
        type: 'GHOSTIFY_CONFIG_UPDATE',
        source: 'GHOSTIFY_EXTENSION',
        config: { killSwitch: ['msgSeen'] }
    });
    assert.strictEqual(killed.module.exports.openThread({}), true, 'kill-switched behavior must remain native');

    const requestContext = makeMessengerPatchPage({}, {
        ...makePage(),
        pathname: '/messages/requests',
        href: 'https://www.facebook.com/messages/requests'
    });
    const request = registerSelectorConsumer(requestContext);
    assert.strictEqual(request.module.exports.openThread({}), true, 'Message Requests must retain native unread navigation');

    const staleRouteContext = makeMessengerPatchPage({}, makePage());
    const staleRoute = registerSelectorConsumer(staleRouteContext);
    assert.strictEqual(staleRoute.module.exports.openThread({}), false);
    staleRouteContext.window.location.pathname = '/messages/requests';
    staleRouteContext.window.location.href = 'https://www.facebook.com/messages/requests';
    assert.strictEqual(staleRoute.module.exports.openThread({}), true, 'a stale wrapper must become native after request navigation');

    const toggledContext = makeMessengerPatchPage({}, makePage());
    const toggled = registerSelectorConsumer(toggledContext);
    assert.strictEqual(toggled.module.exports.openThread({}), false);
    toggledContext.window.postMessage({
        type: 'GHOSTIFY_SETTINGS_UPDATE',
        source: 'GHOSTIFY_EXTENSION',
        settings: { msgSeen: false }
    });
    assert.strictEqual(toggled.module.exports.openThread({}), true, 'settings changes must affect an already-created selector shadow');

    for (const page of [{
        label: 'Messenger.com',
        hostname: 'www.messenger.com',
        pathname: '/t/redacted-thread',
        href: 'https://www.messenger.com/t/redacted-thread'
    }, {
        label: 'Facebook MAW proxy',
        hostname: 'www.fbsbx.com',
        pathname: '/maw_proxy_page/',
        href: 'https://www.fbsbx.com/maw_proxy_page/'
    }]) {
        const nativeHost = registerSelectorConsumer(makeMessengerPatchPage({}, page));
        assert.strictEqual(nativeHost.module.exports.openThread({}), true, `${page.label} must remain native`);
        assert.strictEqual(nativeHost.requiredSelector, nativeHost.selectorExports);
    }

    const childFrameContext = makeMessengerPatchPage({}, makePage());
    childFrameContext.window.top = {};
    const childFrame = registerSelectorConsumer(childFrameContext);
    assert.strictEqual(childFrame.module.exports.openThread({}), true, 'Facebook child frames must remain native');
    assert.strictEqual(childFrame.requiredSelector, childFrame.selectorExports);

    const wrongModuleContext = makeMessengerPatchPage({}, makePage());
    const wrongModule = registerSelectorConsumer(wrongModuleContext, 'useOnPressMWThreadListItemAnalytics');
    assert.strictEqual(wrongModule.module.exports.openThread({}), true, 'suffix module names must not be patched');
    assert.strictEqual(wrongModule.requiredSelector, wrongModule.selectorExports);

    const wrongDependencyContext = makeMessengerPatchPage({}, makePage());
    const wrongDependency = registerSelectorConsumer(
        wrongDependencyContext,
        'useOnPressMWThreadListItem',
        'MWPIsThreadUnread.bs'
    );
    assert.strictEqual(wrongDependency.module.exports.openThread({}), true, 'legacy or suffix selector aliases must remain native');
    assert.strictEqual(wrongDependency.requiredSelector, wrongDependency.selectorExports);
}

function testFacebookThreadListPressUnreadSelectorPreservesExportDescriptors() {
    const page = {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    };
    const registerShape = selectorExports => {
        const context = makeMessengerPatchPage({}, page);
        let first;
        let second;
        const module = registerMessengerModuleWithDependencies(
            context,
            'UseOnPressMWThreadListItem',
            ['MWPIsThreadUnread'],
            { MWPIsThreadUnread: selectorExports },
            function (_a, require, importDefault, _d, moduleObject) {
                first = require('MWPIsThreadUnread');
                second = importDefault('MWPIsThreadUnread');
                moduleObject.exports.openThread = record => first.isThreadUnread(record);
            }
        );
        return { first, module, second };
    };

    const nullPrototypeExports = Object.assign(Object.create(null), {
        isThreadUnread() { return true; },
        useIsThreadUnread() { return 'native-null-hook'; },
        sibling: 'native-null-sibling'
    });
    Object.freeze(nullPrototypeExports);
    const nullPrototype = registerShape(nullPrototypeExports);
    assert.strictEqual(nullPrototype.module.exports.openThread({}), false);
    assert.strictEqual(Object.getPrototypeOf(nullPrototype.first), null, 'null-prototype selector exports must retain their prototype');
    assert.strictEqual(nullPrototype.first, nullPrototype.second, 'the null-prototype shadow must keep stable identity');
    assert.strictEqual(nullPrototype.first.useIsThreadUnread, nullPrototypeExports.useIsThreadUnread);
    assert.strictEqual(nullPrototype.first.sibling, 'native-null-sibling');

    let getterCalls = 0;
    const accessorSelector = function () { return true; };
    const accessorExports = {};
    Object.defineProperties(accessorExports, {
        isThreadUnread: {
            configurable: false,
            enumerable: false,
            get() {
                getterCalls += 1;
                return accessorSelector;
            }
        },
        useIsThreadUnread: {
            configurable: false,
            enumerable: true,
            value: function () { return 'native-accessor-hook'; },
            writable: false
        },
        sibling: {
            configurable: false,
            enumerable: false,
            value: 'native-accessor-sibling',
            writable: false
        }
    });
    Object.freeze(accessorExports);
    const accessor = registerShape(accessorExports);
    assert.strictEqual(accessor.module.exports.openThread({}), false, 'accessor-backed selectors must be shadowed safely');
    assert.ok(getterCalls >= 1, 'the native accessor must still supply the selector function');
    assert.strictEqual(Object.getOwnPropertyDescriptor(accessor.first, 'isThreadUnread').enumerable, false);
    assert.strictEqual(accessor.first.useIsThreadUnread, accessorExports.useIsThreadUnread);
    assert.strictEqual(accessor.first.sibling, 'native-accessor-sibling');
    assert.strictEqual(accessorExports.isThreadUnread, accessorSelector, 'the frozen native accessor must remain untouched');
}

function testFacebookThreadListPressLateDefinitionsRemainScoped() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const selectorExports = Object.freeze({
        isThreadUnread() { return true; },
        useIsThreadUnread() { return true; }
    });
    const register = moduleName => registerMessengerModuleWithDependencies(
        context,
        moduleName,
        ['MWPIsThreadUnread'],
        { MWPIsThreadUnread: selectorExports },
        function (_a, require, _c, _d, moduleObject) {
            const selector = require('MWPIsThreadUnread');
            moduleObject.exports.openThread = () => selector.isThreadUnread({ unread: true });
        }
    );

    const first = register('useOnPressMWThreadListItem');
    const second = register('UseOnPressMWThreadListItem');
    assert.strictEqual(first.exports.openThread(), false);
    assert.strictEqual(second.exports.openThread(), false, 'a late same-identity definition must not bypass the scoped selector shadow');
    assert.strictEqual(selectorExports.isThreadUnread(), true, 'late definitions must never mutate the global selector export');
}

function testFacebookPressedUnreadThreadsStayNativeUnreadInExactRowConsumers() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    const keyText = value => {
        const key = value?.threadKey || value;
        return Array.isArray(key) ? `${key[0]}:${key[1]}` : String(key);
    };
    const unreadByKey = new Map([
        ['135791357:246802468', true],
        ['975319753:864208642', false],
        ['314159265:271828182', true]
    ]);
    let nativeHookCalls = 0;
    let nativeSelectorCalls = 0;
    const nativeHook = function (threadKey) {
        nativeHookCalls += 1;
        return unreadByKey.get(keyText(threadKey)) === true;
    };
    const nativeSelector = function (record) {
        nativeSelectorCalls += 1;
        return unreadByKey.get(keyText(record)) === true;
    };
    const sibling = Object.freeze({ contract: 'native' });
    const selectorExports = Object.freeze({
        isThreadUnread: nativeSelector,
        useIsThreadUnread: nativeHook,
        sibling
    });
    let pressSelector;
    const pressModule = registerMessengerModuleWithDependencies(
        context,
        'useOnPressMWThreadListItem',
        ['MWPIsThreadUnread'],
        { MWPIsThreadUnread: selectorExports },
        function (_a, require, _c, _d, moduleObject) {
            pressSelector = require('MWPIsThreadUnread');
            moduleObject.exports.open = record => pressSelector.isThreadUnread(record);
        }
    );

    const rowSelectors = [];
    const registerRow = moduleName => registerMessengerModuleWithDependencies(
        context,
        moduleName,
        ['MWPIsThreadUnread'],
        { MWPIsThreadUnread: selectorExports },
        function (_a, require, importDefault, importAll, moduleObject) {
            const first = require('MWPIsThreadUnread');
            const second = importDefault('MWPIsThreadUnread');
            const third = importAll('MWPIsThreadUnread');
            rowSelectors.push(first);
            moduleObject.exports.render = (threadKey, record) => ({
                hook: first.useIsThreadUnread(threadKey),
                selector: first.isThreadUnread(record),
                stableRequireIdentity: first === second && second === third
            });
        }
    );
    const rowModule = registerRow('MWThreadListItemReact');
    const addonModule = registerRow('MWThreadListItemAddonEndReact');
    const unreadKey = Object.freeze([135791357, 246802468]);
    const unreadRecord = Object.freeze({ threadKey: unreadKey, threadType: 'GROUP' });

    const unopenedKey = Object.freeze([314159265, 271828182]);
    const unopenedRecord = Object.freeze({ threadKey: unopenedKey, threadType: 'GROUP' });
    assert.deepStrictEqual(
        rowModule.exports.render(unopenedKey, unopenedRecord),
        { hook: true, selector: true, stableRequireIdentity: true }
    );
    unreadByKey.set('314159265:271828182', false);
    assert.deepStrictEqual(
        rowModule.exports.render(unopenedKey, unopenedRecord),
        { hook: false, selector: false, stableRequireIdentity: true },
        'rendering an unread row alone must not pin it; only the exact press path may create a latch'
    );

    assert.deepStrictEqual(
        rowModule.exports.render(unreadKey, unreadRecord),
        { hook: true, selector: true, stableRequireIdentity: true }
    );
    assert.deepStrictEqual(
        addonModule.exports.render(unreadKey, unreadRecord),
        { hook: true, selector: true, stableRequireIdentity: true }
    );
    const callsBeforePress = { hook: nativeHookCalls, selector: nativeSelectorCalls };
    assert.strictEqual(pressModule.exports.open(unreadRecord), false, 'the exact press consumer must suppress its unread navigation flag');
    assert.strictEqual(nativeHookCalls, callsBeforePress.hook, 'press handling must not call the React row hook');
    assert.strictEqual(nativeSelectorCalls, callsBeforePress.selector + 1, 'press handling must call the native selector exactly once');

    unreadByKey.set('135791357:246802468', false);
    const rerenderHookCalls = nativeHookCalls;
    const rerenderSelectorCalls = nativeSelectorCalls;
    assert.deepStrictEqual(
        rowModule.exports.render(Object.freeze([135791357, 246802468]), Object.freeze({ threadKey: Object.freeze([135791357, 246802468]) })),
        { hook: true, selector: true, stableRequireIdentity: true },
        'the native row branches must stay unread after the same-tab record turns read'
    );
    assert.deepStrictEqual(
        addonModule.exports.render(Object.freeze([135791357, 246802468]), Object.freeze({ threadKey: Object.freeze([135791357, 246802468]) })),
        { hook: true, selector: true, stableRequireIdentity: true },
        'the native end-addon branch must keep the unread indicator for the same I64 key'
    );
    assert.strictEqual(nativeHookCalls, rerenderHookCalls + 2, 'each exact renderer must still call the native hook once');
    assert.strictEqual(nativeSelectorCalls, rerenderSelectorCalls + 2, 'each exact renderer must still call the native selector once');

    const initiallyReadKey = Object.freeze([975319753, 864208642]);
    const initiallyReadRecord = Object.freeze({ threadKey: initiallyReadKey, threadType: 'GROUP' });
    assert.strictEqual(pressModule.exports.open(initiallyReadRecord), false, 'an initially read thread must remain native false');
    assert.deepStrictEqual(
        rowModule.exports.render(initiallyReadKey, initiallyReadRecord),
        { hook: false, selector: false, stableRequireIdentity: true },
        'native false must not create an unread latch'
    );

    let badgeSelector;
    const badgeModule = registerMessengerModuleWithDependencies(
        context,
        'MWChatBadgeCountUpdatesReact',
        ['MWPIsThreadUnread'],
        { MWPIsThreadUnread: selectorExports },
        function (_a, require, _c, _d, moduleObject) {
            badgeSelector = require('MWPIsThreadUnread');
            moduleObject.exports.render = record => ({
                hook: badgeSelector.useIsThreadUnread(record.threadKey),
                selector: badgeSelector.isThreadUnread(record)
            });
        }
    );
    assert.strictEqual(badgeSelector, selectorExports, 'non-row consumers must keep the global native selector object');
    assert.deepStrictEqual(
        badgeModule.exports.render(unreadRecord),
        { hook: false, selector: false },
        'both selector exports must remain native outside the two exact row consumers'
    );
    assert.notStrictEqual(rowSelectors[0], selectorExports);
    assert.strictEqual(rowSelectors[0], rowSelectors[1], 'the two exact row consumers must share one stable selector shadow');
    assert.strictEqual(rowSelectors[0].sibling, sibling);
    assert.strictEqual(selectorExports.isThreadUnread, nativeSelector);
    assert.strictEqual(selectorExports.useIsThreadUnread, nativeHook);
    assert.strictEqual(Object.isFrozen(selectorExports), true, 'the native frozen export object must remain untouched');
}

function testFacebookUnreadRowLatchClearsAndPreservesNativeBypasses() {
    const facebookPage = {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    };
    const createSurface = (page, configureContext) => {
        const context = makeMessengerPatchPage({}, page);
        if (configureContext) configureContext(context);
        let unread = true;
        const selectorExports = Object.freeze({
            isThreadUnread(record) { return unread && !!record; },
            useIsThreadUnread() { return unread; },
            sibling: 'native'
        });
        let requiredRowSelector;
        const press = registerMessengerModuleWithDependencies(
            context,
            'useOnPressMWThreadListItem',
            ['MWPIsThreadUnread'],
            { MWPIsThreadUnread: selectorExports },
            function (_a, require, _c, _d, moduleObject) {
                const selector = require('MWPIsThreadUnread');
                moduleObject.exports.open = record => selector.isThreadUnread(record);
            }
        );
        const row = registerMessengerModuleWithDependencies(
            context,
            'MWThreadListItemReact',
            ['MWPIsThreadUnread'],
            { MWPIsThreadUnread: selectorExports },
            function (_a, require, _c, _d, moduleObject) {
                requiredRowSelector = require('MWPIsThreadUnread');
                moduleObject.exports.render = record => ({
                    hook: requiredRowSelector.useIsThreadUnread(record.threadKey),
                    selector: requiredRowSelector.isThreadUnread(record)
                });
            }
        );
        const record = Object.freeze({ threadKey: Object.freeze([111, 222]) });
        return {
            context,
            latch() {
                const result = press.exports.open(record);
                unread = false;
                return result;
            },
            record,
            render: () => row.exports.render(record),
            selectorExports,
            get requiredRowSelector() { return requiredRowSelector; }
        };
    };

    const settings = createSurface(facebookPage);
    assert.strictEqual(settings.latch(), false);
    assert.deepStrictEqual(settings.render(), { hook: true, selector: true });
    settings.context.window.postMessage({
        type: 'GHOSTIFY_SETTINGS_UPDATE',
        source: 'GHOSTIFY_EXTENSION',
        settings: { msgTyping: true, msgSeen: false }
    });
    assert.deepStrictEqual(settings.render(), { hook: false, selector: false }, 'settings off must expose native state and clear the latch');
    settings.context.window.postMessage({
        type: 'GHOSTIFY_SETTINGS_UPDATE',
        source: 'GHOSTIFY_EXTENSION',
        settings: { msgTyping: true, msgSeen: true }
    });
    assert.deepStrictEqual(settings.render(), { hook: false, selector: false }, 'reenabling Hide Seen must not resurrect a cleared latch');

    const killed = createSurface(facebookPage);
    assert.strictEqual(killed.latch(), false);
    assert.deepStrictEqual(killed.render(), { hook: true, selector: true });
    killed.context.window.postMessage({
        type: 'GHOSTIFY_CONFIG_UPDATE',
        source: 'GHOSTIFY_EXTENSION',
        config: { killSwitch: ['msgSeen'] }
    });
    assert.deepStrictEqual(killed.render(), { hook: false, selector: false }, 'the kill switch must expose native state and clear the latch');
    killed.context.window.postMessage({
        type: 'GHOSTIFY_CONFIG_UPDATE',
        source: 'GHOSTIFY_EXTENSION',
        config: { killSwitch: [] }
    });
    assert.deepStrictEqual(killed.render(), { hook: false, selector: false }, 'removing the kill switch must not resurrect a cleared latch');

    for (const scenario of [{
        label: 'Message Requests',
        page: { ...facebookPage, pathname: '/messages/requests', href: 'https://www.facebook.com/messages/requests' },
        dynamicBypass: true
    }, {
        label: 'Messenger.com',
        page: { hostname: 'www.messenger.com', pathname: '/t/redacted', href: 'https://www.messenger.com/t/redacted' }
    }, {
        label: 'Facebook MAW proxy',
        page: { hostname: 'www.fbsbx.com', pathname: '/maw_proxy_page/', href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted' }
    }, {
        label: 'Facebook child frame',
        page: facebookPage,
        configureContext(context) { context.window.top = {}; }
    }]) {
        const surface = createSurface(scenario.page, scenario.configureContext);
        assert.strictEqual(surface.latch(), true, `${scenario.label} press behavior must remain native`);
        assert.deepStrictEqual(surface.render(), { hook: false, selector: false }, `${scenario.label} row behavior must remain native`);
        if (scenario.dynamicBypass) {
            assert.notStrictEqual(surface.requiredRowSelector, surface.selectorExports, `${scenario.label} may retain a dynamically bypassed row shadow`);
        } else {
            assert.strictEqual(surface.requiredRowSelector, surface.selectorExports, `${scenario.label} must not receive a row shadow`);
        }
    }
}

function testFacebookUnreadRowShadowPreservesNullAndAccessorExports() {
    const page = {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    };
    const exerciseShape = selectorExports => {
        const context = makeMessengerPatchPage({}, page);
        let rowSelector;
        const press = registerMessengerModuleWithDependencies(
            context,
            'useOnPressMWThreadListItem',
            ['MWPIsThreadUnread'],
            { MWPIsThreadUnread: selectorExports },
            function (_a, require, _c, _d, moduleObject) {
                const selector = require('MWPIsThreadUnread');
                moduleObject.exports.open = record => selector.isThreadUnread(record);
            }
        );
        const row = registerMessengerModuleWithDependencies(
            context,
            'MWThreadListItemAddonEndReact',
            ['MWPIsThreadUnread'],
            { MWPIsThreadUnread: selectorExports },
            function (_a, require, _c, _d, moduleObject) {
                rowSelector = require('MWPIsThreadUnread');
                moduleObject.exports.render = record => ({
                    hook: rowSelector.useIsThreadUnread(record.threadKey),
                    selector: rowSelector.isThreadUnread(record),
                    sibling: rowSelector.sibling
                });
            }
        );
        const record = Object.freeze({ threadKey: Object.freeze([333, 444]) });
        assert.strictEqual(press.exports.open(record), false);
        selectorExports.setUnread(false);
        return { context, record, row, rowSelector };
    };

    let nullUnread = true;
    const nullPrototypeExports = Object.assign(Object.create(null), {
        isThreadUnread() { return nullUnread; },
        useIsThreadUnread() { return nullUnread; },
        sibling: Object.freeze({ contract: 'null-prototype' }),
        setUnread(value) { nullUnread = value; }
    });
    Object.freeze(nullPrototypeExports);
    const nullShape = exerciseShape(nullPrototypeExports);
    assert.deepStrictEqual(
        nullShape.row.exports.render(nullShape.record),
        { hook: true, selector: true, sibling: nullPrototypeExports.sibling }
    );
    assert.strictEqual(Object.getPrototypeOf(nullShape.rowSelector), null);
    assert.notStrictEqual(nullShape.rowSelector, nullPrototypeExports);

    let accessorUnread = true;
    let hookGetterCalls = 0;
    let selectorGetterCalls = 0;
    const accessorHook = function () { return accessorUnread; };
    const accessorSelector = function () { return accessorUnread; };
    const accessorExports = {};
    Object.defineProperties(accessorExports, {
        isThreadUnread: {
            configurable: false,
            enumerable: false,
            get() { selectorGetterCalls += 1; return accessorSelector; }
        },
        useIsThreadUnread: {
            configurable: false,
            enumerable: true,
            get() { hookGetterCalls += 1; return accessorHook; }
        },
        sibling: {
            configurable: false,
            enumerable: false,
            value: 'accessor-native',
            writable: false
        },
        setUnread: {
            configurable: false,
            enumerable: false,
            value(value) { accessorUnread = value; },
            writable: false
        }
    });
    Object.freeze(accessorExports);
    const accessorShape = exerciseShape(accessorExports);
    assert.deepStrictEqual(
        accessorShape.row.exports.render(accessorShape.record),
        { hook: true, selector: true, sibling: 'accessor-native' }
    );
    assert.ok(hookGetterCalls >= 1);
    assert.ok(selectorGetterCalls >= 1);
    assert.strictEqual(Object.getOwnPropertyDescriptor(accessorShape.rowSelector, 'isThreadUnread').enumerable, false);
    assert.strictEqual(Object.getOwnPropertyDescriptor(accessorShape.rowSelector, 'useIsThreadUnread').enumerable, true);
    assert.strictEqual(accessorExports.isThreadUnread, accessorSelector);
    assert.strictEqual(accessorExports.useIsThreadUnread, accessorHook);
}

function testFacebookLateUnconfirmedLeafDefinitionsRemainNative() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    });
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);
    let firstCalls = 0;
    let secondCalls = 0;

    const first = registerMessengerModule(
        context,
        'LSMarkThreadRead',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function () { firstCalls += 1; };
        }
    );
    const second = registerMessengerModule(
        context,
        'LSMarkThreadRead',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function () { secondCalls += 1; };
        }
    );

    assert.strictEqual(first.exports.default(threadKeyI64, watermarkI64, 95), undefined);
    assert.strictEqual(second.exports.default(threadKeyI64, watermarkI64, 95), undefined);
    assert.strictEqual(firstCalls, 1);
    assert.strictEqual(secondCalls, 1, 'unconfirmed lazy leaf definitions must preserve native contracts');
}

function testFacebookLateLocalReadAliasesBlockOnlyPositionalI64Mutations() {
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);

    for (const moduleName of [
        'LSUpdateThreadReadWatermark',
        'LSMarkThreadReadV2',
        'MWMarkThreadRead'
    ]) {
        const context = makeMessengerPatchPage({}, {
            hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
        });
        let calls = 0;
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function () {
                    calls += 1;
                    return 'mutated';
                };
            }
        );

        assert.strictEqual(module.exports.default(threadKeyI64, watermarkI64, 95), undefined);
        assert.strictEqual(calls, 0, `${moduleName} positional I64 local-read mutation must be blocked`);
        assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0, 1);

        const hydrationPayload = {
            thread_key: { thread_fbid: 'redacted-thread' },
            cursor: 'redacted-cursor',
            direction: 'older',
            metadata_only: true
        };
        assert.strictEqual(module.exports.default(hydrationPayload), 'mutated');
        assert.strictEqual(calls, 1, `${moduleName} non-read hydration payload must remain native`);
    }

    const controlContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    });
    let controlCalls = 0;
    const controlModule = registerMessengerModule(
        controlContext,
        'LSReadWatermarkPaginationCursor',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function () {
                controlCalls += 1;
                return 'cursor-loaded';
            };
        }
    );
    assert.strictEqual(
        controlModule.exports.default(threadKeyI64, watermarkI64, { cursor: 'redacted-cursor', direction: 'older' }),
        'cursor-loaded',
        'a broad read-watermark cursor helper must not be mistaken for a positional read mutation'
    );
    assert.strictEqual(controlCalls, 1);
}

function testFacebookLongSessionLateModuleChurnRemainsProtected() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    });
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);
    let mutationCalls = 0;

    for (let index = 0; index < 60; index += 1) {
        const leaf = function () {
            mutationCalls += 1;
            return index;
        };
        const generic = registerMessengerModule(
            context,
            'LSUpdateThreadReadWatermark',
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = leaf;
            }
        );
        const exact = registerMessengerModule(
            context,
            'LSMarkThreadRead',
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = generic.exports.default;
            }
        );
        assert.strictEqual(exact.exports.default(threadKeyI64, watermarkI64, 95), undefined);
    }

    assert.strictEqual(mutationCalls, 0, 'late module churn must never expose a native positional read leaf');
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0, 60);
}

async function testFacebookGroupReadHooksWrapCallbacksWithoutBreakingRestoredHydration() {
    for (const moduleName of [
        'useMAWMarkThreadAsRead',
        'useMWPSafelyMarkThreadAsRead',
        'useMWMarkThreadAsReadWhenNewMessagesArrive'
    ]) {
        const context = makeMessengerPatchPage({}, {
            hostname: moduleName.startsWith('useMAW') ? 'www.fbsbx.com' : 'www.facebook.com',
            pathname: moduleName.startsWith('useMAW') ? '/maw_proxy_page/' : '/',
            search: moduleName.startsWith('useMAW') ? '?__cci=redacted' : '',
            href: moduleName.startsWith('useMAW')
                ? 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
                : 'https://www.facebook.com/',
            facebookMiniChatOpen: !moduleName.startsWith('useMAW')
        });
        let hookCalls = 0;
        let mutationCalls = 0;
        let hydrationCalls = 0;
        const state = { unread: true };
        const originalCallback = function () {
            mutationCalls += 1;
            state.unread = false;
        };
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function () {
                    hookCalls += 1;
                    return originalCallback;
                };
            }
        );

        const first = module.exports.default();
        const second = module.exports.default();
        assert.strictEqual(first, second, `${moduleName} must preserve stable callback identity`);
        assert.strictEqual(hookCalls, 2, `${moduleName} hook orchestration must continue running`);
        assert.strictEqual(await first({ threadType: 'GROUP' }), undefined);
        hydrationCalls += 1;
        assert.strictEqual(hydrationCalls, 1);
        assert.strictEqual(mutationCalls, 0);
        assert.strictEqual(state.unread, true);
    }

    const restoredContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true
    });
    let restoredMutationCalls = 0;
    let restoredHydrationCalls = 0;
    const restoredModule = registerMessengerModule(
        restoredContext,
        'LSOptimisticMarkThreadReadV2StoredProcedure',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = async function () {
                restoredMutationCalls += 1;
            };
        }
    );
    const restoredResult = restoredModule.exports.default({ threadType: 'GROUP' }).then(() => {
        restoredHydrationCalls += 1;
        return 'restored-chat-hydrated';
    });
    assert.strictEqual(await restoredResult, 'restored-chat-hydrated');
    assert.strictEqual(restoredMutationCalls, 1, 'the native optimistic adapter must execute during restored hydration');
    assert.strictEqual(restoredHydrationCalls, 1);
}

async function testFacebookAsyncGroupReadHookPreservesThenability() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.fbsbx.com',
        pathname: '/maw_proxy_page/',
        search: '?__cci=redacted',
        href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
    });
    let mutationCalls = 0;
    const module = registerMessengerModule(
        context,
        'useMAWMarkThreadAsRead',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function () {
                return async function () {
                    mutationCalls += 1;
                    return 'native-async-read';
                };
            };
        }
    );

    const callback = module.exports.default();
    const result = callback({ threadType: 'GROUP' });
    assert.ok(result && typeof result.then === 'function', 'async hook callback suppression must preserve thenability');
    assert.strictEqual(await result, undefined);
    assert.strictEqual(mutationCalls, 0);

    context.window.__GHOSTIFY_SETTINGS__.msgSeen = false;
    assert.strictEqual(await callback({ threadType: 'GROUP' }), 'native-async-read');
    assert.strictEqual(mutationCalls, 1);
}

async function testFacebookCompiledPromiseGroupReadHookPreservesThenability() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.fbsbx.com',
        pathname: '/maw_proxy_page/',
        search: '?__cci=redacted',
        href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
    });
    let mutationCalls = 0;
    const module = registerMessengerModule(
        context,
        'useMAWMarkThreadAsRead',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function () {
                return function compiledPromiseCallback() {
                    mutationCalls += 1;
                    return Promise.resolve('native-compiled-read');
                };
            };
        }
    );

    const callback = module.exports.default();
    const result = callback({ threadType: 'GROUP' });
    assert.ok(result && typeof result.then === 'function', 'compiled Promise callbacks must keep a neutral thenable contract');
    assert.strictEqual(await result, undefined);
    assert.strictEqual(mutationCalls, 0);
}

async function testFacebookPromiseReadOperationsKeepNativeBypasses() {
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);
    const options = Object.freeze({
        folder: 'message_requests',
        threadType: 'GROUP',
        cursor: 'redacted-cursor',
        shouldSendReadReceipt: true
    });

    for (const moduleName of ['MAWMarkThreadAsRead', 'LSOptimisticMarkThreadReadV2StoredProcedure']) {
        for (const bypass of ['settings-off', 'message-request-grace']) {
            const isMaw = moduleName.startsWith('MAW');
            const context = makeMessengerPatchPage({}, {
                hostname: isMaw ? 'www.fbsbx.com' : 'www.facebook.com',
                pathname: isMaw ? '/maw_proxy_page/' : '/',
                search: isMaw ? '?__cci=redacted' : '',
                href: isMaw
                    ? 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
                    : 'https://www.facebook.com/'
            });
            const calls = [];
            const sentinel = Object.freeze({ moduleName, bypass });
            const module = registerMessengerModule(
                context,
                moduleName,
                function (_a, _b, _c, _d, moduleObject) {
                    moduleObject.exports.markThreadAsReadImpl = async function (...args) {
                        calls.push(args);
                        return sentinel;
                    };
                }
            );

            if (bypass === 'settings-off') {
                context.window.__GHOSTIFY_SETTINGS__.msgSeen = false;
            } else {
                context.window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ = Date.now() + 15000;
            }

            const result = await module.exports.markThreadAsReadImpl(threadKeyI64, watermarkI64, options);
            assert.strictEqual(result, sentinel, `${moduleName} ${bypass} must preserve the native resolved value`);
            assert.strictEqual(calls.length, 1);
            assert.strictEqual(calls[0][0], threadKeyI64);
            assert.strictEqual(calls[0][1], watermarkI64);
            assert.strictEqual(calls[0][2], options);
            assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0, 0);
        }
    }
}

function testFacebookMawReadInfrastructureStaysNative() {
    for (const moduleName of [
        'MAWMarkThreadAsReadScheduler',
        'MAWMarkThreadAsReadTxns',
        'MAWMarkThreadAsReadUpToApi'
    ]) {
        const context = makeMessengerPatchPage({}, {
            hostname: 'www.fbsbx.com',
            pathname: '/maw_proxy_page/',
            search: '?__cci=redacted',
            href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
        });
        const calls = [];
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function (payload) {
                    calls.push(payload);
                    return 'native-maw-infrastructure';
                };
            }
        );
        const payload = { threadKey: [1, 2], inboundReceipt: true };

        assert.strictEqual(module.exports.default(payload), 'native-maw-infrastructure');
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0], payload);
        assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0, 0);
        assert.strictEqual(context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0, 0);
    }
}

async function testFacebookMawSchedulerStaysNativeWithSuppressedLeafDependency() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.fbsbx.com',
        pathname: '/maw_proxy_page/',
        search: '?__cci=redacted',
        href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
    });
    let schedulerCalls = 0;
    let mutationCalls = 0;
    const dependencyExports = {
        MAWMarkThreadAsRead: {
            async markThreadAsReadImpl() {
                mutationCalls += 1;
                return 'native-read-mutated';
            }
        }
    };
    const module = registerMessengerModuleWithDependencies(
        context,
        'MAWMarkThreadAsReadScheduler',
        ['MAWMarkThreadAsRead'],
        dependencyExports,
        function (_a, require, _c, _d, moduleObject) {
            const markThreadRead = require('MAWMarkThreadAsRead');
            moduleObject.exports.schedule = async function (...args) {
                schedulerCalls += 1;
                await markThreadRead.markThreadAsReadImpl(...args);
                return 'scheduler-completed';
            };
        }
    );

    const result = module.exports.schedule([135791357, 246802468], [1779530000, 417]);
    assert.ok(result && typeof result.then === 'function');
    assert.strictEqual(await result, 'scheduler-completed');
    assert.strictEqual(schedulerCalls, 1, 'native scheduler orchestration must continue');
    assert.strictEqual(mutationCalls, 0, 'only the leaf local-read mutation should be suppressed');
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0, 1);
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

function sharedWorkerPortOutcome(context, body, transfer) {
    const sharedWorker = new context.SharedWorker(
        'https://www.facebook.com/static_resources/webworker/init_script/?worker_type=MODULE',
        { type: 'module', name: 'redacted-shared-worker' }
    );
    const result = sharedWorker.port.postMessage(body, transfer);
    return {
        result,
        port: sharedWorker.port,
        post: context.workerPosts[context.workerPosts.length - 1],
        postCount: context.workerPosts.length,
        blocked: context.window.__GHOSTIFY_BLOCKED_WORKER_MESSAGES__ || 0,
        sanitized: context.window.__GHOSTIFY_SANITIZED_WORKER_MESSAGES__ || 0,
        sanitizedSeen: context.window.__GHOSTIFY_SANITIZED_SEEN_BRIDGE_MESSAGES__ || 0
    };
}

function testFacebookFeedMiniChatLocalReadModulesPreserveSendAckStatePayloads() {
    for (const moduleName of [
        'LSUpdateThreadReadWatermark',
        'LSMarkThreadRead',
        'MWMarkThreadRead',
        'LSMarkThreadAsRead',
        'MWMarkThreadAsRead',
        'MarkThreadAsRead'
    ]) {
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
        const exactLocalReadBlock = moduleName.toLowerCase().includes('markthreadasread');
        if (moduleName === 'LSMarkThreadRead') {
            assert.strictEqual(module.exports.default(pureReadPayload), 'send-state-applied');
            assert.strictEqual(calls.length, 2);
            assert.strictEqual(calls[1], pureReadPayload, 'unconfirmed LSMarkThreadRead must remain native');
            assert.strictEqual(context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0, 0);
            assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 0);
        } else if (exactLocalReadBlock) {
            assert.strictEqual(module.exports.default(pureReadPayload), undefined);
            assert.strictEqual(calls.length, 1, `${moduleName} pure local-read mutation must be suppressed`);
            assert.strictEqual(context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0, 0);
            assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 1);
        } else {
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
}

function testFacebookFeedMiniChatLocalReadModulesPreservePendingSendStatePayloads() {
    for (const moduleName of [
        'LSUpdateThreadReadWatermark',
        'LSMarkThreadRead',
        'MWMarkThreadRead',
        'LSMarkThreadAsRead',
        'MWMarkThreadAsRead',
        'MarkThreadAsRead'
    ]) {
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

function testMarkThreadAsReadModulesStayUntouchedOnRequestsAndMessengerDotCom() {
    const pages = [
        {
            label: 'Facebook Message Requests',
            hostname: 'www.facebook.com',
            pathname: '/messages/requests',
            href: 'https://www.facebook.com/messages/requests'
        },
        {
            label: 'Messenger.com',
            hostname: 'www.messenger.com',
            pathname: '/t/redacted-thread',
            href: 'https://www.messenger.com/t/redacted-thread'
        }
    ];

    for (const page of pages) {
        const context = makeMessengerPatchPage({}, page);
        const calls = [];
        const module = registerMessengerModule(
            context,
            'MWMarkThreadAsRead',
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.markThreadAsRead = function markThreadAsRead(payload) {
                    calls.push(payload);
                    return 'native-read-state-applied';
                };
            }
        );
        const payload = {
            folder: page.hostname.includes('facebook') ? 'message_requests' : 'inbox',
            thread_key: { thread_fbid: 'redacted-thread' },
            last_read_watermark: 1779530000000,
            should_send_read_receipt: true,
            cursor: 'redacted-cursor'
        };

        assert.strictEqual(module.exports.markThreadAsRead(payload), 'native-read-state-applied');
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(
            calls[0],
            payload,
            `${page.label} must keep exact MarkThreadAsRead payloads on the native path`
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
            0,
            `${page.label} must not sanitize local MarkThreadAsRead modules`
        );
        assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 0);
    }
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

function testFacebookMessageRequestGraceBypassesStaleExactMarkThreadAsReadWrapper() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });
    const calls = [];
    const module = registerMessengerModule(
        context,
        'MWMarkThreadAsRead',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.markThreadAsRead = function markThreadAsRead(payload) {
                calls.push(payload);
                return 'native-request-read-state';
            };
        }
    );
    const inboxPayload = {
        thread_key: { thread_fbid: 'redacted-thread' },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true
    };
    assert.strictEqual(module.exports.markThreadAsRead(inboxPayload), undefined);
    assert.strictEqual(calls.length, 0);
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 1);

    context.window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ = Date.now() + 15000;
    const requestPayload = {
        folder: 'message_requests',
        thread_key: { thread_fbid: 'redacted-request' },
        last_read_watermark: 1779530000001,
        should_send_read_receipt: true,
        cursor: 'redacted-cursor'
    };
    assert.strictEqual(module.exports.markThreadAsRead(requestPayload), 'native-request-read-state');
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0], requestPayload);
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0, 1);
}

function testFacebookMawExactMarkThreadAsReadRemainsSanitized() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.fbsbx.com',
        pathname: '/maw_proxy_page/',
        search: '?__cci=redacted',
        href: 'https://www.fbsbx.com/maw_proxy_page/?__cci=redacted'
    });
    const calls = [];
    const module = registerMessengerModule(
        context,
        'MWMarkThreadAsRead',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.markThreadAsRead = function markThreadAsRead(payload) {
                calls.push(payload);
                return 'proxy-read-updated';
            };
        }
    );
    const payload = {
        thread_key: { thread_fbid: 'redacted-thread' },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true
    };

    assert.strictEqual(module.exports.markThreadAsRead(payload), 'proxy-read-updated');
    assert.strictEqual(calls.length, 1);
    assert.notStrictEqual(calls[0], payload);
    assert.strictEqual(calls[0].last_read_watermark, SAFE_READ_WATERMARK);
    assert.strictEqual(calls[0].should_send_read_receipt, false);
    assert.strictEqual(context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0, 1);
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0, 0);
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

function testFacebookBinaryMixedReadBatchesPreserveRestoredChatHydration() {
    for (const [label, payload] of [
        ['Uint8Array', facebookMixedBridgeReadReceiptBinary],
        [
            'ArrayBuffer',
            facebookMixedBridgeReadReceiptBinary.buffer.slice(
                facebookMixedBridgeReadReceiptBinary.byteOffset,
                facebookMixedBridgeReadReceiptBinary.byteOffset + facebookMixedBridgeReadReceiptBinary.byteLength
            )
        ]
    ]) {
        const originalBytes = Array.from(
            payload instanceof ArrayBuffer
                ? new Uint8Array(payload)
                : new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength)
        );
        const context = makeMessengerPatchPage({}, {
            hostname: 'www.facebook.com',
            pathname: '/',
            href: 'https://www.facebook.com/'
        });
        const outcome = portOutcome(context, payload);

        assert.strictEqual(outcome.result, 'port-sent', `${label} mixed read/history batches must be forwarded`);
        assert.strictEqual(outcome.postCount, 1);
        assert.strictEqual(outcome.blocked, 0);
        assert.strictEqual(outcome.sanitizedSeen, 1);
        assert.ok(outcome.post.message !== payload, `${label} sanitizer must clone instead of mutating transferred input`);
        assert.strictEqual(
            Object.prototype.toString.call(outcome.post.message),
            Object.prototype.toString.call(payload),
            `${label} sanitizer must preserve the binary container type`
        );
        const forwarded = JSON.parse(decodeBridgeBytes(outcome.post.message));
        assert.match(decodeBridgeBytes(outcome.post.message), /"epoch_id":7466175527281646892/);
        assert.doesNotMatch(decodeBridgeBytes(outcome.post.message), /"epoch_id":7466175527281647000/);
        assert.deepStrictEqual(
            forwarded.map(item => item.label),
            ['openThreadHistory', 'hydrateOlderMessages'],
            `${label} sanitizer must remove only the read item and preserve loader ordering`
        );
        assert.deepStrictEqual(
            Array.from(
                payload instanceof ArrayBuffer
                    ? new Uint8Array(payload)
                    : new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength)
            ),
            originalBytes,
            `${label} input bytes must remain unchanged`
        );
    }

    const sharedContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });
    const shared = sharedWorkerPortOutcome(sharedContext, facebookMixedBridgeReadReceiptBinary);
    assert.strictEqual(shared.result, 'shared-worker-port-sent');
    assert.strictEqual(shared.postCount, 1);
    assert.deepStrictEqual(
        JSON.parse(decodeBridgeBytes(shared.post.message)).map(item => item.label),
        ['openThreadHistory', 'hydrateOlderMessages']
    );
    assert.match(decodeBridgeBytes(shared.post.message), /"epoch_id":7466175527281646892/);

    const websocketWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });
    const websocket = websocketSend(
        websocketWindow,
        facebookMixedBridgeReadReceiptBinary,
        'wss://gateway.facebook.com/ws/lightspeed'
    );
    assert.strictEqual(websocket.result, 'sent');
    assert.strictEqual(websocket.socket.sent.length, 1);
    assert.deepStrictEqual(
        JSON.parse(decodeBridgeBytes(websocket.socket.sent[0])).map(item => item.label),
        ['openThreadHistory', 'hydrateOlderMessages']
    );
    assert.match(decodeBridgeBytes(websocket.socket.sent[0]), /"epoch_id":7466175527281646892/);

    const purePortContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });
    assert.strictEqual(portOutcome(purePortContext, facebookBareBridgeReadReceiptBinary).result, undefined);

    const transferContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });
    const transferPayload = new Uint8Array(facebookMixedBridgeReadReceiptBinary);
    const transfer = portOutcome(transferContext, transferPayload, [transferPayload.buffer]);
    assert.strictEqual(transfer.result, 'port-sent');
    assert.strictEqual(transfer.post.transfer, undefined, 'replacement bytes must not transfer the original backing buffer');
    assert.deepStrictEqual(
        JSON.parse(decodeBridgeBytes(transfer.post.message)).map(item => item.label),
        ['openThreadHistory', 'hydrateOlderMessages']
    );
    const pureWebSocketWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });
    assert.strictEqual(
        websocketOutcome(
            pureWebSocketWindow,
            facebookBareBridgeReadReceiptBinary,
            'wss://gateway.facebook.com/ws/lightspeed'
        ),
        'blocked'
    );
}

function testFacebookFramedBinaryMixedReadBatchesPreserveRestoredChatHydration() {
    const assertSanitizedFrame = (value, label, expectedTag = '[object Uint8Array]') => {
        assert.strictEqual(Object.prototype.toString.call(value), expectedTag);
        const { outer, inner } = decodeFacebookFramedTasks(value);
        assert.strictEqual(outer.app_id, '2220391788200892');
        assert.strictEqual(outer.request_id, 199);
        assert.strictEqual(outer.type, 3);
        assert.match(outer.payload, /"epoch_id":7466175527281646891/);
        assert.doesNotMatch(outer.payload, /"epoch_id":7466175527281647000/);
        assert.deepStrictEqual(
            inner.tasks.map(task => task.label),
            ['209', 'hydrateOlderMessages'],
            `${label} must remove only the read task from the framed batch`
        );
        assert.deepStrictEqual(inner.tasks.map(task => task.task_id), [501, 503]);
        assert.doesNotMatch(JSON.stringify(inner), /markThreadAsRead|should_send_read_receipt|1779530000000/);
    };

    const originalBytes = Array.from(facebookFramedRestoredGroupMixedReadBatch);
    for (const page of [{
        label: 'Facebook top frame',
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    }, {
        label: 'Facebook MAW proxy',
        hostname: 'www.fbsbx.com',
        pathname: '/maw_proxy_page/',
        href: 'https://www.fbsbx.com/maw_proxy_page/'
    }]) {
        const context = makeMessengerPatchPage({}, page);
        const outcome = portOutcome(context, facebookFramedRestoredGroupMixedReadBatch);
        assert.strictEqual(outcome.result, 'port-sent', `${page.label} framed mixed batches must be forwarded`);
        assert.strictEqual(outcome.postCount, 1);
        assert.strictEqual(outcome.blocked, 0);
        assert.strictEqual(outcome.sanitizedSeen, 1);
        assertSanitizedFrame(outcome.post.message, page.label);
    }

    const websocketWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });
    const websocket = websocketSend(
        websocketWindow,
        facebookFramedRestoredGroupMixedReadBatch,
        'wss://gateway.facebook.com/ws/lightspeed'
    );
    assert.strictEqual(websocket.result, 'sent');
    assert.strictEqual(websocket.socket.sent.length, 1);
    assertSanitizedFrame(websocket.socket.sent[0], 'Facebook WebSocket');

    const arrayBufferContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });
    const arrayBufferPayload = facebookFramedRestoredGroupMixedReadBatch.buffer.slice(
        facebookFramedRestoredGroupMixedReadBatch.byteOffset,
        facebookFramedRestoredGroupMixedReadBatch.byteOffset + facebookFramedRestoredGroupMixedReadBatch.byteLength
    );
    const arrayBufferOutcome = portOutcome(arrayBufferContext, arrayBufferPayload, [arrayBufferPayload]);
    assert.strictEqual(arrayBufferOutcome.result, 'port-sent');
    assert.strictEqual(Object.prototype.toString.call(arrayBufferOutcome.post.message), '[object ArrayBuffer]');
    assert.strictEqual(arrayBufferOutcome.post.transfer, undefined);
    assertSanitizedFrame(
        arrayBufferOutcome.post.message,
        'Facebook transferred ArrayBuffer',
        '[object ArrayBuffer]'
    );
    assert.deepStrictEqual(Array.from(facebookFramedRestoredGroupMixedReadBatch), originalBytes);
}

function testSourcePreservingTaskSurgeryDeclinesGenericObjectRewrites() {
    const { sanitizeJsonTaskBatchStringSource } = loadBinaryJsonSourceHelpers();
    const scalarSource = JSON.stringify({
        epoch_id: '__UNSAFE_SCALAR_EPOCH_ID__',
        last_read_watermark_ts: 1779530000000,
        cursor: 'redacted-cursor'
    }).replace('"__UNSAFE_SCALAR_EPOCH_ID__"', '7466175527281646894');
    const scalar = sanitizeJsonTaskBatchStringSource(scalarSource, value => {
        if (!value || Array.isArray(value) || typeof value !== 'object') {
            return { value, changed: false, blockedAll: false };
        }
        if (value.last_read_watermark_ts === 1000000000000) {
            return { value, changed: false, blockedAll: false };
        }
        return {
            value: Object.assign({}, value, { last_read_watermark_ts: 1000000000000 }),
            changed: true,
            blockedAll: false
        };
    });
    assert.strictEqual(scalar.changed, true, 'source surgery must apply scalar rewrites without rebuilding sibling IDs');
    assert.match(scalar.value, /"epoch_id":7466175527281646894/);
    assert.match(scalar.value, /"last_read_watermark_ts":1000000000000/);
    assert.doesNotMatch(scalar.value, /7466175527281647000/);

    const nestedSource = JSON.stringify({
        request_id: 1,
        epoch_id: '__UNSAFE_NESTED_EPOCH_ID__',
        operation: { label: 'markThreadAsRead', thread_id: 'redacted-thread' },
        cursor: 'redacted-cursor'
    }).replace('"__UNSAFE_NESTED_EPOCH_ID__"', '7466175527281646895');
    const nested = sanitizeJsonTaskBatchStringSource(nestedSource, value => {
        if (value && !Array.isArray(value) && value.operation) {
            return {
                value: { request_id: value.request_id, epoch_id: value.epoch_id, cursor: value.cursor },
                changed: true,
                blockedAll: false
            };
        }
        return { value, changed: false, blockedAll: false };
    });
    assert.strictEqual(nested.changed, true, 'source surgery must omit blocked object children without rebuilding siblings');
    assert.doesNotMatch(nested.value, /"operation":\[\]/);
    assert.doesNotMatch(nested.value, /"operation":/);
    assert.match(nested.value, /"epoch_id":7466175527281646895/);
    assert.doesNotMatch(nested.value, /7466175527281647000/);

    const scalarContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/'
    });
    const scalarPayload = JSON.stringify({
        label: 'markThreadAsRead',
        epoch_id: '__UNSAFE_PRODUCTION_EPOCH_ID__',
        thread_key: { thread_fbid: 'redacted-thread' },
        last_read_watermark_ts: 1779530000000,
        cursor: 'redacted-cursor'
    }).replace('"__UNSAFE_PRODUCTION_EPOCH_ID__"', '7466175527281646896');
    const scalarOutcome = workerOutcome(scalarContext, scalarPayload);
    assert.strictEqual(scalarOutcome.result, 'worker-sent');
    const forwardedScalar = JSON.parse(scalarOutcome.post.message);
    assert.strictEqual(forwardedScalar.cursor, 'redacted-cursor');
    assert.strictEqual(forwardedScalar.last_read_watermark_ts, 1000000000000);
    assert.match(scalarOutcome.post.message, /"epoch_id":7466175527281646896/);
    assert.doesNotMatch(scalarOutcome.post.message, /7466175527281647000/);
}

function testFacebookStructuredMixedReadEnvelopesPreserveRestoredChatHydration() {
    const assertEnvelope = (value, label) => {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        assert.strictEqual(parsed.issue_new_task, true);
        assert.deepStrictEqual(
            Array.from(parsed.tasks, task => task.label),
            ['openThreadHistory', 'hydrateOlderMessages'],
            `${label} must preserve both loader siblings`
        );
        if (typeof value === 'string') {
            assert.match(value, /"epoch_id":7466175527281646891/);
            assert.match(value, /"hydration_id":7466175527281646893/);
            assert.doesNotMatch(value, /7466175527281647000/);
        }
    };

    for (const page of [{
        label: 'Facebook top frame',
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    }, {
        label: 'Facebook MAW proxy',
        hostname: 'www.fbsbx.com',
        pathname: '/maw_proxy_page/',
        href: 'https://www.fbsbx.com/maw_proxy_page/'
    }]) {
        const objectContext = makeMessengerPatchPage({}, page);
        const objectOutcome = portOutcome(objectContext, facebookMixedBridgeReadReceiptEnvelope);
        assert.strictEqual(objectOutcome.result, 'port-sent', `${page.label} object envelope must be forwarded`);
        assert.strictEqual(objectOutcome.postCount, 1);
        assertEnvelope(objectOutcome.post.message, `${page.label} object envelope`);

        const stringContext = makeMessengerPatchPage({}, page);
        const stringOutcome = workerOutcome(stringContext, facebookMixedBridgeReadReceiptEnvelopeString);
        assert.strictEqual(stringOutcome.result, 'worker-sent', `${page.label} string envelope must be forwarded`);
        assert.strictEqual(stringOutcome.postCount, 1);
        assertEnvelope(stringOutcome.post.message, `${page.label} string envelope`);
    }

    for (const page of [{
        label: 'Facebook WebSocket',
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/'
    }, {
        label: 'MAW WebSocket',
        hostname: 'www.fbsbx.com', pathname: '/maw_proxy_page/', href: 'https://www.fbsbx.com/maw_proxy_page/'
    }]) {
        const websocketWindow = makeGhostPage(page);
        const websocket = websocketSend(
            websocketWindow,
            facebookMixedBridgeReadReceiptEnvelopeString,
            'wss://gateway.facebook.com/ws/lightspeed'
        );
        assert.strictEqual(websocket.result, 'sent');
        assert.strictEqual(websocket.socket.sent.length, 1);
        assertEnvelope(websocket.socket.sent[0], `${page.label} string envelope`);

        assert.strictEqual(
            websocketOutcome(
                websocketWindow,
                JSON.stringify({ issue_new_task: true, tasks: facebookBareBridgeReadReceipt }),
                'wss://gateway.facebook.com/ws/lightspeed'
            ),
            'blocked',
            `${page.label} pure-read string envelopes must remain blocked`
        );
    }

    const xhrWindow = makeGhostPage({
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/'
    });
    const xhr = xhrSend(xhrWindow, facebookMixedBridgeReadReceiptEnvelopeString);
    assert.strictEqual(xhr.result, 'sent');
    assertEnvelope(xhr.xhr.sent, 'Facebook XHR string envelope');

    const paramsWindow = makeGhostPage({
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/'
    });
    const params = new paramsWindow.URLSearchParams();
    params.set('payload', facebookMixedBridgeReadReceiptEnvelopeString);
    const paramsXhr = xhrSend(paramsWindow, params);
    assert.strictEqual(paramsXhr.result, 'sent');
    assert.ok(paramsXhr.xhr.sent instanceof paramsWindow.URLSearchParams);
    assertEnvelope(paramsXhr.xhr.sent.get('payload'), 'Facebook URLSearchParams string envelope');

    const pureContext = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/'
    });
    assert.strictEqual(
        portOutcome(pureContext, { issue_new_task: true, tasks: facebookBareBridgeReadReceipt }).result,
        undefined,
        'pure read envelopes must still be blocked'
    );
}

function testFacebookPassiveReadReceiptThreadListQueriesStayNativeAcrossWorkerBridges() {
    const page = {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/'
    };
    const variables = {
        folder: 'inbox',
        cursor: 'redacted-inbox-cursor',
        direction: 'older',
        thread_list: true,
        metadata: {
            read_receipt: 'passive',
            should_send_read_receipt: false
        }
    };
    const query = {
        operationName: 'MWChatThreadListPaginationQuery',
        query: 'query MWChatThreadListPaginationQuery { messenger_threads { nodes { id } } }',
        variables
    };
    const source = JSON.stringify(query);

    const workerContext = makeMessengerPatchPage({}, page);
    const worker = workerOutcome(workerContext, source);
    assert.strictEqual(worker.result, 'worker-sent');
    assert.strictEqual(
        worker.post.message,
        source,
        'normal inbox query strings with passive read_receipt metadata must remain byte-for-byte unchanged'
    );
    assert.deepStrictEqual(JSON.parse(worker.post.message).variables, variables);
    assert.strictEqual(worker.blocked, 0);
    assert.strictEqual(worker.sanitized, 0);

    const portContext = makeMessengerPatchPage({}, page);
    const port = portOutcome(portContext, query);
    assert.strictEqual(port.result, 'port-sent');
    assert.strictEqual(
        port.post.message,
        query,
        'normal inbox query objects with passive read_receipt metadata must retain bridge identity'
    );
    assert.strictEqual(port.post.message.variables, variables, 'thread-list variables must retain their identity');
    assert.strictEqual(port.post.message.variables.cursor, 'redacted-inbox-cursor');
    assert.strictEqual(port.post.message.variables.metadata.read_receipt, 'passive');
    assert.strictEqual(port.blocked, 0);
    assert.strictEqual(port.sanitized, 0);
}

function testFacebookExactReadWatermarkPaginationCursorPreservesNestedArguments() {
    const page = {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    };
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);
    const nestedWatermark = Object.freeze({
        value: watermarkI64,
        source: 'thread-list-loader'
    });
    const options = Object.freeze({
        cursor: 'redacted-pagination-cursor',
        direction: 'older',
        metadata_only: true,
        last_read_watermark: nestedWatermark
    });
    const nativeResult = Object.freeze({ cursor: 'redacted-next-cursor' });

    const assertNativeCall = (calls, result, label) => {
        assert.strictEqual(result, nativeResult, `${label} must preserve the native return contract`);
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0][0], threadKeyI64);
        assert.strictEqual(calls[0][1], watermarkI64);
        assert.strictEqual(calls[0][2], options);
        assert.strictEqual(calls[0][2].last_read_watermark, nestedWatermark);
        assert.strictEqual(calls[0][2].last_read_watermark.value, watermarkI64);
        assert.deepStrictEqual(Array.from(calls[0][2].last_read_watermark.value), [1779530000, 417]);
    };

    const directContext = makeMessengerPatchPage({}, page);
    const directCalls = [];
    const directModule = registerMessengerModule(
        directContext,
        'LSReadWatermarkPaginationCursor',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (...args) {
                directCalls.push(args);
                return nativeResult;
            };
        }
    );
    assertNativeCall(
        directCalls,
        directModule.exports.default(threadKeyI64, watermarkI64, options),
        'direct LSReadWatermarkPaginationCursor export'
    );

    const dependencyContext = makeMessengerPatchPage({}, page);
    const dependencyCalls = [];
    const dependencyExports = {
        LSReadWatermarkPaginationCursor: {
            default(...args) {
                dependencyCalls.push(args);
                return nativeResult;
            }
        }
    };
    const dependencyModule = registerMessengerModuleWithDependencies(
        dependencyContext,
        'MWChatThreadListLoader',
        ['LSReadWatermarkPaginationCursor'],
        dependencyExports,
        function (_a, require, _c, _d, moduleObject) {
            moduleObject.exports.load = (...args) => require('LSReadWatermarkPaginationCursor').default(...args);
        }
    );
    assertNativeCall(
        dependencyCalls,
        dependencyModule.exports.load(threadKeyI64, watermarkI64, options),
        'dependency-required LSReadWatermarkPaginationCursor export'
    );
}

async function testFacebookDuplicateUrlSearchParamsForwardOnlyPaginationTask() {
    const page = {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/'
    };
    const paginationEnvelope = JSON.stringify({
        issue_new_task: true,
        tasks: [facebookNormalThreadListPaginationTask]
    });
    const exactReadEnvelope = JSON.stringify({
        issue_new_task: true,
        tasks: [{
            label: 'LSMarkThreadRead',
            operation: 'LSMarkThreadRead',
            queue_name: 'redacted-thread',
            task_id: 'exact-read-task',
            payload: {
                thread_key: { thread_fbid: 'redacted-thread' },
                readReceipt: true
            }
        }]
    });
    const makeParams = window => {
        const params = new window.URLSearchParams();
        params.append('payload', paginationEnvelope);
        params.append('payload', exactReadEnvelope);
        params.append('epoch_id', '7466175527281646898');
        return params;
    };
    const assertPaginationOnly = (params, label) => {
        assert.ok(params instanceof URLSearchParams, `${label} must retain URLSearchParams transport`);
        const payloads = params.getAll('payload');
        assert.strictEqual(payloads.length, 1, `${label} must remove only the duplicate-key exact read task`);
        const forwarded = JSON.parse(payloads[0]);
        assert.deepStrictEqual(
            forwarded.tasks.map(task => task.label),
            ['MWChatThreadListPaginationQuery'],
            `${label} must retain the normal pagination task`
        );
        assert.strictEqual(forwarded.tasks[0].payload.cursor, 'redacted-next-cursor');
        assert.strictEqual(params.get('epoch_id'), '7466175527281646898');
    };

    const fetchWindow = makeGhostPage(page);
    assert.strictEqual(await fetchOutcome(fetchWindow, makeParams(fetchWindow)), 'allowed');
    assertPaginationOnly(fetchWindow.fetchCalls[0].init.body, 'Facebook fetch duplicate-key URLSearchParams');

    const xhrWindow = makeGhostPage(page);
    const xhr = xhrSend(xhrWindow, makeParams(xhrWindow));
    assert.strictEqual(xhr.result, 'sent');
    assertPaginationOnly(xhr.xhr.sent, 'Facebook XHR duplicate-key URLSearchParams');
}

function testFacebookUpdateThreadReadWatermarkPaginationSignatureStaysNative() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    });
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);
    const options = Object.freeze({
        cursor: 'redacted-pagination-cursor',
        direction: 'older',
        metadata_only: true
    });
    const calls = [];
    const nativeResult = Object.freeze({ loaded: true });
    const module = registerMessengerModule(
        context,
        'LSUpdateThreadReadWatermark',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (...args) {
                calls.push(args);
                return nativeResult;
            };
        }
    );

    assert.strictEqual(module.exports.default(threadKeyI64, watermarkI64, options), nativeResult);
    assert.strictEqual(calls.length, 1, 'pagination-shaped LSUpdateThreadReadWatermark calls must execute natively');
    assert.strictEqual(calls[0][0], threadKeyI64);
    assert.strictEqual(calls[0][1], watermarkI64);
    assert.strictEqual(calls[0][2], options);
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0, 0);
    assert.strictEqual(context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0, 0);
}

async function testFacebookAsyncUnconfirmedMarkThreadReadAliasStaysNative() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/', facebookMiniChatOpen: true
    });
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);
    const options = Object.freeze({ sync_group: 95 });
    const calls = [];
    const nativeResult = Object.freeze({ applied: 'native' });
    const module = registerMessengerModule(
        context,
        'LSMarkThreadRead',
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = async function (...args) {
                calls.push(args);
                return nativeResult;
            };
        }
    );

    const result = module.exports.default(threadKeyI64, watermarkI64, options);
    assert.ok(result && typeof result.then === 'function', 'unconfirmed async LSMarkThreadRead aliases must remain thenable');
    assert.strictEqual(await result, nativeResult, 'unconfirmed async aliases must preserve their native resolved value');
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0][0], threadKeyI64);
    assert.strictEqual(calls[0][1], watermarkI64);
    assert.strictEqual(calls[0][2], options);
    assert.strictEqual(context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0, 0);
}

async function testFacebookNormalThreadListPaginationSurvivesSeenProtection() {
    const page = {
        hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/'
    };
    const assertExactPagination = (value, label) => {
        assert.strictEqual(value, facebookNormalThreadListPaginationEnvelopeSource, `${label} must remain byte-for-byte unchanged`);
        assert.match(value, /"epoch_id":7466175527281646897/);
        assert.match(value, /MWChatThreadListPaginationQuery/);
        assert.match(value, /redacted-next-cursor/);
    };

    const fetchWindow = makeGhostPage(page);
    assert.strictEqual(await fetchOutcome(fetchWindow, facebookNormalThreadListPaginationEnvelopeSource), 'allowed');
    assertExactPagination(fetchWindow.fetchCalls[0].init.body, 'Facebook fetch pagination');

    const xhrWindow = makeGhostPage(page);
    const xhr = xhrSend(xhrWindow, facebookNormalThreadListPaginationEnvelopeSource);
    assert.strictEqual(xhr.result, 'sent');
    assertExactPagination(xhr.xhr.sent, 'Facebook XHR pagination');

    const websocketWindow = makeGhostPage(page);
    const websocket = websocketSend(
        websocketWindow,
        facebookNormalThreadListPaginationEnvelopeSource,
        'wss://gateway.facebook.com/ws/lightspeed'
    );
    assert.strictEqual(websocket.result, 'sent');
    assertExactPagination(websocket.socket.sent[0], 'Facebook WebSocket pagination');

    const workerContext = makeMessengerPatchPage({}, page);
    const worker = workerOutcome(workerContext, facebookNormalThreadListPaginationEnvelopeSource);
    assert.strictEqual(worker.result, 'worker-sent');
    assertExactPagination(worker.post.message, 'Facebook Worker pagination');

    const portContext = makeMessengerPatchPage({}, page);
    const port = portOutcome(portContext, facebookNormalThreadListPaginationBinary);
    assert.strictEqual(port.result, 'port-sent');
    assert.strictEqual(port.post.message, facebookNormalThreadListPaginationBinary);

    const targetedPaginationTask = JSON.parse(JSON.stringify(facebookNormalThreadListPaginationTask));
    targetedPaginationTask.thread_key = 'redacted-thread';
    targetedPaginationTask.payload.readReceipt = false;
    targetedPaginationTask.payload.seen_by_viewer = false;
    const targetedPaginationObject = { issue_new_task: true, tasks: [targetedPaginationTask] };
    for (const [label, send] of [
        ['Facebook Worker targeted pagination object', context => workerOutcome(context, targetedPaginationObject)],
        ['Facebook MessagePort targeted pagination object', context => portOutcome(context, targetedPaginationObject)]
    ]) {
        const context = makeMessengerPatchPage({}, page);
        const outcome = send(context);
        assert.ok(outcome.result, `${label} must remain native`);
        assert.strictEqual(outcome.postCount, 1);
        assert.deepStrictEqual(JSON.parse(JSON.stringify(outcome.post.message)), targetedPaginationObject);
        assert.strictEqual(outcome.blocked, 0);
    }

    const mixedSource = JSON.stringify({
        issue_new_task: true,
        tasks: [facebookNormalThreadListPaginationTask, facebookBareBridgeReadReceipt[0]]
    });
    const mixedWindow = makeGhostPage(page);
    const mixed = websocketSend(mixedWindow, mixedSource, 'wss://gateway.facebook.com/ws/lightspeed');
    assert.strictEqual(mixed.result, 'sent');
    const mixedForwarded = JSON.parse(mixed.socket.sent[0]);
    assert.deepStrictEqual(mixedForwarded.tasks.map(task => task.label), ['MWChatThreadListPaginationQuery']);
    assert.strictEqual(mixedForwarded.tasks[0].payload.cursor, 'redacted-next-cursor');
    assert.strictEqual(mixedForwarded.tasks[0].payload.should_send_read_receipt, false);

    const assertMixedPaginationOnly = (value, label) => {
        const decoded = typeof value === 'string' || (value && typeof value === 'object' && !ArrayBuffer.isView(value) &&
            Object.prototype.toString.call(value) !== '[object ArrayBuffer]')
            ? value
            : decodeBridgeBytes(value);
        const forwarded = typeof decoded === 'string' ? JSON.parse(decoded) : decoded;
        assert.deepStrictEqual(
            Array.from(forwarded.tasks, task => task.label),
            ['MWChatThreadListPaginationQuery'],
            `${label} must preserve pagination while removing the sibling read mutation`
        );
        assert.strictEqual(forwarded.tasks[0].payload.cursor, 'redacted-next-cursor');
    };

    for (const [label, send] of [
        ['Facebook Worker string batch', context => workerOutcome(context, mixedSource)],
        ['Facebook MessagePort string batch', context => portOutcome(context, mixedSource)],
        ['Facebook Worker object batch', context => workerOutcome(context, JSON.parse(mixedSource))],
        ['Facebook MessagePort object batch', context => portOutcome(context, JSON.parse(mixedSource))]
    ]) {
        const context = makeMessengerPatchPage({}, page);
        const outcome = send(context);
        assert.ok(outcome.result, `${label} must be forwarded`);
        assertMixedPaginationOnly(outcome.post.message, label);
    }

    const targetedMixedObject = {
        issue_new_task: true,
        tasks: [targetedPaginationTask, facebookBareBridgeReadReceipt[0]]
    };
    for (const [label, send] of [
        ['Facebook Worker targeted mixed object', context => workerOutcome(context, targetedMixedObject)],
        ['Facebook MessagePort targeted mixed object', context => portOutcome(context, targetedMixedObject)]
    ]) {
        const context = makeMessengerPatchPage({}, page);
        const outcome = send(context);
        assert.ok(outcome.result, `${label} must retain the pagination task`);
        assertMixedPaginationOnly(outcome.post.message, label);
    }

    const mixedBytes = new Uint8Array(Buffer.from(mixedSource, 'utf8'));
    const workerBinaryContext = makeMessengerPatchPage({}, page);
    const workerBinary = workerOutcome(workerBinaryContext, mixedBytes);
    assert.strictEqual(workerBinary.result, 'worker-sent');
    assertMixedPaginationOnly(workerBinary.post.message, 'Facebook Worker Uint8Array batch');

    const mixedArrayBuffer = mixedBytes.buffer.slice(mixedBytes.byteOffset, mixedBytes.byteOffset + mixedBytes.byteLength);
    const portArrayBufferContext = makeMessengerPatchPage({}, page);
    const portArrayBuffer = portOutcome(portArrayBufferContext, mixedArrayBuffer, [mixedArrayBuffer]);
    assert.strictEqual(portArrayBuffer.result, 'port-sent');
    assertMixedPaginationOnly(portArrayBuffer.post.message, 'Facebook MessagePort ArrayBuffer batch');

    for (const [variant, taskFields, payloadFields] of [
        ['LSMarkThreadRead', { operation: 'LSMarkThreadRead' }, { readReceipt: true }],
        ['mark_read', { operation: 'mark_read' }, {}],
        ['mark_seen', { operation: 'mark_seen' }, {}],
        ['mark_as_read', { operation: 'mark_as_read' }, {}],
        ['thread_seen operation', { operation: 'thread_seen' }, {}],
        ['thread_seen truthy field', {}, { thread_seen: true }],
        ['read_receipt operation', { operation: 'read_receipt' }, {}],
        ['updateLastSeenAt operation', { operation: 'updateLastSeenAt' }, {}],
        ['LSUpdateLastReadWatermark operation', { operation: 'LSUpdateLastReadWatermark' }, {}],
        ['UpdateLastReadWatermark operation', { operation: 'UpdateLastReadWatermark' }, {}],
        ['update_last_read_watermark operation', { operation: 'update_last_read_watermark' }, {}],
        ['readReceipt truthy field', {}, { readReceipt: true }],
        ['seen_by_viewer truthy field', {}, { seen_by_viewer: true }]
    ]) {
        const queryNamedReadMutation = JSON.stringify({
            issue_new_task: true,
            tasks: [{
                ...facebookNormalThreadListPaginationTask,
                ...taskFields,
                thread_key: 'redacted-thread',
                payload: {
                    ...facebookNormalThreadListPaginationTask.payload,
                    ...payloadFields
                }
            }]
        });
        const asBytes = () => new Uint8Array(Buffer.from(queryNamedReadMutation, 'utf8'));
        const asArrayBuffer = () => {
            const bytes = asBytes();
            return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        };
        for (const [transport, send] of [
            ['Worker string', context => workerOutcome(context, queryNamedReadMutation)],
            ['MessagePort string', context => portOutcome(context, queryNamedReadMutation)],
            ['Worker object', context => workerOutcome(context, JSON.parse(queryNamedReadMutation))],
            ['MessagePort object', context => portOutcome(context, JSON.parse(queryNamedReadMutation))],
            ['Worker Uint8Array', context => workerOutcome(context, asBytes())],
            ['MessagePort Uint8Array', context => portOutcome(context, asBytes())],
            ['Worker ArrayBuffer', context => { const value = asArrayBuffer(); return workerOutcome(context, value, [value]); }],
            ['MessagePort ArrayBuffer', context => { const value = asArrayBuffer(); return portOutcome(context, value, [value]); }]
        ]) {
            const context = makeMessengerPatchPage({}, page);
            const outcome = send(context);
            if (outcome.result === undefined) {
                assert.strictEqual(outcome.postCount, 0);
                continue;
            }
            assert.strictEqual(outcome.postCount, 1);
            const forwarded = typeof outcome.post.message === 'string'
                ? outcome.post.message
                : (ArrayBuffer.isView(outcome.post.message) ||
                    Object.prototype.toString.call(outcome.post.message) === '[object ArrayBuffer]')
                    ? decodeBridgeBytes(outcome.post.message)
                    : JSON.stringify(outcome.post.message);
            assert.doesNotMatch(
                forwarded,
                /"(?:readReceipt|read_receipt|thread_seen|threadseen|seen_by_viewer|seenbyviewer)"\s*:\s*true|"operation"\s*:\s*"(?:LSMarkThreadRead|mark_read|mark_seen|mark_as_read|thread_seen|read_receipt|updateLastSeenAt|LSUpdateLastReadWatermark|UpdateLastReadWatermark|update_last_read_watermark)"/,
                `Facebook ${transport} query-named ${variant} mutation must be removed or neutralized before forwarding`
            );
        }

        const assertNetworkNeutralized = (value, label) => {
            if (value == null) return;
            const forwarded = typeof value === 'string' ? value : decodeBridgeBytes(value);
            assert.doesNotMatch(
                forwarded,
                /"(?:readReceipt|read_receipt|thread_seen|threadseen|seen_by_viewer|seenbyviewer)"\s*:\s*true|"operation"\s*:\s*"(?:LSMarkThreadRead|mark_read|mark_seen|mark_as_read|thread_seen|read_receipt|updateLastSeenAt|LSUpdateLastReadWatermark|UpdateLastReadWatermark|update_last_read_watermark)"/,
                `${label} must not forward the query-named ${variant} mutation`
            );
        };
        const aliasWebSocketWindow = makeGhostPage(page);
        const aliasWebSocket = websocketSend(aliasWebSocketWindow, queryNamedReadMutation, 'wss://gateway.facebook.com/ws/lightspeed');
        assertNetworkNeutralized(aliasWebSocket.socket.sent[0], 'Facebook WebSocket');

        const aliasXhrWindow = makeGhostPage(page);
        const aliasXhr = xhrSend(aliasXhrWindow, queryNamedReadMutation);
        assertNetworkNeutralized(aliasXhr.xhr.sent, 'Facebook XHR');

        const aliasFetchWindow = makeGhostPage(page);
        const aliasFetchOutcome = await fetchOutcome(aliasFetchWindow, queryNamedReadMutation);
        if (aliasFetchOutcome === 'allowed') {
            assertNetworkNeutralized(aliasFetchWindow.fetchCalls[0].init.body, 'Facebook fetch');
        } else {
            assert.strictEqual(aliasFetchOutcome, 'MSG_SEEN');
        }
    }

    const longSessionWindow = makeGhostPage(page);
    for (let index = 0; index < 50; index += 1) {
        const paginationTask = JSON.parse(JSON.stringify(facebookNormalThreadListPaginationTask));
        paginationTask.payload.cursor = `redacted-cursor-${index}`;
        const batch = JSON.stringify({
            issue_new_task: true,
            tasks: [paginationTask, facebookBareBridgeReadReceipt[0]]
        });
        const outcome = websocketSend(longSessionWindow, batch, 'wss://gateway.facebook.com/ws/lightspeed');
        assert.strictEqual(outcome.result, 'sent');
        const forwarded = JSON.parse(outcome.socket.sent[0]);
        assert.deepStrictEqual(forwarded.tasks.map(task => task.label), ['MWChatThreadListPaginationQuery']);
        assert.strictEqual(forwarded.tasks[0].payload.cursor, `redacted-cursor-${index}`);
    }
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

function testFacebookSharedWorkerPortsUseMessagePortPrivacyHooks() {
    const context = makeMessengerPatchPage({}, {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });

    const bareRead = sharedWorkerPortOutcome(context, facebookBareBridgeReadReceipt);
    assert.ok(bareRead.port instanceof context.MessagePort);
    assert.strictEqual(bareRead.result, undefined);
    assert.strictEqual(bareRead.postCount, 0);
    assert.strictEqual(bareRead.blocked, 1);

    const mixedBatch = sharedWorkerPortOutcome(context, facebookMixedBridgeReadReceiptBatch);
    assert.ok(mixedBatch.port instanceof context.MessagePort);
    assert.strictEqual(mixedBatch.result, 'shared-worker-port-sent');
    assert.strictEqual(mixedBatch.postCount, 1);
    assert.strictEqual(mixedBatch.post.target, 'shared-worker-port');
    assert.strictEqual(mixedBatch.blocked, 1);
    assert.strictEqual(mixedBatch.sanitizedSeen, 1);
    assert.ok(Array.isArray(mixedBatch.post.message));
    assert.strictEqual(mixedBatch.post.message.length, 2);
    assert.strictEqual(mixedBatch.post.message[0], facebookMixedBridgeReadReceiptBatch[0]);
    assert.strictEqual(mixedBatch.post.message[1], facebookMixedBridgeReadReceiptBatch[2]);

    const history = sharedWorkerPortOutcome(context, facebookFeedThreadOpenFullFetchFrame);
    assert.strictEqual(history.result, 'shared-worker-port-sent');
    assert.strictEqual(history.postCount, 2);
    assert.strictEqual(history.post.target, 'shared-worker-port');
    assert.strictEqual(history.post.message, facebookFeedThreadOpenFullFetchFrame);
    assert.strictEqual(history.blocked, 1);

    const requestPayload = JSON.parse(lsMessageRequestThreadListLoad);
    const request = sharedWorkerPortOutcome(context, requestPayload);
    assert.strictEqual(request.result, 'shared-worker-port-sent');
    assert.strictEqual(request.postCount, 3);
    assert.strictEqual(request.post.target, 'shared-worker-port');
    assert.strictEqual(request.post.message, requestPayload);
    assert.strictEqual(request.blocked, 1);

    const sendPayload = JSON.parse(messengerSendWithWatermark);
    const send = sharedWorkerPortOutcome(context, sendPayload);
    assert.strictEqual(send.result, 'shared-worker-port-sent');
    assert.strictEqual(send.postCount, 4);
    assert.strictEqual(send.post.target, 'shared-worker-port');
    assert.strictEqual(send.post.message, sendPayload);
    assert.strictEqual(send.blocked, 1);
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
    assert.ok(
        sharedWorker.port instanceof context.MessagePort,
        'SharedWorker.port must use the MessagePort prototype so bridge privacy hooks are exercised'
    );
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
        ['www.facebook.com', '/', true, 'General Facebook feed startup keeps a short native-focus loader grace'],
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
        'Facebook feed startup must keep native focus briefly so the popover and restored chat can hydrate'
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
        false,
        'Facebook restored mini-chat loading must stay passive-unfocused after conversation selection'
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
        false,
        'Opening a Facebook feed Messenger row must never report native focus'
    );
    assert.strictEqual(
        countDeliveredFocusEvents(window),
        4,
        'Opening a Facebook feed Messenger row must keep loader focus events flowing even while hasFocus is spoofed'
    );
    window.__GHOSTIFY_FACEBOOK_CHAT_OPEN_FOCUS_UNTIL__ = Date.now() + 4000;
    assert.strictEqual(
        window.document.hasFocus(),
        false,
        'legacy chat-open grace markers must no longer bypass unread protection'
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
        false,
        'Unread child clicks must remain passive-unfocused while restored mini-chat hydration continues'
    );
    assert.strictEqual(
        countDeliveredFocusEvents(window),
        4,
        'Unread child clicks must not suppress focus events needed by history hydration'
    );
}

function testFacebookUnreadConversationClicksNeverGrantNativeFocusAfterLoaderGrace() {
    const startupWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/'
    });
    assert.strictEqual(
        startupWindow.document.hasFocus(),
        true,
        'startup may use native focus only during the bounded popover/restore loader grace'
    );

    const loadingWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatLoading: true
    });
    assert.strictEqual(
        loadingWindow.document.hasFocus(),
        false,
        'restored mini-chat loading must not reopen native focus after a conversation click'
    );
    assert.strictEqual(loadingWindow.document.visibilityState, 'visible');
    assert.strictEqual(countDeliveredFocusEvents(loadingWindow), 4);

    const clickWindow = makeGhostPage({
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMessengerPopoverOpen: true
    });
    clickWindow.document.dispatchEvent({
        type: 'pointerdown',
        target: createRequestClickTarget({ label: 'Unread message: redacted' })
    });
    assert.strictEqual(
        clickWindow.document.hasFocus(),
        false,
        'clicking a personal or group unread row must not open a native-focus read window'
    );
    assert.strictEqual(clickWindow.document.visibilityState, 'visible');
    assert.strictEqual(countDeliveredFocusEvents(clickWindow), 4);
}

function testFacebookMessengerPopoverGetsLoaderOnlyFocusGrace() {
    const page = {
        hostname: 'www.facebook.com',
        pathname: '/',
        href: 'https://www.facebook.com/',
        facebookMiniChatOpen: true,
        facebookMessengerPopoverOpen: false
    };
    const window = makeGhostPage(page);
    window.__GHOSTIFY_FACEBOOK_ROOT_NATIVE_UNTIL__ = Date.now() - 1;
    assert.strictEqual(window.document.hasFocus(), false);

    window.document.dispatchEvent({
        type: 'pointerdown',
        target: createRequestClickTarget({ label: 'Messenger, 1 unread' })
    });
    assert.strictEqual(
        window.document.hasFocus(),
        true,
        'the top Messenger button may report native focus only while its chat grid is absent'
    );
    assert.strictEqual(window.document.visibilityState, 'visible');

    page.facebookMessengerPopoverOpen = true;
    assert.strictEqual(
        window.document.hasFocus(),
        false,
        'popover focus grace must end immediately when the Messenger grid hydrates'
    );

    window.document.dispatchEvent({
        type: 'pointerdown',
        target: createRequestClickTarget({
            href: '/messages/t/redacted-thread/',
            label: 'Unread message: redacted'
        })
    });
    page.facebookMessengerPopoverOpen = false;
    assert.strictEqual(
        window.document.hasFocus(),
        false,
        'a conversation-row interaction must consume popover loader grace before the grid closes'
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

function testPopupMessengerSeenNoteExplainsPreservedFacebookUnreadUi() {
    const popupHtml = fs.readFileSync('dist/popup.html', 'utf8');
    const popupCss = fs.readFileSync('dist/css/popup.css', 'utf8');
    const note = 'Facebook’s unread UI bug is fixed. If an unread chat still gets marked as read with Hide Seen on, let us know.';

    assert(
        popupHtml.includes(note),
        'Messenger/Facebook Hide Seen should state that the previous bug is fixed and ask users to report a regression'
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
    const directHelpFormUrl = 'https://github.com/Hendrizzzz/Ghostify/issues/new?template=help_feedback.yml';
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
        popupHtml.includes('class="footer-link support-link"') &&
        popupHtml.includes('id="version-number"') &&
        !popupHtml.includes('footer-separator') &&
        !popupHtml.includes('Feature survey'),
        'Popup footer should keep only the version and Help & feedback link'
    );
    assert(
        popupCss.includes('.footer-link:hover::after') &&
        popupCss.includes('.support-link:hover::after'),
        'Popup footer should reveal helpful text on hover and keyboard focus'
    );
    assert(
        !popupHtml.includes('Labs') &&
        !popupHtml.includes('tally.so') &&
        !popupHtml.includes('id="open-labs"') &&
        !popupHtml.includes('id="labs-view"') &&
        !popupJs.includes('attachViewListeners') &&
        !popupJs.includes('open-labs') &&
        !popupCss.includes('.labs-row') &&
        !popupCss.includes('.survey-link'),
        'Popup should remove Labs and feature-survey UI completely'
    );
    assert(
        privacyPolicy.includes('GitHub issue forms') &&
        !privacyPolicy.includes('Tally') &&
        !privacyPolicy.includes('feature surveys'),
        'Privacy policy should match the remaining GitHub feedback path'
    );
    const headerHtml = popupHtml.slice(
        popupHtml.indexOf('<header class="header">'),
        popupHtml.indexOf('</header>') + '</header>'.length
    );
    assert(
        headerHtml.includes('id="public-status-link"') &&
        headerHtml.includes('id="public-status-summary"') &&
        headerHtml.includes('data-status="review"') &&
        !headerHtml.includes('id="public-status-action"') &&
        !headerHtml.includes('>Verification</span>') &&
        !popupHtml.includes('>View</span>') &&
        popupCss.includes('.header-verification') &&
        popupCss.includes('--status-green: #2ee58d;') &&
        popupCss.includes('--status-yellow: #f1bd4b;') &&
        popupCss.includes('.header-verification[data-status="verified"]') &&
        !popupCss.includes('--status-red') &&
        !popupCss.includes('data-status="issue"') &&
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
        popupJs.includes('latestPublicStatusRecord') &&
        popupJs.includes('formatStatusRecordDate') &&
        popupJs.includes('getPublicStatusTone') &&
        popupJs.includes("linkElement.dataset.status = tone") &&
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

    const currentStatus = JSON.parse(fs.readFileSync('site/src/app/statusData.json', 'utf8'));
    assert.strictEqual(
        context.summarizePublicStatus(currentStatus),
        'Jul 12',
        'Popup should show the date from the latest committed status record'
    );
    assert.strictEqual(
        context.getPublicStatusTone(currentStatus),
        'review',
        'A pending Store build should remain yellow until the status-enabled build is published and verified'
    );

      const workingEntry = {
        publicStatus: 'maintainer_verified',
        verifiedAt: '2026-06-27T00:00:00Z'
    };
    const workingData = {
        schemaVersion: 1,
        productVersion: pkg.version,
        release: { matchesVerificationBuild: true },
        history: [{
            date: '2026-06-27',
            publicStatus: 'maintainer_verified'
        }],
        entries: Array.from({ length: 9 }, () => ({ ...workingEntry }))
    };

    assert.strictEqual(
        context.summarizePublicStatus(workingData, new Date('2026-06-27T12:00:00Z')),
        'Jun 27',
        'Popup green state should show only the month and day of the latest proof'
    );
    assert.strictEqual(
        context.summarizePublicStatus(workingData, new Date('2026-06-28T12:00:00Z')),
        'Jun 27',
        'Popup proof date should stay compact and omit the year'
    );
    assert.strictEqual(
        context.getPublicStatusTone(workingData, new Date('2026-06-28T12:00:00Z')),
        'verified',
        'Current reviewed proof should use the green status tone'
    );
    assert.strictEqual(
        context.getPublicStatusTone({
            ...workingData,
            release: { matchesVerificationBuild: false }
        }),
        'review',
        'A verified record for a build that differs from the Store build must not render green'
    );
    assert.strictEqual(
        context.getPublicStatusTone({
            ...workingData,
            history: [
                { date: '2026-06-20', publicStatus: 'under_review' },
                { date: '2026-06-27', publicStatus: 'maintainer_verified' }
            ]
        }),
        'review',
        'The first merged history record must remain authoritative even when its display date is older'
    );
    assert.strictEqual(
        context.getPublicStatusTone({
            ...workingData,
            history: [{ date: '2026-07-12', publicStatus: 'under_review' }]
        }),
        'review',
        'A later report or review record should use the yellow tone'
    );
    assert.strictEqual(
        context.summarizePublicStatus({
            ...workingData,
            history: [{ date: '2026-07-12', publicStatus: 'known_issue' }]
        }),
        'Jul 12',
        'A report record should show its month and day instead of a generic Review label'
    );
    assert.strictEqual(
        context.getPublicStatusTone({
            ...workingData,
            history: [{ date: '2026-07-12', publicStatus: 'known_issue' }]
        }),
        'review',
        'Confirmed reports should also use the yellow report tone'
    );
}

async function testPopupFetchFailureDoesNotClaimWorking() {
    const popupSource = fs.readFileSync('dist/js/popup.js', 'utf8');
    const classNames = new Set();
    const summaryElement = { textContent: '' };
    const linkElement = {
        dataset: {},
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
        'Review',
        'Popup should show a neutral compact fallback when the public status feed cannot load'
    );
    assert(
        !summaryElement.textContent.toLowerCase().includes('working') &&
        !linkElement.getAttribute('aria-label').toLowerCase().includes('working'),
        'Popup fetch failures must not claim the controls are working'
    );
    assert(linkElement.classList.contains('is-fallback'), 'Popup should mark the public-status link as fallback on fetch failure');
    assert.strictEqual(linkElement.dataset.status, 'review', 'Popup fetch failures should use the yellow review tone');
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
    await testFacebookJsonShapedPrivacyTextInsideRealSendsIsPreserved();
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
    testFacebookTopFrameModuleInterceptorIsExactScopedForLoaderSafety();
    testFacebookOptimisticMarkThreadReadShadowsOnlyNativeLeaf();
    testFacebookOptimisticMarkThreadReadPreservesNativeBypasses();
    testFacebookOptimisticMarkThreadReadShadowIsConsumerAndHostScoped();
    await testFacebookOptimisticMarkThreadReadAdapterRemainsNative();
    testFacebookUnprovenGroupReadLeavesPreserveNativeContracts();
    testFacebookSendOpenMessageHooksForceNativeDisableMarkRead();
    testFacebookLateUnconfirmedLeafDefinitionsRemainNative();
    testFacebookMawReadInfrastructureStaysNative();
    await testFacebookMawSchedulerStaysNativeWithSuppressedLeafDependency();
    testFacebookMessageRequestGraceLeavesLocalReadModulesUntouched();
    testMarkThreadAsReadModulesStayUntouchedOnRequestsAndMessengerDotCom();
    testFacebookMawExactMarkThreadAsReadRemainsSanitized();
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
    testFacebookBinaryMixedReadBatchesPreserveRestoredChatHydration();
    testFacebookFramedBinaryMixedReadBatchesPreserveRestoredChatHydration();
    testSourcePreservingTaskSurgeryDeclinesGenericObjectRewrites();
    testFacebookStructuredMixedReadEnvelopesPreserveRestoredChatHydration();
    testFacebookPassiveReadReceiptThreadListQueriesStayNativeAcrossWorkerBridges();
    testFacebookExactReadWatermarkPaginationCursorPreservesNestedArguments();
    await testFacebookDuplicateUrlSearchParamsForwardOnlyPaginationTask();
    testFacebookUpdateThreadReadWatermarkPaginationSignatureStaysNative();
    await testFacebookAsyncUnconfirmedMarkThreadReadAliasStaysNative();
    await testFacebookNormalThreadListPaginationSurvivesSeenProtection();
    testFacebookTargetlessBridgeReadReceiptBatchesAreSanitizedBeforeSharedWorkerStateUpdates();
    testFacebookSharedWorkerPortsUseMessagePortPrivacyHooks();
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
    testFacebookUnreadConversationClicksNeverGrantNativeFocusAfterLoaderGrace();
    testFacebookMessengerPopoverGetsLoaderOnlyFocusGrace();
    testInstagramMediaSurfacesDoNotSpoofFocus();
    testMessageRequestRoutesDoNotSuppressFocusEvents();
    testMawProxyRejectsUntrustedMessageRequestGrace();
    testMessageRequestSpaRouteChangesRestoreNativeFocus();
    testMessageRequestClicksTemporarilyRestoreNativeFocus();
    testFacebookNestedMessageRequestClicksTemporarilyRestoreNativeFocus();
    testFacebookNormalConversationClicksDoNotInheritSiblingMessageRequestText();
    testPopupMessengerSeenNoteExplainsPreservedFacebookUnreadUi();
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
