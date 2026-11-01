const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const {
    messengerSendWithWatermark,
    messengerReadReceipt,
    facebookWorkerEdgeChatLastSeenFrame,
    facebookFramePrefix,
    lsMessageRequestThreadListLoad,
    makeGhostPage,
    makeMessengerPatchPage,
    registerMessengerModule,
    registerMessengerModuleWithDependencies,
    fetchOutcome,
    websocketOutcome,
    websocketSend,
    xhrSend,
    workerOutcome,
    portOutcome,
    decodeBridgeBytes,
    decodeFacebookFramedTasks,
} = require("../helpers/regression-harness");

const binaryJsonSource = fs.readFileSync("src/utils/binary-json.js", "utf8");

function loadBinaryJsonSourceHelpers() {
    const context = { JSON, String, Object, Array };
    context.globalThis = context;
    vm.runInNewContext(
        `${binaryJsonSource.replace(/^export\s+/gm, "")}\nthis.sanitizeJsonTaskBatchStringSource = sanitizeJsonTaskBatchStringSource;`,
        context,
        { filename: "binary-json.js" },
    );
    return context;
}

const facebookWorkerEdgeChatReadWatermarkFrame = new Uint8Array(
    Buffer.from(
        `{}\r\u0000{"app_id":"2220391788200892","payload":"{\\"epoch_id\\":7466158453245587268,\\"tasks\\":[{\\"failure_count\\":null,\\"label\\":\\"21\\",\\"payload\\":\\"{\\\\\\"thread_id\\\\\\":9000000000000001,\\\\\\"last_read_watermark_ts\\\\\\":1780070888819,\\\\\\"sync_group\\\\\\":104}\\",\\"queue_name\\":\\"9000000000000001\\",\\"task_id\\":409}],\\"version_id\\":\\"27029912679952307\\"}","request_id":167,"type":3}`,
        "utf8",
    ),
);

const facebookWorkerEdgeChatDeliveryFrame = new Uint8Array(
    Buffer.from(
        `{}\r\u0000{"app_id":"2220391788200892","payload":"{\\"label\\":\\"delivery\\",\\"payload\\":\\"{\\\\\\"thread_id\\\\\\":9000000000000001,\\\\\\"delivery_receipt\\\\\\":true}\\",\\"version\\":\\"27029912679952307\\"}","request_id":180,"type":4}`,
        "utf8",
    ),
);

const facebookEdgeChatMixedOpaqueSendTypingFrame = new Uint8Array(
    Buffer.from(
        `{}\r\u0000${JSON.stringify({
            app_id: "2220391788200892",
            payload: JSON.stringify({
                epoch_id: 7466158453245588000,
                tasks: [
                    {
                        failure_count: null,
                        label: "46",
                        payload: JSON.stringify({
                            thread_id: 9000000000000001,
                            offline_threading_id: "redacted-offline-id",
                            send_type: 1,
                            message: { text: "markThreadAsRead readReceipt" },
                            sync_group: 104,
                        }),
                        queue_name: "9000000000000001",
                        task_id: 410,
                    },
                    {
                        failure_count: null,
                        label: "sendChatStateFromComposer",
                        payload: JSON.stringify({
                            thread_id: 9000000000000001,
                            chatstate: "typing_indicator",
                            send_type: "typing",
                        }),
                        queue_name: "9000000000000001",
                        task_id: 411,
                    },
                ],
                version_id: "27029912679952307",
            }),
            request_id: 181,
            type: 3,
        })}`,
        "utf8",
    ),
);

const facebookEdgeChatQuickReactionSendTypingFrame = new Uint8Array(
    Buffer.from(
        `{}\r\u0000${JSON.stringify({
            app_id: "2220391788200892",
            payload: JSON.stringify({
                epoch_id: 7466158453245588001,
                tasks: [
                    {
                        failure_count: null,
                        label: "46",
                        payload: JSON.stringify({
                            other_user_id: "redacted-user",
                            offline_threading_id: "redacted-offline-id",
                            send_type: 1,
                            reaction: "👍",
                            emoji: "👍",
                            quick_like: true,
                            sync_group: 104,
                        }),
                        queue_name: "redacted-user",
                        task_id: 412,
                    },
                    {
                        failure_count: null,
                        label: "sendChatStateFromComposer",
                        payload: JSON.stringify({
                            other_user_id: "redacted-user",
                            chatstate: "typing_indicator",
                            send_type: "typing",
                        }),
                        queue_name: "redacted-user",
                        task_id: 413,
                    },
                ],
                version_id: "27029912679952307",
            }),
            request_id: 182,
            type: 3,
        })}`,
        "utf8",
    ),
);

const facebookFeedThreadOpenFullFetchFrame = new Uint8Array(
    Buffer.from(
        `\u000fg\u0000\u0002\u0000\u0000{}\rg\u0000\u0000{"app_id":"2220391788200892","payload":"{\\"epoch_id\\":7466175527281646890,\\"tasks\\":[{\\"failure_count\\":null,\\"label\\":\\"209\\",\\"payload\\":\\"{\\\\\\"thread_fbid\\\\\\":1000000000000003,\\\\\\"force_upsert\\\\\\":0,\\\\\\"use_open_messenger_transport\\\\\\":0,\\\\\\"sync_group\\\\\\":95,\\\\\\"metadata_only\\\\\\":0,\\\\\\"preview_only\\\\\\":0}\\",\\"queue_name\\":\\"1000000000000003\\",\\"task_id\\":238}],\\"version_id\\":\\"27029912679952307\\"}","request_id":107,"type":3}`,
        "utf8",
    ),
);

const facebookFeedArmadilloOpenThreadFrame = new Uint8Array(
    Buffer.from(
        `\u000fg\u0000\u0002\u0000\u0000{}\rg\u0000\u0000{"app_id":"2220391788200892","payload":"{\\"epoch_id\\":7466178972558867308,\\"tasks\\":[{\\"failure_count\\":null,\\"label\\":\\"436\\",\\"payload\\":\\"{\\\\\\"open_message_thread_key\\\\\\":10000000000004,\\\\\\"armadillo_thread_key\\\\\\":10000000000004,\\\\\\"trace_id\\\\\\":\\\\\\"0000000000000001\\\\\\",\\\\\\"should_copy_messages\\\\\\":0}\\",\\"queue_name\\":\\"10000000000004_10000000000004\\",\\"task_id\\":391}],\\"version_id\\":\\"27029912679952307\\"}","request_id":145,"type":3}`,
        "utf8",
    ),
);

const facebookFeedThreadOpenWithReadMetadataFrame = new Uint8Array(
    Buffer.from(
        `\u000fg\u0000\u0002\u0000\u0000{}\rg\u0000\u0000{"app_id":"2220391788200892","payload":"{\\"epoch_id\\":7466175527281646891,\\"tasks\\":[{\\"failure_count\\":null,\\"label\\":\\"209\\",\\"payload\\":\\"{\\\\\\"thread_fbid\\\\\\":1000000000000003,\\\\\\"last_read_watermark\\\\\\":1780070888819,\\\\\\"force_upsert\\\\\\":0,\\\\\\"metadata_only\\\\\\":0,\\\\\\"preview_only\\\\\\":0}\\",\\"queue_name\\":\\"1000000000000003\\",\\"task_id\\":239}],\\"version_id\\":\\"27029912679952307\\"}","request_id":108,"type":3}`,
        "utf8",
    ),
);

const facebookFramedRestoredGroupInnerPayload = JSON.stringify({
    epoch_id: "__UNSAFE_EPOCH_ID__",
    tasks: [
        {
            label: "209",
            payload: JSON.stringify({
                thread_fbid: "redacted-group",
                force_upsert: 0,
                sync_group: 95,
                metadata_only: 0,
                preview_only: 0,
            }),
            queue_name: "redacted-group",
            task_id: 501,
        },
        {
            label: "markThreadAsRead",
            payload: JSON.stringify({
                thread_key: { thread_fbid: "redacted-group" },
                last_read_watermark_ts: 1779530000000,
                should_send_read_receipt: true,
            }),
            queue_name: "redacted-group",
            task_id: 502,
        },
        {
            label: "hydrateOlderMessages",
            payload: JSON.stringify({
                parent_thread_key: "redacted-group",
                cursor: "redacted-cursor",
            }),
            queue_name: "redacted-group",
            task_id: 503,
        },
    ],
}).replace('"__UNSAFE_EPOCH_ID__"', "7466175527281646891");

const facebookFramedRestoredGroupMixedReadBatch = new Uint8Array(
    Buffer.from(
        facebookFramePrefix +
            JSON.stringify({
                app_id: "2220391788200892",
                payload: facebookFramedRestoredGroupInnerPayload,
                request_id: 199,
                type: 3,
            }),
        "utf8",
    ),
);

const facebookBareBridgeReadReceipt = [
    {
        label: "markThreadAsRead",
        thread_key: { thread_fbid: "redacted-thread" },
        readReceipt: true,
    },
];

const facebookMixedBridgeReadReceiptBatch = [
    {
        label: "openThreadHistory",
        thread_key: { thread_fbid: "redacted-thread" },
        queue_name: "redacted-thread",
        task_id: "history-task",
        cursor: "redacted-cursor",
    },
    {
        label: "markThreadAsRead",
        thread_key: { thread_fbid: "redacted-thread" },
        readReceipt: true,
    },
    {
        label: "hydrateOlderMessages",
        parent_thread_key: "redacted-thread",
        queue_name: "redacted-thread",
        task_id: "hydrate-task",
        direction: "older",
    },
];

const facebookMixedBridgeReadReceiptEnvelope = {
    issue_new_task: true,
    tasks: facebookMixedBridgeReadReceiptBatch,
};

const facebookMixedBridgeReadReceiptEnvelopeString = JSON.stringify({
    issue_new_task: true,
    epoch_id: "__UNSAFE_ENVELOPE_EPOCH_ID__",
    tasks: facebookMixedBridgeReadReceiptBatch.map((task, index) =>
        index === 2
            ? Object.assign({}, task, {
                  hydration_id: "__UNSAFE_HYDRATION_ID__",
              })
            : task,
    ),
})
    .replace('"__UNSAFE_ENVELOPE_EPOCH_ID__"', "7466175527281646891")
    .replace('"__UNSAFE_HYDRATION_ID__"', "7466175527281646893");

const facebookMixedBridgeReadReceiptBinarySource = JSON.stringify(
    facebookMixedBridgeReadReceiptBatch.map((task, index) =>
        index === 0
            ? Object.assign({}, task, { epoch_id: "__UNSAFE_BATCH_EPOCH_ID__" })
            : task,
    ),
).replace('"__UNSAFE_BATCH_EPOCH_ID__"', "7466175527281646892");

const facebookMixedBridgeReadReceiptBinary = new Uint8Array(
    Buffer.from(facebookMixedBridgeReadReceiptBinarySource, "utf8"),
);

const facebookBareBridgeReadReceiptBinary = new Uint8Array(
    Buffer.from(JSON.stringify(facebookBareBridgeReadReceipt), "utf8"),
);

const facebookTargetlessBridgeReadReceiptBatch = [
    {
        label: "openThreadHistory",
        queue_name: "redacted-history",
        task_id: "history-task",
        cursor: "redacted-cursor",
    },
    {
        label: "markThreadAsRead",
        source: "mini_chat",
        readReceipt: true,
    },
    {
        label: "hydrateOlderMessages",
        queue_name: "redacted-history",
        task_id: "older-history-task",
        direction: "older",
    },
    {
        label: "presencePing",
        actor: "viewer",
    },
    {
        label: "bridgeBatchFlush",
        task_id: "flush-task",
    },
];

const facebookNormalThreadListPaginationTask = {
    label: "MWChatThreadListPaginationQuery",
    queue_name: "mwchat_fetch_thread_list",
    task_id: "pagination-task",
    payload: {
        folder: "inbox",
        cursor: "redacted-next-cursor",
        direction: "older",
        thread_list: true,
        should_send_read_receipt: false,
        seen_by_viewer: false,
    },
};

const facebookNormalThreadListPaginationEnvelopeSource = JSON.stringify({
    issue_new_task: true,
    epoch_id: "__UNSAFE_PAGINATION_EPOCH_ID__",
    tasks: [facebookNormalThreadListPaginationTask],
}).replace('"__UNSAFE_PAGINATION_EPOCH_ID__"', "7466175527281646897");

const facebookNormalThreadListPaginationBinary = new Uint8Array(
    Buffer.from(
        JSON.stringify([facebookNormalThreadListPaginationTask]),
        "utf8",
    ),
);

function sharedWorkerPortOutcome(context, body, transfer) {
    const sharedWorker = new context.SharedWorker(
        "https://www.facebook.com/static_resources/webworker/init_script/?worker_type=MODULE",
        { type: "module", name: "redacted-shared-worker" },
    );
    const result = sharedWorker.port.postMessage(body, transfer);
    return {
        result,
        port: sharedWorker.port,
        post: context.workerPosts[context.workerPosts.length - 1],
        postCount: context.workerPosts.length,
        blocked: context.window.__GHOSTIFY_BLOCKED_WORKER_MESSAGES__ || 0,
        sanitized: context.window.__GHOSTIFY_SANITIZED_WORKER_MESSAGES__ || 0,
        sanitizedSeen:
            context.window.__GHOSTIFY_SANITIZED_SEEN_BRIDGE_MESSAGES__ || 0,
    };
}

async function testFacebookMawProxyNetworkReadReceiptsAreBlocked() {
    const window = makeGhostPage({
        hostname: "www.fbsbx.com",
        pathname: "/maw_proxy_page/",
        search: "?__cci=redacted",
        href: "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted",
    });

    assert.strictEqual(
        await fetchOutcome(window, messengerReadReceipt),
        "MSG_SEEN",
        "Facebook MAW proxy fetch read-receipt writes must be blocked",
    );
    assert.strictEqual(
        websocketOutcome(window, messengerReadReceipt),
        "blocked",
        "Facebook MAW proxy WebSocket read-receipt writes must be blocked",
    );
}

function testFacebookEdgeChatRealtimeReadWatermarkFramesAreBlocked() {
    const window = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    const edgeChatUrl = "wss://edge-chat.facebook.com/chat?region=redacted";

    assert.strictEqual(
        websocketOutcome(
            window,
            facebookWorkerEdgeChatReadWatermarkFrame,
            edgeChatUrl,
        ),
        "blocked",
        "Facebook edge-chat label 21 last_read_watermark_ts frames must be blocked",
    );
    assert.strictEqual(
        websocketOutcome(
            window,
            facebookWorkerEdgeChatLastSeenFrame,
            edgeChatUrl,
        ),
        "blocked",
        "Facebook edge-chat label 6 last_seen_time_ms frames must be blocked",
    );
    assert.strictEqual(
        websocketOutcome(
            window,
            facebookWorkerEdgeChatDeliveryFrame,
            edgeChatUrl,
        ),
        "allowed",
        "Facebook edge-chat delivery frames without read-watermark intent must still pass",
    );

    const lightspeedUrl = "wss://gateway.facebook.com/ws/lightspeed";
    assert.strictEqual(
        websocketOutcome(
            window,
            facebookWorkerEdgeChatReadWatermarkFrame,
            lightspeedUrl,
        ),
        "blocked",
        "Facebook lightspeed label 21 last_read_watermark_ts frames must be blocked",
    );
    assert.strictEqual(
        websocketOutcome(
            window,
            facebookWorkerEdgeChatLastSeenFrame,
            lightspeedUrl,
        ),
        "blocked",
        "Facebook lightspeed label 6 last_seen_time_ms frames must be blocked",
    );
    assert.strictEqual(
        websocketOutcome(
            window,
            facebookWorkerEdgeChatDeliveryFrame,
            lightspeedUrl,
        ),
        "allowed",
        "Facebook lightspeed delivery frames without read-watermark intent must still pass",
    );
}

function testFacebookEdgeChatMixedShortSendTypingFrameIsAllowed() {
    const edgeChatUrl = "wss://edge-chat.facebook.com/chat?region=redacted";
    const lightspeedUrl = "wss://gateway.facebook.com/ws/lightspeed";
    const pages = [
        {
            label: "Facebook top page",
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
        {
            label: "Facebook MAW proxy",
            hostname: "www.fbsbx.com",
            pathname: "/maw_proxy_page/",
            search: "?__cci=redacted",
            href: "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted",
        },
    ];

    for (const page of pages) {
        for (const url of [edgeChatUrl, lightspeedUrl]) {
            const window = makeGhostPage(page);
            const outcome = websocketSend(
                window,
                facebookEdgeChatMixedOpaqueSendTypingFrame,
                url,
            );

            assert.strictEqual(
                outcome.result,
                "sent",
                `${page.label} mixed mini-chat send/typing frames must not be dropped as typing`,
            );
            assert.strictEqual(outcome.socket.sent.length, 1);
            assert.deepStrictEqual(
                Array.from(outcome.socket.sent[0]),
                Array.from(facebookEdgeChatMixedOpaqueSendTypingFrame),
                `${page.label} mixed mini-chat send/typing frames must forward byte-for-byte`,
            );
        }
    }
}

function testFacebookEdgeChatQuickReactionSendTypingFrameIsAllowed() {
    for (const page of [
        {
            label: "Facebook top page",
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
        {
            label: "Facebook MAW proxy",
            hostname: "www.fbsbx.com",
            pathname: "/maw_proxy_page/",
            search: "?__cci=redacted",
            href: "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted",
        },
    ]) {
        const window = makeGhostPage(page);
        const edgeChatUrl = "wss://edge-chat.facebook.com/chat?region=redacted";
        const lightspeedUrl = "wss://gateway.facebook.com/ws/lightspeed";

        assert.strictEqual(
            websocketOutcome(
                window,
                facebookEdgeChatQuickReactionSendTypingFrame,
                edgeChatUrl,
            ),
            "allowed",
            `${page.label} quick-like/reaction send frames must not be dropped as typing`,
        );
        assert.strictEqual(
            websocketOutcome(
                window,
                facebookEdgeChatQuickReactionSendTypingFrame,
                lightspeedUrl,
            ),
            "allowed",
            `${page.label} quick-like/reaction lightspeed frames must not be dropped as typing`,
        );
    }
}

function testFacebookThreadOpenRealtimeLoadsStayAllowed() {
    const lightspeedUrl = "wss://gateway.facebook.com/ws/lightspeed";
    const normalWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    assert.strictEqual(
        websocketOutcome(
            normalWindow,
            facebookFeedThreadOpenFullFetchFrame,
            lightspeedUrl,
        ),
        "allowed",
        "Facebook full-thread realtime loads must stay allowed during normal browsing",
    );
    assert.strictEqual(
        websocketOutcome(
            normalWindow,
            facebookFeedArmadilloOpenThreadFrame,
            lightspeedUrl,
        ),
        "allowed",
        "Facebook Armadillo open-thread realtime loads must stay allowed during normal browsing",
    );

    const focusedWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMessengerPopoverOpen: true,
    });
    assert.strictEqual(
        websocketOutcome(
            focusedWindow,
            facebookFeedThreadOpenFullFetchFrame,
            lightspeedUrl,
        ),
        "allowed",
        "Facebook full-thread realtime loads must remain allowed so unread mini-chats can render history",
    );
    assert.strictEqual(
        websocketOutcome(
            focusedWindow,
            facebookFeedArmadilloOpenThreadFrame,
            lightspeedUrl,
        ),
        "allowed",
        "Facebook Armadillo open-thread realtime loads must remain allowed so unread mini-chats can render history",
    );
}

function testFacebookGenericLightspeedHistoryWithReadMetadataStaysAllowed() {
    const lightspeedUrl = "wss://gateway.facebook.com/ws/lightspeed";
    const window = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });

    assert.strictEqual(
        websocketOutcome(
            window,
            facebookFeedThreadOpenWithReadMetadataFrame,
            lightspeedUrl,
        ),
        "allowed",
        "Generic Facebook thread-history frames must not be blocked just because they carry queue_name, task_id, and read metadata",
    );
}

function testFacebookBareBridgeReadReceiptsAreBlocked() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
    );
    context.window.localStorage.ghostifyDebug = "1";
    context.window.localStorage.ghostifyMessengerObserve = "1";
    context.window.__GHOSTIFY_RESET_CAPTURE__("bare-bridge-read-drop-test");

    const outcome = workerOutcome(context, facebookBareBridgeReadReceipt);
    assert.strictEqual(
        outcome.result,
        undefined,
        "Facebook bare bridge markThreadAsRead/readReceipt payloads with only a thread target must be dropped",
    );
    assert.strictEqual(
        outcome.postCount,
        0,
        "bare read-receipt bridge commands must not be forwarded to the worker",
    );
    assert.strictEqual(outcome.blocked, 1);

    const report = JSON.parse(context.window.__GHOSTIFY_REPORT__());
    const dropOutcome = report.observations.find(
        (event) =>
            event.transport === "worker.postMessage" &&
            String(event.action || "").startsWith("drop") &&
            event.blockType === "MSG_SEEN",
    );
    assert.ok(
        dropOutcome,
        "read bridge drop outcomes must be reported for live debugging",
    );
    assert.ok(
        dropOutcome.dataShape,
        "drop outcomes must include redacted postMessage shape metadata",
    );
    assert.ok(
        Array.isArray(dropOutcome.terms),
        "drop outcomes must include redacted matching terms",
    );
    assert.ok(dropOutcome.terms.includes("markthreadasread"));
    assert.strictEqual(dropOutcome.flags?.hasReadReceipt, true);
    assert.ok(
        Array.isArray(dropOutcome.callSite),
        "drop outcomes must include a sanitized call site",
    );
    assert.strictEqual(
        report.blockedWorkerMessages,
        1,
        "patch reports must include blocked worker counters for live Facebook send diagnostics",
    );
    assert.strictEqual(
        report.sanitizedSeenBridgeMessages,
        0,
        "patch reports must include sanitized seen bridge counters for live Facebook send diagnostics",
    );
    assert.strictEqual(
        report.messengerUnsafeBlocksSkipped,
        0,
        "patch reports must include Messenger unsafe-forward counters for live Facebook send diagnostics",
    );
    assert.strictEqual(
        report.unsafeTransferBlocksSkipped,
        0,
        "patch reports must include unsafe transfer counters for live Facebook send diagnostics",
    );
}

function testFacebookMixedBridgeReadReceiptBatchesAreSanitizedNotDropped() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
    );

    const outcome = portOutcome(context, facebookMixedBridgeReadReceiptBatch);
    assert.strictEqual(
        outcome.result,
        "port-sent",
        "mixed Facebook bridge batches must still reach the worker so older mini-chat history can load",
    );
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);
    assert.strictEqual(outcome.sanitizedSeen, 1);
    assert.ok(Array.isArray(outcome.post.message));
    assert.strictEqual(
        outcome.post.message.length,
        2,
        "only the read-receipt item should be removed from a mixed local bridge batch",
    );
    assert.strictEqual(
        outcome.post.message[0],
        facebookMixedBridgeReadReceiptBatch[0],
    );
    assert.strictEqual(
        outcome.post.message[1],
        facebookMixedBridgeReadReceiptBatch[2],
    );
}

function testFacebookBinaryMixedReadBatchesPreserveRestoredChatHydration() {
    for (const [label, payload] of [
        ["Uint8Array", facebookMixedBridgeReadReceiptBinary],
        [
            "ArrayBuffer",
            facebookMixedBridgeReadReceiptBinary.buffer.slice(
                facebookMixedBridgeReadReceiptBinary.byteOffset,
                facebookMixedBridgeReadReceiptBinary.byteOffset +
                    facebookMixedBridgeReadReceiptBinary.byteLength,
            ),
        ],
    ]) {
        const originalBytes = Array.from(
            payload instanceof ArrayBuffer
                ? new Uint8Array(payload)
                : new Uint8Array(
                      payload.buffer,
                      payload.byteOffset,
                      payload.byteLength,
                  ),
        );
        const context = makeMessengerPatchPage(
            {},
            {
                hostname: "www.facebook.com",
                pathname: "/",
                href: "https://www.facebook.com/",
            },
        );
        const outcome = portOutcome(context, payload);

        assert.strictEqual(
            outcome.result,
            "port-sent",
            `${label} mixed read/history batches must be forwarded`,
        );
        assert.strictEqual(outcome.postCount, 1);
        assert.strictEqual(outcome.blocked, 0);
        assert.strictEqual(outcome.sanitizedSeen, 1);
        assert.ok(
            outcome.post.message !== payload,
            `${label} sanitizer must clone instead of mutating transferred input`,
        );
        assert.strictEqual(
            Object.prototype.toString.call(outcome.post.message),
            Object.prototype.toString.call(payload),
            `${label} sanitizer must preserve the binary container type`,
        );
        const forwarded = JSON.parse(decodeBridgeBytes(outcome.post.message));
        assert.match(
            decodeBridgeBytes(outcome.post.message),
            /"epoch_id":7466175527281646892/,
        );
        assert.doesNotMatch(
            decodeBridgeBytes(outcome.post.message),
            /"epoch_id":7466175527281647000/,
        );
        assert.deepStrictEqual(
            forwarded.map((item) => item.label),
            ["openThreadHistory", "hydrateOlderMessages"],
            `${label} sanitizer must remove only the read item and preserve loader ordering`,
        );
        assert.deepStrictEqual(
            Array.from(
                payload instanceof ArrayBuffer
                    ? new Uint8Array(payload)
                    : new Uint8Array(
                          payload.buffer,
                          payload.byteOffset,
                          payload.byteLength,
                      ),
            ),
            originalBytes,
            `${label} input bytes must remain unchanged`,
        );
    }

    const sharedContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
    );
    const shared = sharedWorkerPortOutcome(
        sharedContext,
        facebookMixedBridgeReadReceiptBinary,
    );
    assert.strictEqual(shared.result, "shared-worker-port-sent");
    assert.strictEqual(shared.postCount, 1);
    assert.deepStrictEqual(
        JSON.parse(decodeBridgeBytes(shared.post.message)).map(
            (item) => item.label,
        ),
        ["openThreadHistory", "hydrateOlderMessages"],
    );
    assert.match(
        decodeBridgeBytes(shared.post.message),
        /"epoch_id":7466175527281646892/,
    );

    const websocketWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    const websocket = websocketSend(
        websocketWindow,
        facebookMixedBridgeReadReceiptBinary,
        "wss://gateway.facebook.com/ws/lightspeed",
    );
    assert.strictEqual(websocket.result, "sent");
    assert.strictEqual(websocket.socket.sent.length, 1);
    assert.deepStrictEqual(
        JSON.parse(decodeBridgeBytes(websocket.socket.sent[0])).map(
            (item) => item.label,
        ),
        ["openThreadHistory", "hydrateOlderMessages"],
    );
    assert.match(
        decodeBridgeBytes(websocket.socket.sent[0]),
        /"epoch_id":7466175527281646892/,
    );

    const purePortContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
    );
    assert.strictEqual(
        portOutcome(purePortContext, facebookBareBridgeReadReceiptBinary)
            .result,
        undefined,
    );

    const transferContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
    );
    const transferPayload = new Uint8Array(
        facebookMixedBridgeReadReceiptBinary,
    );
    const transfer = portOutcome(transferContext, transferPayload, [
        transferPayload.buffer,
    ]);
    assert.strictEqual(transfer.result, "port-sent");
    assert.strictEqual(
        transfer.post.transfer,
        undefined,
        "replacement bytes must not transfer the original backing buffer",
    );
    assert.deepStrictEqual(
        JSON.parse(decodeBridgeBytes(transfer.post.message)).map(
            (item) => item.label,
        ),
        ["openThreadHistory", "hydrateOlderMessages"],
    );
    const pureWebSocketWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    assert.strictEqual(
        websocketOutcome(
            pureWebSocketWindow,
            facebookBareBridgeReadReceiptBinary,
            "wss://gateway.facebook.com/ws/lightspeed",
        ),
        "blocked",
    );
}

function testFacebookFramedBinaryMixedReadBatchesPreserveRestoredChatHydration() {
    const assertSanitizedFrame = (
        value,
        label,
        expectedTag = "[object Uint8Array]",
    ) => {
        assert.strictEqual(Object.prototype.toString.call(value), expectedTag);
        const { outer, inner } = decodeFacebookFramedTasks(value);
        assert.strictEqual(outer.app_id, "2220391788200892");
        assert.strictEqual(outer.request_id, 199);
        assert.strictEqual(outer.type, 3);
        assert.match(outer.payload, /"epoch_id":7466175527281646891/);
        assert.doesNotMatch(outer.payload, /"epoch_id":7466175527281647000/);
        assert.deepStrictEqual(
            inner.tasks.map((task) => task.label),
            ["209", "hydrateOlderMessages"],
            `${label} must remove only the read task from the framed batch`,
        );
        assert.deepStrictEqual(
            inner.tasks.map((task) => task.task_id),
            [501, 503],
        );
        assert.doesNotMatch(
            JSON.stringify(inner),
            /markThreadAsRead|should_send_read_receipt|1779530000000/,
        );
    };

    const originalBytes = Array.from(facebookFramedRestoredGroupMixedReadBatch);
    for (const page of [
        {
            label: "Facebook top frame",
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
        {
            label: "Facebook MAW proxy",
            hostname: "www.fbsbx.com",
            pathname: "/maw_proxy_page/",
            href: "https://www.fbsbx.com/maw_proxy_page/",
        },
    ]) {
        const context = makeMessengerPatchPage({}, page);
        const outcome = portOutcome(
            context,
            facebookFramedRestoredGroupMixedReadBatch,
        );
        assert.strictEqual(
            outcome.result,
            "port-sent",
            `${page.label} framed mixed batches must be forwarded`,
        );
        assert.strictEqual(outcome.postCount, 1);
        assert.strictEqual(outcome.blocked, 0);
        assert.strictEqual(outcome.sanitizedSeen, 1);
        assertSanitizedFrame(outcome.post.message, page.label);
    }

    const websocketWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    const websocket = websocketSend(
        websocketWindow,
        facebookFramedRestoredGroupMixedReadBatch,
        "wss://gateway.facebook.com/ws/lightspeed",
    );
    assert.strictEqual(websocket.result, "sent");
    assert.strictEqual(websocket.socket.sent.length, 1);
    assertSanitizedFrame(websocket.socket.sent[0], "Facebook WebSocket");

    const arrayBufferContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
    );
    const arrayBufferPayload =
        facebookFramedRestoredGroupMixedReadBatch.buffer.slice(
            facebookFramedRestoredGroupMixedReadBatch.byteOffset,
            facebookFramedRestoredGroupMixedReadBatch.byteOffset +
                facebookFramedRestoredGroupMixedReadBatch.byteLength,
        );
    const arrayBufferOutcome = portOutcome(
        arrayBufferContext,
        arrayBufferPayload,
        [arrayBufferPayload],
    );
    assert.strictEqual(arrayBufferOutcome.result, "port-sent");
    assert.strictEqual(
        Object.prototype.toString.call(arrayBufferOutcome.post.message),
        "[object ArrayBuffer]",
    );
    assert.strictEqual(arrayBufferOutcome.post.transfer, undefined);
    assertSanitizedFrame(
        arrayBufferOutcome.post.message,
        "Facebook transferred ArrayBuffer",
        "[object ArrayBuffer]",
    );
    assert.deepStrictEqual(
        Array.from(facebookFramedRestoredGroupMixedReadBatch),
        originalBytes,
    );
}

function testSourcePreservingTaskSurgeryDeclinesGenericObjectRewrites() {
    const { sanitizeJsonTaskBatchStringSource } = loadBinaryJsonSourceHelpers();
    const scalarSource = JSON.stringify({
        epoch_id: "__UNSAFE_SCALAR_EPOCH_ID__",
        last_read_watermark_ts: 1779530000000,
        cursor: "redacted-cursor",
    }).replace('"__UNSAFE_SCALAR_EPOCH_ID__"', "7466175527281646894");
    const scalar = sanitizeJsonTaskBatchStringSource(scalarSource, (value) => {
        if (!value || Array.isArray(value) || typeof value !== "object") {
            return { value, changed: false, blockedAll: false };
        }
        if (value.last_read_watermark_ts === 1000000000000) {
            return { value, changed: false, blockedAll: false };
        }
        return {
            value: Object.assign({}, value, {
                last_read_watermark_ts: 1000000000000,
            }),
            changed: true,
            blockedAll: false,
        };
    });
    assert.strictEqual(
        scalar.changed,
        true,
        "source surgery must apply scalar rewrites without rebuilding sibling IDs",
    );
    assert.match(scalar.value, /"epoch_id":7466175527281646894/);
    assert.match(scalar.value, /"last_read_watermark_ts":1000000000000/);
    assert.doesNotMatch(scalar.value, /7466175527281647000/);

    const nestedSource = JSON.stringify({
        request_id: 1,
        epoch_id: "__UNSAFE_NESTED_EPOCH_ID__",
        operation: { label: "markThreadAsRead", thread_id: "redacted-thread" },
        cursor: "redacted-cursor",
    }).replace('"__UNSAFE_NESTED_EPOCH_ID__"', "7466175527281646895");
    const nested = sanitizeJsonTaskBatchStringSource(nestedSource, (value) => {
        if (value && !Array.isArray(value) && value.operation) {
            return {
                value: {
                    request_id: value.request_id,
                    epoch_id: value.epoch_id,
                    cursor: value.cursor,
                },
                changed: true,
                blockedAll: false,
            };
        }
        return { value, changed: false, blockedAll: false };
    });
    assert.strictEqual(
        nested.changed,
        true,
        "source surgery must omit blocked object children without rebuilding siblings",
    );
    assert.doesNotMatch(nested.value, /"operation":\[\]/);
    assert.doesNotMatch(nested.value, /"operation":/);
    assert.match(nested.value, /"epoch_id":7466175527281646895/);
    assert.doesNotMatch(nested.value, /7466175527281647000/);

    const scalarContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
    );
    const scalarPayload = JSON.stringify({
        label: "markThreadAsRead",
        epoch_id: "__UNSAFE_PRODUCTION_EPOCH_ID__",
        thread_key: { thread_fbid: "redacted-thread" },
        last_read_watermark_ts: 1779530000000,
        cursor: "redacted-cursor",
    }).replace('"__UNSAFE_PRODUCTION_EPOCH_ID__"', "7466175527281646896");
    const scalarOutcome = workerOutcome(scalarContext, scalarPayload);
    assert.strictEqual(scalarOutcome.result, "worker-sent");
    const forwardedScalar = JSON.parse(scalarOutcome.post.message);
    assert.strictEqual(forwardedScalar.cursor, "redacted-cursor");
    assert.strictEqual(forwardedScalar.last_read_watermark_ts, 1000000000000);
    assert.match(scalarOutcome.post.message, /"epoch_id":7466175527281646896/);
    assert.doesNotMatch(scalarOutcome.post.message, /7466175527281647000/);
}

function testFacebookStructuredMixedReadEnvelopesPreserveRestoredChatHydration() {
    const assertEnvelope = (value, label) => {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        assert.strictEqual(parsed.issue_new_task, true);
        assert.deepStrictEqual(
            Array.from(parsed.tasks, (task) => task.label),
            ["openThreadHistory", "hydrateOlderMessages"],
            `${label} must preserve both loader siblings`,
        );
        if (typeof value === "string") {
            assert.match(value, /"epoch_id":7466175527281646891/);
            assert.match(value, /"hydration_id":7466175527281646893/);
            assert.doesNotMatch(value, /7466175527281647000/);
        }
    };

    for (const page of [
        {
            label: "Facebook top frame",
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
        {
            label: "Facebook MAW proxy",
            hostname: "www.fbsbx.com",
            pathname: "/maw_proxy_page/",
            href: "https://www.fbsbx.com/maw_proxy_page/",
        },
    ]) {
        const objectContext = makeMessengerPatchPage({}, page);
        const objectOutcome = portOutcome(
            objectContext,
            facebookMixedBridgeReadReceiptEnvelope,
        );
        assert.strictEqual(
            objectOutcome.result,
            "port-sent",
            `${page.label} object envelope must be forwarded`,
        );
        assert.strictEqual(objectOutcome.postCount, 1);
        assertEnvelope(
            objectOutcome.post.message,
            `${page.label} object envelope`,
        );

        const stringContext = makeMessengerPatchPage({}, page);
        const stringOutcome = workerOutcome(
            stringContext,
            facebookMixedBridgeReadReceiptEnvelopeString,
        );
        assert.strictEqual(
            stringOutcome.result,
            "worker-sent",
            `${page.label} string envelope must be forwarded`,
        );
        assert.strictEqual(stringOutcome.postCount, 1);
        assertEnvelope(
            stringOutcome.post.message,
            `${page.label} string envelope`,
        );
    }

    for (const page of [
        {
            label: "Facebook WebSocket",
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
        {
            label: "MAW WebSocket",
            hostname: "www.fbsbx.com",
            pathname: "/maw_proxy_page/",
            href: "https://www.fbsbx.com/maw_proxy_page/",
        },
    ]) {
        const websocketWindow = makeGhostPage(page);
        const websocket = websocketSend(
            websocketWindow,
            facebookMixedBridgeReadReceiptEnvelopeString,
            "wss://gateway.facebook.com/ws/lightspeed",
        );
        assert.strictEqual(websocket.result, "sent");
        assert.strictEqual(websocket.socket.sent.length, 1);
        assertEnvelope(
            websocket.socket.sent[0],
            `${page.label} string envelope`,
        );

        assert.strictEqual(
            websocketOutcome(
                websocketWindow,
                JSON.stringify({
                    issue_new_task: true,
                    tasks: facebookBareBridgeReadReceipt,
                }),
                "wss://gateway.facebook.com/ws/lightspeed",
            ),
            "blocked",
            `${page.label} pure-read string envelopes must remain blocked`,
        );
    }

    const xhrWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    const xhr = xhrSend(
        xhrWindow,
        facebookMixedBridgeReadReceiptEnvelopeString,
    );
    assert.strictEqual(xhr.result, "sent");
    assertEnvelope(xhr.xhr.sent, "Facebook XHR string envelope");

    const paramsWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    const params = new paramsWindow.URLSearchParams();
    params.set("payload", facebookMixedBridgeReadReceiptEnvelopeString);
    const paramsXhr = xhrSend(paramsWindow, params);
    assert.strictEqual(paramsXhr.result, "sent");
    assert.ok(paramsXhr.xhr.sent instanceof paramsWindow.URLSearchParams);
    assertEnvelope(
        paramsXhr.xhr.sent.get("payload"),
        "Facebook URLSearchParams string envelope",
    );

    const pureContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
    );
    assert.strictEqual(
        portOutcome(pureContext, {
            issue_new_task: true,
            tasks: facebookBareBridgeReadReceipt,
        }).result,
        undefined,
        "pure read envelopes must still be blocked",
    );
}

function testFacebookPassiveReadReceiptThreadListQueriesStayNativeAcrossWorkerBridges() {
    const page = {
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    };
    const variables = {
        folder: "inbox",
        cursor: "redacted-inbox-cursor",
        direction: "older",
        thread_list: true,
        metadata: {
            read_receipt: "passive",
            should_send_read_receipt: false,
        },
    };
    const query = {
        operationName: "MWChatThreadListPaginationQuery",
        query: "query MWChatThreadListPaginationQuery { messenger_threads { nodes { id } } }",
        variables,
    };
    const source = JSON.stringify(query);

    const workerContext = makeMessengerPatchPage({}, page);
    const worker = workerOutcome(workerContext, source);
    assert.strictEqual(worker.result, "worker-sent");
    assert.strictEqual(
        worker.post.message,
        source,
        "normal inbox query strings with passive read_receipt metadata must remain byte-for-byte unchanged",
    );
    assert.deepStrictEqual(
        JSON.parse(worker.post.message).variables,
        variables,
    );
    assert.strictEqual(worker.blocked, 0);
    assert.strictEqual(worker.sanitized, 0);

    const portContext = makeMessengerPatchPage({}, page);
    const port = portOutcome(portContext, query);
    assert.strictEqual(port.result, "port-sent");
    assert.strictEqual(
        port.post.message,
        query,
        "normal inbox query objects with passive read_receipt metadata must retain bridge identity",
    );
    assert.strictEqual(
        port.post.message.variables,
        variables,
        "thread-list variables must retain their identity",
    );
    assert.strictEqual(
        port.post.message.variables.cursor,
        "redacted-inbox-cursor",
    );
    assert.strictEqual(
        port.post.message.variables.metadata.read_receipt,
        "passive",
    );
    assert.strictEqual(port.blocked, 0);
    assert.strictEqual(port.sanitized, 0);
}

function testFacebookExactReadWatermarkPaginationCursorPreservesNestedArguments() {
    const page = {
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatOpen: true,
    };
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);
    const nestedWatermark = Object.freeze({
        value: watermarkI64,
        source: "thread-list-loader",
    });
    const options = Object.freeze({
        cursor: "redacted-pagination-cursor",
        direction: "older",
        metadata_only: true,
        last_read_watermark: nestedWatermark,
    });
    const nativeResult = Object.freeze({ cursor: "redacted-next-cursor" });

    const assertNativeCall = (calls, result, label) => {
        assert.strictEqual(
            result,
            nativeResult,
            `${label} must preserve the native return contract`,
        );
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0][0], threadKeyI64);
        assert.strictEqual(calls[0][1], watermarkI64);
        assert.strictEqual(calls[0][2], options);
        assert.strictEqual(calls[0][2].last_read_watermark, nestedWatermark);
        assert.strictEqual(calls[0][2].last_read_watermark.value, watermarkI64);
        assert.deepStrictEqual(
            Array.from(calls[0][2].last_read_watermark.value),
            [1779530000, 417],
        );
    };

    const directContext = makeMessengerPatchPage({}, page);
    const directCalls = [];
    const directModule = registerMessengerModule(
        directContext,
        "LSReadWatermarkPaginationCursor",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (...args) {
                directCalls.push(args);
                return nativeResult;
            };
        },
    );
    assertNativeCall(
        directCalls,
        directModule.exports.default(threadKeyI64, watermarkI64, options),
        "direct LSReadWatermarkPaginationCursor export",
    );

    const dependencyContext = makeMessengerPatchPage({}, page);
    const dependencyCalls = [];
    const dependencyExports = {
        LSReadWatermarkPaginationCursor: {
            default(...args) {
                dependencyCalls.push(args);
                return nativeResult;
            },
        },
    };
    const dependencyModule = registerMessengerModuleWithDependencies(
        dependencyContext,
        "MWChatThreadListLoader",
        ["LSReadWatermarkPaginationCursor"],
        dependencyExports,
        function (_a, require, _c, _d, moduleObject) {
            moduleObject.exports.load = (...args) =>
                require("LSReadWatermarkPaginationCursor").default(...args);
        },
    );
    assertNativeCall(
        dependencyCalls,
        dependencyModule.exports.load(threadKeyI64, watermarkI64, options),
        "dependency-required LSReadWatermarkPaginationCursor export",
    );
}

async function testFacebookDuplicateUrlSearchParamsForwardOnlyPaginationTask() {
    const page = {
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    };
    const paginationEnvelope = JSON.stringify({
        issue_new_task: true,
        tasks: [facebookNormalThreadListPaginationTask],
    });
    const exactReadEnvelope = JSON.stringify({
        issue_new_task: true,
        tasks: [
            {
                label: "LSMarkThreadRead",
                operation: "LSMarkThreadRead",
                queue_name: "redacted-thread",
                task_id: "exact-read-task",
                payload: {
                    thread_key: { thread_fbid: "redacted-thread" },
                    readReceipt: true,
                },
            },
        ],
    });
    const makeParams = (window) => {
        const params = new window.URLSearchParams();
        params.append("payload", paginationEnvelope);
        params.append("payload", exactReadEnvelope);
        params.append("epoch_id", "7466175527281646898");
        return params;
    };
    const assertPaginationOnly = (params, label) => {
        assert.ok(
            params instanceof URLSearchParams,
            `${label} must retain URLSearchParams transport`,
        );
        const payloads = params.getAll("payload");
        assert.strictEqual(
            payloads.length,
            1,
            `${label} must remove only the duplicate-key exact read task`,
        );
        const forwarded = JSON.parse(payloads[0]);
        assert.deepStrictEqual(
            forwarded.tasks.map((task) => task.label),
            ["MWChatThreadListPaginationQuery"],
            `${label} must retain the normal pagination task`,
        );
        assert.strictEqual(
            forwarded.tasks[0].payload.cursor,
            "redacted-next-cursor",
        );
        assert.strictEqual(params.get("epoch_id"), "7466175527281646898");
    };

    const fetchWindow = makeGhostPage(page);
    assert.strictEqual(
        await fetchOutcome(fetchWindow, makeParams(fetchWindow)),
        "allowed",
    );
    assertPaginationOnly(
        fetchWindow.fetchCalls[0].init.body,
        "Facebook fetch duplicate-key URLSearchParams",
    );

    const xhrWindow = makeGhostPage(page);
    const xhr = xhrSend(xhrWindow, makeParams(xhrWindow));
    assert.strictEqual(xhr.result, "sent");
    assertPaginationOnly(
        xhr.xhr.sent,
        "Facebook XHR duplicate-key URLSearchParams",
    );
}

function testFacebookUpdateThreadReadWatermarkPaginationSignatureStaysNative() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);
    const options = Object.freeze({
        cursor: "redacted-pagination-cursor",
        direction: "older",
        metadata_only: true,
    });
    const calls = [];
    const nativeResult = Object.freeze({ loaded: true });
    const module = registerMessengerModule(
        context,
        "LSUpdateThreadReadWatermark",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (...args) {
                calls.push(args);
                return nativeResult;
            };
        },
    );

    assert.strictEqual(
        module.exports.default(threadKeyI64, watermarkI64, options),
        nativeResult,
    );
    assert.strictEqual(
        calls.length,
        1,
        "pagination-shaped LSUpdateThreadReadWatermark calls must execute natively",
    );
    assert.strictEqual(calls[0][0], threadKeyI64);
    assert.strictEqual(calls[0][1], watermarkI64);
    assert.strictEqual(calls[0][2], options);
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0,
        0,
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
        0,
    );
}

async function testFacebookAsyncUnconfirmedMarkThreadReadAliasStaysNative() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);
    const options = Object.freeze({ sync_group: 95 });
    const calls = [];
    const nativeResult = Object.freeze({ applied: "native" });
    const module = registerMessengerModule(
        context,
        "LSMarkThreadRead",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = async function (...args) {
                calls.push(args);
                return nativeResult;
            };
        },
    );

    const result = module.exports.default(threadKeyI64, watermarkI64, options);
    assert.ok(
        result && typeof result.then === "function",
        "unconfirmed async LSMarkThreadRead aliases must remain thenable",
    );
    assert.strictEqual(
        await result,
        nativeResult,
        "unconfirmed async aliases must preserve their native resolved value",
    );
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0][0], threadKeyI64);
    assert.strictEqual(calls[0][1], watermarkI64);
    assert.strictEqual(calls[0][2], options);
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0,
        0,
    );
}

async function testFacebookNormalThreadListPaginationSurvivesSeenProtection() {
    const page = {
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    };
    const assertExactPagination = (value, label) => {
        assert.strictEqual(
            value,
            facebookNormalThreadListPaginationEnvelopeSource,
            `${label} must remain byte-for-byte unchanged`,
        );
        assert.match(value, /"epoch_id":7466175527281646897/);
        assert.match(value, /MWChatThreadListPaginationQuery/);
        assert.match(value, /redacted-next-cursor/);
    };

    const fetchWindow = makeGhostPage(page);
    assert.strictEqual(
        await fetchOutcome(
            fetchWindow,
            facebookNormalThreadListPaginationEnvelopeSource,
        ),
        "allowed",
    );
    assertExactPagination(
        fetchWindow.fetchCalls[0].init.body,
        "Facebook fetch pagination",
    );

    const xhrWindow = makeGhostPage(page);
    const xhr = xhrSend(
        xhrWindow,
        facebookNormalThreadListPaginationEnvelopeSource,
    );
    assert.strictEqual(xhr.result, "sent");
    assertExactPagination(xhr.xhr.sent, "Facebook XHR pagination");

    const websocketWindow = makeGhostPage(page);
    const websocket = websocketSend(
        websocketWindow,
        facebookNormalThreadListPaginationEnvelopeSource,
        "wss://gateway.facebook.com/ws/lightspeed",
    );
    assert.strictEqual(websocket.result, "sent");
    assertExactPagination(
        websocket.socket.sent[0],
        "Facebook WebSocket pagination",
    );

    const workerContext = makeMessengerPatchPage({}, page);
    const worker = workerOutcome(
        workerContext,
        facebookNormalThreadListPaginationEnvelopeSource,
    );
    assert.strictEqual(worker.result, "worker-sent");
    assertExactPagination(worker.post.message, "Facebook Worker pagination");

    const portContext = makeMessengerPatchPage({}, page);
    const port = portOutcome(
        portContext,
        facebookNormalThreadListPaginationBinary,
    );
    assert.strictEqual(port.result, "port-sent");
    assert.strictEqual(
        port.post.message,
        facebookNormalThreadListPaginationBinary,
    );

    const targetedPaginationTask = JSON.parse(
        JSON.stringify(facebookNormalThreadListPaginationTask),
    );
    targetedPaginationTask.thread_key = "redacted-thread";
    targetedPaginationTask.payload.readReceipt = false;
    targetedPaginationTask.payload.seen_by_viewer = false;
    const targetedPaginationObject = {
        issue_new_task: true,
        tasks: [targetedPaginationTask],
    };
    for (const [label, send] of [
        [
            "Facebook Worker targeted pagination object",
            (context) => workerOutcome(context, targetedPaginationObject),
        ],
        [
            "Facebook MessagePort targeted pagination object",
            (context) => portOutcome(context, targetedPaginationObject),
        ],
    ]) {
        const context = makeMessengerPatchPage({}, page);
        const outcome = send(context);
        assert.ok(outcome.result, `${label} must remain native`);
        assert.strictEqual(outcome.postCount, 1);
        assert.deepStrictEqual(
            JSON.parse(JSON.stringify(outcome.post.message)),
            targetedPaginationObject,
        );
        assert.strictEqual(outcome.blocked, 0);
    }

    const mixedSource = JSON.stringify({
        issue_new_task: true,
        tasks: [
            facebookNormalThreadListPaginationTask,
            facebookBareBridgeReadReceipt[0],
        ],
    });
    const mixedWindow = makeGhostPage(page);
    const mixed = websocketSend(
        mixedWindow,
        mixedSource,
        "wss://gateway.facebook.com/ws/lightspeed",
    );
    assert.strictEqual(mixed.result, "sent");
    const mixedForwarded = JSON.parse(mixed.socket.sent[0]);
    assert.deepStrictEqual(
        mixedForwarded.tasks.map((task) => task.label),
        ["MWChatThreadListPaginationQuery"],
    );
    assert.strictEqual(
        mixedForwarded.tasks[0].payload.cursor,
        "redacted-next-cursor",
    );
    assert.strictEqual(
        mixedForwarded.tasks[0].payload.should_send_read_receipt,
        false,
    );

    const assertMixedPaginationOnly = (value, label) => {
        const decoded =
            typeof value === "string" ||
            (value &&
                typeof value === "object" &&
                !ArrayBuffer.isView(value) &&
                Object.prototype.toString.call(value) !==
                    "[object ArrayBuffer]")
                ? value
                : decodeBridgeBytes(value);
        const forwarded =
            typeof decoded === "string" ? JSON.parse(decoded) : decoded;
        assert.deepStrictEqual(
            Array.from(forwarded.tasks, (task) => task.label),
            ["MWChatThreadListPaginationQuery"],
            `${label} must preserve pagination while removing the sibling read mutation`,
        );
        assert.strictEqual(
            forwarded.tasks[0].payload.cursor,
            "redacted-next-cursor",
        );
    };

    for (const [label, send] of [
        [
            "Facebook Worker string batch",
            (context) => workerOutcome(context, mixedSource),
        ],
        [
            "Facebook MessagePort string batch",
            (context) => portOutcome(context, mixedSource),
        ],
        [
            "Facebook Worker object batch",
            (context) => workerOutcome(context, JSON.parse(mixedSource)),
        ],
        [
            "Facebook MessagePort object batch",
            (context) => portOutcome(context, JSON.parse(mixedSource)),
        ],
    ]) {
        const context = makeMessengerPatchPage({}, page);
        const outcome = send(context);
        assert.ok(outcome.result, `${label} must be forwarded`);
        assertMixedPaginationOnly(outcome.post.message, label);
    }

    const targetedMixedObject = {
        issue_new_task: true,
        tasks: [targetedPaginationTask, facebookBareBridgeReadReceipt[0]],
    };
    for (const [label, send] of [
        [
            "Facebook Worker targeted mixed object",
            (context) => workerOutcome(context, targetedMixedObject),
        ],
        [
            "Facebook MessagePort targeted mixed object",
            (context) => portOutcome(context, targetedMixedObject),
        ],
    ]) {
        const context = makeMessengerPatchPage({}, page);
        const outcome = send(context);
        assert.ok(outcome.result, `${label} must retain the pagination task`);
        assertMixedPaginationOnly(outcome.post.message, label);
    }

    const mixedBytes = new Uint8Array(Buffer.from(mixedSource, "utf8"));
    const workerBinaryContext = makeMessengerPatchPage({}, page);
    const workerBinary = workerOutcome(workerBinaryContext, mixedBytes);
    assert.strictEqual(workerBinary.result, "worker-sent");
    assertMixedPaginationOnly(
        workerBinary.post.message,
        "Facebook Worker Uint8Array batch",
    );

    const mixedArrayBuffer = mixedBytes.buffer.slice(
        mixedBytes.byteOffset,
        mixedBytes.byteOffset + mixedBytes.byteLength,
    );
    const portArrayBufferContext = makeMessengerPatchPage({}, page);
    const portArrayBuffer = portOutcome(
        portArrayBufferContext,
        mixedArrayBuffer,
        [mixedArrayBuffer],
    );
    assert.strictEqual(portArrayBuffer.result, "port-sent");
    assertMixedPaginationOnly(
        portArrayBuffer.post.message,
        "Facebook MessagePort ArrayBuffer batch",
    );

    for (const [variant, taskFields, payloadFields] of [
        [
            "LSMarkThreadRead",
            { operation: "LSMarkThreadRead" },
            { readReceipt: true },
        ],
        ["mark_read", { operation: "mark_read" }, {}],
        ["mark_seen", { operation: "mark_seen" }, {}],
        ["mark_as_read", { operation: "mark_as_read" }, {}],
        ["thread_seen operation", { operation: "thread_seen" }, {}],
        ["thread_seen truthy field", {}, { thread_seen: true }],
        ["read_receipt operation", { operation: "read_receipt" }, {}],
        ["updateLastSeenAt operation", { operation: "updateLastSeenAt" }, {}],
        [
            "LSUpdateLastReadWatermark operation",
            { operation: "LSUpdateLastReadWatermark" },
            {},
        ],
        [
            "UpdateLastReadWatermark operation",
            { operation: "UpdateLastReadWatermark" },
            {},
        ],
        [
            "update_last_read_watermark operation",
            { operation: "update_last_read_watermark" },
            {},
        ],
        ["readReceipt truthy field", {}, { readReceipt: true }],
        ["seen_by_viewer truthy field", {}, { seen_by_viewer: true }],
    ]) {
        const queryNamedReadMutation = JSON.stringify({
            issue_new_task: true,
            tasks: [
                {
                    ...facebookNormalThreadListPaginationTask,
                    ...taskFields,
                    thread_key: "redacted-thread",
                    payload: {
                        ...facebookNormalThreadListPaginationTask.payload,
                        ...payloadFields,
                    },
                },
            ],
        });
        const asBytes = () =>
            new Uint8Array(Buffer.from(queryNamedReadMutation, "utf8"));
        const asArrayBuffer = () => {
            const bytes = asBytes();
            return bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength,
            );
        };
        for (const [transport, send] of [
            [
                "Worker string",
                (context) => workerOutcome(context, queryNamedReadMutation),
            ],
            [
                "MessagePort string",
                (context) => portOutcome(context, queryNamedReadMutation),
            ],
            [
                "Worker object",
                (context) =>
                    workerOutcome(context, JSON.parse(queryNamedReadMutation)),
            ],
            [
                "MessagePort object",
                (context) =>
                    portOutcome(context, JSON.parse(queryNamedReadMutation)),
            ],
            [
                "Worker Uint8Array",
                (context) => workerOutcome(context, asBytes()),
            ],
            [
                "MessagePort Uint8Array",
                (context) => portOutcome(context, asBytes()),
            ],
            [
                "Worker ArrayBuffer",
                (context) => {
                    const value = asArrayBuffer();
                    return workerOutcome(context, value, [value]);
                },
            ],
            [
                "MessagePort ArrayBuffer",
                (context) => {
                    const value = asArrayBuffer();
                    return portOutcome(context, value, [value]);
                },
            ],
        ]) {
            const context = makeMessengerPatchPage({}, page);
            const outcome = send(context);
            if (outcome.result === undefined) {
                assert.strictEqual(outcome.postCount, 0);
                continue;
            }
            assert.strictEqual(outcome.postCount, 1);
            const forwarded =
                typeof outcome.post.message === "string"
                    ? outcome.post.message
                    : ArrayBuffer.isView(outcome.post.message) ||
                        Object.prototype.toString.call(outcome.post.message) ===
                            "[object ArrayBuffer]"
                      ? decodeBridgeBytes(outcome.post.message)
                      : JSON.stringify(outcome.post.message);
            assert.doesNotMatch(
                forwarded,
                /"(?:readReceipt|read_receipt|thread_seen|threadseen|seen_by_viewer|seenbyviewer)"\s*:\s*true|"operation"\s*:\s*"(?:LSMarkThreadRead|mark_read|mark_seen|mark_as_read|thread_seen|read_receipt|updateLastSeenAt|LSUpdateLastReadWatermark|UpdateLastReadWatermark|update_last_read_watermark)"/,
                `Facebook ${transport} query-named ${variant} mutation must be removed or neutralized before forwarding`,
            );
        }

        const assertNetworkNeutralized = (value, label) => {
            if (value == null) return;
            const forwarded =
                typeof value === "string" ? value : decodeBridgeBytes(value);
            assert.doesNotMatch(
                forwarded,
                /"(?:readReceipt|read_receipt|thread_seen|threadseen|seen_by_viewer|seenbyviewer)"\s*:\s*true|"operation"\s*:\s*"(?:LSMarkThreadRead|mark_read|mark_seen|mark_as_read|thread_seen|read_receipt|updateLastSeenAt|LSUpdateLastReadWatermark|UpdateLastReadWatermark|update_last_read_watermark)"/,
                `${label} must not forward the query-named ${variant} mutation`,
            );
        };
        const aliasWebSocketWindow = makeGhostPage(page);
        const aliasWebSocket = websocketSend(
            aliasWebSocketWindow,
            queryNamedReadMutation,
            "wss://gateway.facebook.com/ws/lightspeed",
        );
        assertNetworkNeutralized(
            aliasWebSocket.socket.sent[0],
            "Facebook WebSocket",
        );

        const aliasXhrWindow = makeGhostPage(page);
        const aliasXhr = xhrSend(aliasXhrWindow, queryNamedReadMutation);
        assertNetworkNeutralized(aliasXhr.xhr.sent, "Facebook XHR");

        const aliasFetchWindow = makeGhostPage(page);
        const aliasFetchOutcome = await fetchOutcome(
            aliasFetchWindow,
            queryNamedReadMutation,
        );
        if (aliasFetchOutcome === "allowed") {
            assertNetworkNeutralized(
                aliasFetchWindow.fetchCalls[0].init.body,
                "Facebook fetch",
            );
        } else {
            assert.strictEqual(aliasFetchOutcome, "MSG_SEEN");
        }
    }

    const longSessionWindow = makeGhostPage(page);
    for (let index = 0; index < 50; index += 1) {
        const paginationTask = JSON.parse(
            JSON.stringify(facebookNormalThreadListPaginationTask),
        );
        paginationTask.payload.cursor = `redacted-cursor-${index}`;
        const batch = JSON.stringify({
            issue_new_task: true,
            tasks: [paginationTask, facebookBareBridgeReadReceipt[0]],
        });
        const outcome = websocketSend(
            longSessionWindow,
            batch,
            "wss://gateway.facebook.com/ws/lightspeed",
        );
        assert.strictEqual(outcome.result, "sent");
        const forwarded = JSON.parse(outcome.socket.sent[0]);
        assert.deepStrictEqual(
            forwarded.tasks.map((task) => task.label),
            ["MWChatThreadListPaginationQuery"],
        );
        assert.strictEqual(
            forwarded.tasks[0].payload.cursor,
            `redacted-cursor-${index}`,
        );
    }
}

function testFacebookTargetlessBridgeReadReceiptBatchesAreSanitizedBeforeSharedWorkerStateUpdates() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
    );

    const outcome = portOutcome(
        context,
        facebookTargetlessBridgeReadReceiptBatch,
    );
    assert.strictEqual(
        outcome.result,
        "port-sent",
        "targetless Facebook bridge batches must still reach the worker so mini-chat history can load",
    );
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);
    assert.strictEqual(outcome.sanitizedSeen, 1);
    assert.ok(Array.isArray(outcome.post.message));
    assert.strictEqual(
        outcome.post.message.length,
        4,
        "only the targetless local read-receipt command should be removed from a mixed bridge batch",
    );
    assert.strictEqual(
        outcome.post.message[0],
        facebookTargetlessBridgeReadReceiptBatch[0],
    );
    assert.strictEqual(
        outcome.post.message[1],
        facebookTargetlessBridgeReadReceiptBatch[2],
    );
    assert.strictEqual(
        outcome.post.message[2],
        facebookTargetlessBridgeReadReceiptBatch[3],
    );
    assert.strictEqual(
        outcome.post.message[3],
        facebookTargetlessBridgeReadReceiptBatch[4],
    );
}

function testFacebookSharedWorkerPortsUseMessagePortPrivacyHooks() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
    );

    const bareRead = sharedWorkerPortOutcome(
        context,
        facebookBareBridgeReadReceipt,
    );
    assert.ok(bareRead.port instanceof context.MessagePort);
    assert.strictEqual(bareRead.result, undefined);
    assert.strictEqual(bareRead.postCount, 0);
    assert.strictEqual(bareRead.blocked, 1);

    const mixedBatch = sharedWorkerPortOutcome(
        context,
        facebookMixedBridgeReadReceiptBatch,
    );
    assert.ok(mixedBatch.port instanceof context.MessagePort);
    assert.strictEqual(mixedBatch.result, "shared-worker-port-sent");
    assert.strictEqual(mixedBatch.postCount, 1);
    assert.strictEqual(mixedBatch.post.target, "shared-worker-port");
    assert.strictEqual(mixedBatch.blocked, 1);
    assert.strictEqual(mixedBatch.sanitizedSeen, 1);
    assert.ok(Array.isArray(mixedBatch.post.message));
    assert.strictEqual(mixedBatch.post.message.length, 2);
    assert.strictEqual(
        mixedBatch.post.message[0],
        facebookMixedBridgeReadReceiptBatch[0],
    );
    assert.strictEqual(
        mixedBatch.post.message[1],
        facebookMixedBridgeReadReceiptBatch[2],
    );

    const history = sharedWorkerPortOutcome(
        context,
        facebookFeedThreadOpenFullFetchFrame,
    );
    assert.strictEqual(history.result, "shared-worker-port-sent");
    assert.strictEqual(history.postCount, 2);
    assert.strictEqual(history.post.target, "shared-worker-port");
    assert.strictEqual(
        history.post.message,
        facebookFeedThreadOpenFullFetchFrame,
    );
    assert.strictEqual(history.blocked, 1);

    const requestPayload = JSON.parse(lsMessageRequestThreadListLoad);
    const request = sharedWorkerPortOutcome(context, requestPayload);
    assert.strictEqual(request.result, "shared-worker-port-sent");
    assert.strictEqual(request.postCount, 3);
    assert.strictEqual(request.post.target, "shared-worker-port");
    assert.strictEqual(request.post.message, requestPayload);
    assert.strictEqual(request.blocked, 1);

    const sendPayload = JSON.parse(messengerSendWithWatermark);
    const send = sharedWorkerPortOutcome(context, sendPayload);
    assert.strictEqual(send.result, "shared-worker-port-sent");
    assert.strictEqual(send.postCount, 4);
    assert.strictEqual(send.post.target, "shared-worker-port");
    assert.strictEqual(send.post.message, sendPayload);
    assert.strictEqual(send.blocked, 1);
}

function testFacebookBridgeLightspeedReadFramesAreSanitizedBeforeSharedWorkerStateUpdates() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
    );

    const workerWatermark = workerOutcome(
        context,
        facebookWorkerEdgeChatReadWatermarkFrame,
    );
    assert.strictEqual(
        workerWatermark.result,
        "worker-sent",
        "Worker bridge label 21 frames must still reach Facebook so old mini-chat history can finish loading",
    );
    assert.strictEqual(workerWatermark.postCount, 1);
    assert.strictEqual(workerWatermark.blocked, 0);
    assert.strictEqual(workerWatermark.sanitizedSeen, 1);
    assert.notStrictEqual(
        workerWatermark.post.message,
        facebookWorkerEdgeChatReadWatermarkFrame,
    );
    assert.ok(ArrayBuffer.isView(workerWatermark.post.message));
    assert.match(
        decodeBridgeBytes(workerWatermark.post.message),
        /last_read_watermark_ts\\+":1000000000000/,
    );
    assert.doesNotMatch(
        decodeBridgeBytes(workerWatermark.post.message),
        /last_read_watermark_ts\\+":1780070888819/,
    );

    const portLastSeen = portOutcome(
        context,
        facebookWorkerEdgeChatLastSeenFrame,
    );
    assert.strictEqual(
        portLastSeen.result,
        "port-sent",
        "MessagePort bridge label 6 frames must still reach Facebook so old mini-chat history can finish loading",
    );
    assert.strictEqual(portLastSeen.postCount, 2);
    assert.strictEqual(portLastSeen.blocked, 0);
    assert.strictEqual(portLastSeen.sanitizedSeen, 2);
    assert.notStrictEqual(
        portLastSeen.post.message,
        facebookWorkerEdgeChatLastSeenFrame,
    );
    assert.ok(ArrayBuffer.isView(portLastSeen.post.message));
    assert.match(
        decodeBridgeBytes(portLastSeen.post.message),
        /last_seen_time_ms\\+":1000000000000/,
    );
    assert.doesNotMatch(
        decodeBridgeBytes(portLastSeen.post.message),
        /last_seen_time_ms\\+":1780070890716/,
    );

    const delivery = workerOutcome(
        context,
        facebookWorkerEdgeChatDeliveryFrame,
    );
    assert.strictEqual(
        delivery.result,
        "worker-sent",
        "Delivery frames without read-watermark intent must still reach the shared worker",
    );
    assert.strictEqual(delivery.postCount, 3);
    assert.strictEqual(delivery.blocked, 0);
    assert.strictEqual(delivery.sanitizedSeen, 2);
}

function testFacebookBridgeThreadOpenFramesStayAllowed() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
    );

    const fullFetch = workerOutcome(
        context,
        facebookFeedThreadOpenFullFetchFrame,
    );
    assert.strictEqual(
        fullFetch.result,
        "worker-sent",
        "Facebook full-thread bridge loads must stay allowed so unread mini-chat history can render",
    );
    assert.strictEqual(fullFetch.blocked, 0);

    const metadataFetch = portOutcome(
        context,
        facebookFeedThreadOpenWithReadMetadataFrame,
    );
    assert.strictEqual(
        metadataFetch.result,
        "port-sent",
        "Facebook history bridge frames with queue_name/task_id/read metadata must stay allowed unless they are label 6 or label 21 read writes",
    );
    assert.strictEqual(metadataFetch.blocked, 0);
}

function testFacebookWorkersKeepNativeScriptUrls() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
    );

    const worker = new context.Worker(
        "https://www.facebook.com/rsrc.php/v4/yx/r/redacted-worker.js",
    );
    assert.ok(worker, "worker construction should still return a worker");
    assert.strictEqual(
        context.workerConstructs[0].scriptURL,
        "https://www.facebook.com/rsrc.php/v4/yx/r/redacted-worker.js",
        "Facebook Worker script URLs must stay native so realtime/chat loaders keep their original worker identity",
    );

    const sharedWorker = new context.SharedWorker(
        "https://www.facebook.com/static_resources/webworker/init_script/?worker_type=MODULE",
        { type: "module", name: "redacted-shared-worker" },
    );

    assert.ok(
        sharedWorker.port,
        "test SharedWorker should expose a port like the browser surface",
    );
    assert.ok(
        sharedWorker.port instanceof context.MessagePort,
        "SharedWorker.port must use the MessagePort prototype so bridge privacy hooks are exercised",
    );
    assert.strictEqual(context.workerConstructs.length, 2);
    assert.strictEqual(context.workerConstructs[1].shared, true);
    assert.strictEqual(
        context.workerConstructs[1].scriptURL,
        "https://www.facebook.com/static_resources/webworker/init_script/?worker_type=MODULE",
        "Facebook SharedWorker URLs must not be replaced with per-page blob URLs",
    );
    assert.strictEqual(
        context.workerConstructs[1].options?.type,
        "module",
        "SharedWorker module options must be preserved while leaving the native script URL intact",
    );
}

(async () => {
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
    console.log("realtime bridge and worker regression tests passed");
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
