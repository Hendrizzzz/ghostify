const assert = require("assert");

const {
    SAFE_READ_WATERMARK,
    messengerSendWithWatermark,
    messengerSendWithReadReceiptFlag,
    messengerBatchedSendWithReadReceipt,
    messengerSendWithUserAuthoredPrivacyTerms,
    messengerDeliveryWithWatermark,
    messengerReadReceipt,
    facebookFramePrefix,
    makeGhostPage,
    makeMessengerPage,
    makeMessengerPatchPage,
    fetchOutcome,
    fetchOutcomeAt,
    websocketOutcome,
    websocketSend,
    xhrSend,
    xhrSendAt,
    workerOutcome,
    portOutcome,
    decodeFacebookFramedTasks,
} = require("../helpers/regression-harness");

const messengerBatchedSendWithTyping = JSON.stringify({
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
            label: "sendChatStateFromComposer",
            queue_name: "typing_indicator",
            payload: {
                thread_key: { thread_fbid: "redacted-thread" },
                chatstate: "typing_indicator",
                send_type: "typing",
            },
        },
    ],
});

const messengerFormEncodedBatchedSendWithReadReceipt = `payload=${encodeURIComponent(messengerBatchedSendWithReadReceipt)}&epoch_id=redacted-epoch`;

const messengerBatchedSendUserTextWithTyping = JSON.stringify({
    issue_new_task: true,
    tasks: [
        {
            label: "send_message",
            queue_name: "messenger_send_message",
            payload: {
                thread_key: { thread_fbid: "redacted-thread" },
                send_type: 1,
                offline_threading_id: "redacted-offline-id",
                message: { text: "typing_indicator mark_read read_receipt" },
            },
        },
        {
            label: "sendChatStateFromComposer",
            queue_name: "typing_indicator",
            payload: {
                thread_key: { thread_fbid: "redacted-thread" },
                chatstate: "typing_indicator",
                send_type: "typing",
            },
        },
    ],
});

const messengerReadOnlySeenViewerFalseMetadata = JSON.stringify({
    issue_new_task: true,
    tasks: [
        {
            label: "message_metadata_load",
            queue_name: "mwchat_fetch_thread",
            payload: {
                thread_key: { thread_fbid: "redacted-thread" },
                seen_by_viewer: false,
                seenByViewer: false,
                cursor: "redacted-cursor",
            },
        },
    ],
});

const messengerEncodedReadOnlySeenViewerFalseMetadata = `payload=${encodeURIComponent(messengerReadOnlySeenViewerFalseMetadata)}&epoch_id=redacted-epoch`;

const facebookGraphQLShortSendWithReadMetadata = `fb_api_req_friendly_name=CometMessengerSendMessageMutation&doc_id=redacted-doc&variables=${encodeURIComponent(
    JSON.stringify({
        input: {
            thread_key: { thread_fbid: "redacted-thread" },
            offline_threading_id: "redacted-offline-id",
            client_mutation_id: "redacted-client-mutation",
            send_type: 1,
            message: { text: "1" },
            last_read_watermark_ts: 1779530000000,
            should_send_read_receipt: true,
        },
    }),
)}`;

const facebookGraphQLShortSendWithTypingMetadata = `fb_api_req_friendly_name=CometMessengerSendMessageMutation&doc_id=redacted-doc&variables=${encodeURIComponent(
    JSON.stringify({
        input: {
            thread_key: { thread_fbid: "redacted-thread" },
            offline_threading_id: "redacted-offline-id",
            client_mutation_id: "redacted-client-mutation",
            send_type: 1,
            message: { text: "." },
            composer: { is_typing: true },
            chatstate: "typing_indicator",
        },
    }),
)}`;

async function fetchRequestOutcome(window, body) {
    const request = new window.Request("/ls_req", {
        method: "POST",
        body,
    });
    const response = await window.fetch(request);
    return response.ghostifyResponse
        ? JSON.parse(response.body).blocked
        : "allowed";
}

function parseForwardedMessage(post) {
    assert.ok(post, "expected bridge message to be forwarded");
    return typeof post.message === "string"
        ? JSON.parse(post.message)
        : post.message;
}

async function testMessengerSendWatermarkTrafficIsAllowed() {
    const window = makeMessengerPage();

    assert.strictEqual(
        await fetchOutcome(window, messengerSendWithWatermark),
        "allowed",
        "Messenger send-like LS traffic with send_type must not be treated as a read receipt",
    );
    assert.strictEqual(
        websocketOutcome(window, messengerSendWithWatermark),
        "allowed",
        "Messenger send-like WebSocket traffic with send_type must not be dropped",
    );
}

async function testMessengerSendReceiptFlagTrafficIsAllowed() {
    const window = makeMessengerPage();

    assert.strictEqual(
        await fetchOutcome(window, messengerSendWithReadReceiptFlag),
        "allowed",
        "Messenger send-like LS traffic with read-receipt flags must still pass",
    );
    assert.strictEqual(
        websocketOutcome(window, messengerSendWithReadReceiptFlag),
        "allowed",
        "Messenger send-like WebSocket traffic with read-receipt flags must still pass",
    );
}

async function testMessengerBatchedSendTrafficIsAllowed() {
    const window = makeMessengerPage();

    assert.strictEqual(
        await fetchOutcome(window, messengerBatchedSendWithReadReceipt),
        "allowed",
        "Messenger batches containing a real send task must not be dropped wholesale",
    );
    assert.strictEqual(
        websocketOutcome(window, messengerBatchedSendWithReadReceipt),
        "allowed",
        "Messenger WebSocket batches containing a real send task must not be dropped wholesale",
    );
}

async function testMessengerBatchedNetworkTrafficSanitizesPrivacyTasks() {
    const fetchWindow = makeMessengerPage();
    fetchWindow.localStorage.ghostifyDebug = "1";
    fetchWindow.localStorage.ghostifyMessengerObserve = "1";
    fetchWindow.__GHOSTIFY_RESET_CAPTURE__("network-sanitize-report-test");

    assert.strictEqual(
        await fetchOutcome(fetchWindow, messengerBatchedSendWithReadReceipt),
        "allowed",
    );
    assert.strictEqual(fetchWindow.fetchCalls.length, 1);
    const forwardedFetch = JSON.parse(fetchWindow.fetchCalls[0].init.body);
    assert.deepStrictEqual(
        forwardedFetch.tasks.map((task) => task.label),
        ["send_message"],
        "Fetch send batches should preserve the send task and remove bundled read receipts",
    );
    const report = JSON.parse(fetchWindow.__GHOSTIFY_REPORT__());
    assert.strictEqual(
        report.sanitizedNetworkMessages,
        1,
        "network reports must include sanitized network counters for live Facebook send diagnostics",
    );

    const wsWindow = makeMessengerPage();
    const wsOutcome = websocketSend(wsWindow, messengerBatchedSendWithTyping);
    assert.strictEqual(wsOutcome.result, "sent");
    assert.strictEqual(wsOutcome.socket.sent.length, 1);
    const forwardedWebSocket = JSON.parse(wsOutcome.socket.sent[0]);
    assert.deepStrictEqual(
        forwardedWebSocket.tasks.map((task) => task.label),
        ["send_message"],
        "WebSocket send batches should preserve the send task and remove bundled typing updates",
    );

    const xhrWindow = makeMessengerPage();
    const xhrOutcome = xhrSend(xhrWindow, messengerBatchedSendWithReadReceipt);
    assert.strictEqual(xhrOutcome.result, "sent");
    const forwardedXhr = JSON.parse(xhrOutcome.xhr.sent);
    assert.deepStrictEqual(
        forwardedXhr.tasks.map((task) => task.label),
        ["send_message"],
        "XHR send batches should preserve the send task and remove bundled read receipts",
    );

    const requestWindow = makeMessengerPage();
    assert.strictEqual(
        await fetchRequestOutcome(
            requestWindow,
            messengerBatchedSendWithReadReceipt,
        ),
        "allowed",
    );
    assert.strictEqual(requestWindow.fetchCalls.length, 1);
    const forwardedRequest = requestWindow.fetchCalls[0].input;
    assert.ok(forwardedRequest instanceof requestWindow.Request);
    assert.deepStrictEqual(
        JSON.parse(forwardedRequest.body).tasks.map((task) => task.label),
        ["send_message"],
        "Fetch Request bodies should be replayed with bundled read receipts removed",
    );

    const encodedWindow = makeMessengerPage();
    assert.strictEqual(
        await fetchOutcome(
            encodedWindow,
            messengerFormEncodedBatchedSendWithReadReceipt,
        ),
        "allowed",
    );
    assert.strictEqual(encodedWindow.fetchCalls.length, 1);
    const forwardedParams = new URLSearchParams(
        encodedWindow.fetchCalls[0].init.body,
    );
    assert.strictEqual(forwardedParams.get("epoch_id"), "redacted-epoch");
    const forwardedPayload = JSON.parse(forwardedParams.get("payload"));
    assert.deepStrictEqual(
        forwardedPayload.tasks.map((task) => task.label),
        ["send_message"],
        "URL-encoded LS payload JSON should preserve sends and remove bundled read receipts",
    );

    const paramsWindow = makeMessengerPage();
    const paramsBody = new paramsWindow.URLSearchParams();
    paramsBody.set("payload", messengerBatchedSendWithReadReceipt);
    paramsBody.set("epoch_id", "redacted-epoch");
    assert.strictEqual(await fetchOutcome(paramsWindow, paramsBody), "allowed");
    assert.strictEqual(paramsWindow.fetchCalls.length, 1);
    const forwardedUrlSearchParams = paramsWindow.fetchCalls[0].init.body;
    assert.ok(forwardedUrlSearchParams instanceof paramsWindow.URLSearchParams);
    assert.strictEqual(
        forwardedUrlSearchParams.get("epoch_id"),
        "redacted-epoch",
    );
    assert.deepStrictEqual(
        JSON.parse(forwardedUrlSearchParams.get("payload")).tasks.map(
            (task) => task.label,
        ),
        ["send_message"],
        "URLSearchParams LS payload JSON should preserve sends and remove bundled read receipts",
    );

    const separateParamsWindow = makeMessengerPage();
    const separateParamsBody = new separateParamsWindow.URLSearchParams();
    separateParamsBody.set("send", messengerSendWithWatermark);
    separateParamsBody.set("seen", messengerReadReceipt);
    separateParamsBody.set("epoch_id", "redacted-epoch");
    assert.strictEqual(
        await fetchOutcome(separateParamsWindow, separateParamsBody),
        "allowed",
    );
    const forwardedSeparateParams =
        separateParamsWindow.fetchCalls[0].init.body;
    assert.ok(
        forwardedSeparateParams instanceof separateParamsWindow.URLSearchParams,
    );
    assert.strictEqual(forwardedSeparateParams.has("seen"), false);
    assert.strictEqual(forwardedSeparateParams.has("send"), true);
    assert.strictEqual(
        forwardedSeparateParams.get("epoch_id"),
        "redacted-epoch",
    );

    const standaloneSeenParamsWindow = makeMessengerPage();
    const standaloneSeenParams =
        new standaloneSeenParamsWindow.URLSearchParams();
    standaloneSeenParams.set("seen", messengerReadReceipt);
    standaloneSeenParams.set("epoch_id", "redacted-epoch");
    assert.strictEqual(
        await fetchOutcome(standaloneSeenParamsWindow, standaloneSeenParams),
        "MSG_SEEN",
    );
    assert.strictEqual(standaloneSeenParamsWindow.fetchCalls.length, 0);
}

async function testRapidMessengerSendsWithPrivacyMarkersAreAllowed() {
    const window = makeMessengerPage();
    const socket = new window.WebSocket(
        "wss://edge-chat.messenger.com/chat?region=redacted",
    );

    for (let index = 0; index < 12; index += 1) {
        const payload = JSON.stringify({
            issue_new_task: true,
            tasks: [
                {
                    label: "send_message",
                    queue_name: "messenger_send_message",
                    payload: {
                        thread_key: { thread_fbid: "redacted-thread" },
                        send_type: 1,
                        offline_threading_id: `redacted-offline-id-${index}`,
                        message: { text: `<redacted-user-text-${index}>` },
                        last_read_watermark_ts: 1779530000000 + index,
                        shouldSendReadReceipt:
                            index % 2 === 0 ? false : undefined,
                    },
                },
            ],
        });

        assert.strictEqual(await fetchOutcome(window, payload), "allowed");
        assert.strictEqual(socket.send(payload), "sent");
    }

    assert.strictEqual(window.fetchCalls.length, 12);
    assert.strictEqual(socket.sent.length, 12);
}

async function testMessengerSendUserTextPrivacyTermsAreAllowed() {
    const window = makeMessengerPage();

    assert.strictEqual(
        await fetchOutcome(window, messengerSendWithUserAuthoredPrivacyTerms),
        "allowed",
        "User-authored message text must not trigger Messenger privacy blockers",
    );
    assert.strictEqual(
        websocketOutcome(window, messengerSendWithUserAuthoredPrivacyTerms),
        "allowed",
        "User-authored message text must not drop Messenger WebSocket sends",
    );
}

async function testMessengerDeliveryWatermarkTrafficIsAllowed() {
    const window = makeMessengerPage();

    assert.strictEqual(
        await fetchOutcome(window, messengerDeliveryWithWatermark),
        "allowed",
        "Messenger delivery acknowledgements with watermarks must not be treated as seen receipts",
    );
    assert.strictEqual(
        websocketOutcome(window, messengerDeliveryWithWatermark),
        "allowed",
        "Messenger edge-chat delivery acknowledgements with watermarks must pass",
    );
    assert.strictEqual(
        websocketOutcome(
            window,
            messengerDeliveryWithWatermark,
            "wss://www.messenger.com/ws/streamcontroller",
        ),
        "allowed",
        "Messenger streamcontroller delivery acknowledgements with watermarks must pass",
    );
    assert.strictEqual(
        await fetchOutcome(window, messengerReadOnlySeenViewerFalseMetadata),
        "allowed",
        "Messenger read-only metadata with seen_by_viewer=false must not be treated as a seen write",
    );
    assert.strictEqual(
        websocketOutcome(window, messengerReadOnlySeenViewerFalseMetadata),
        "allowed",
        "Messenger WebSocket read-only metadata with seen_by_viewer=false must pass",
    );
    assert.strictEqual(
        await fetchOutcomeAt(
            window,
            "/ls_req",
            messengerEncodedReadOnlySeenViewerFalseMetadata,
        ),
        "allowed",
        "URL-encoded read-only metadata with seen_by_viewer=false must not be treated as a seen write",
    );
}

async function testFacebookGraphQLShortSendsWithPrivacyMetadataAreAllowed() {
    const facebookWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatOpen: true,
    });

    assert.strictEqual(
        await fetchOutcomeAt(
            facebookWindow,
            "/api/graphql/",
            facebookGraphQLShortSendWithReadMetadata,
        ),
        "allowed",
        "Facebook short message sends with bundled read metadata must not be blocked as seen",
    );
    assert.strictEqual(
        await fetchOutcomeAt(
            facebookWindow,
            "/api/graphql/",
            facebookGraphQLShortSendWithTypingMetadata,
        ),
        "allowed",
        "Facebook short message sends with bundled typing metadata must not be blocked as typing",
    );
    assert.strictEqual(
        xhrSendAt(
            facebookWindow,
            "/api/graphql/",
            facebookGraphQLShortSendWithReadMetadata,
            "POST",
        ).result,
        "sent",
        "Facebook XHR short message sends with bundled read metadata must still send",
    );
}

function testMessengerPatchMixedSendTypingBatchPreservesSend() {
    const context = makeMessengerPatchPage();
    const outcome = workerOutcome(
        context,
        JSON.parse(messengerBatchedSendWithTyping),
    );

    assert.strictEqual(outcome.result, "worker-sent");
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);

    const forwarded = parseForwardedMessage(outcome.post);
    assert.strictEqual(forwarded.tasks.length, 1);
    assert.strictEqual(forwarded.tasks[0].label, "send_message");

    const portContext = makeMessengerPatchPage();
    const portResult = portOutcome(
        portContext,
        JSON.parse(messengerBatchedSendUserTextWithTyping),
    );
    assert.strictEqual(portResult.result, "port-sent");
    assert.strictEqual(portResult.postCount, 1);
    assert.strictEqual(portResult.blocked, 0);

    const forwardedPortMessage = parseForwardedMessage(portResult.post);
    assert.strictEqual(forwardedPortMessage.tasks.length, 1);
    assert.strictEqual(forwardedPortMessage.tasks[0].label, "send_message");
    assert.strictEqual(
        forwardedPortMessage.tasks[0].payload.message.text,
        "typing_indicator mark_read read_receipt",
    );
}

function testFacebookPatchMixedSendTypingBatchPreservesSend() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/messages/t/redacted-thread",
            href: "https://www.facebook.com/messages/t/redacted-thread",
        },
    );
    const outcome = workerOutcome(
        context,
        JSON.parse(messengerBatchedSendWithTyping),
    );

    assert.strictEqual(outcome.result, "worker-sent");
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);

    const forwarded = parseForwardedMessage(outcome.post);
    assert.strictEqual(forwarded.tasks.length, 1);
    assert.strictEqual(forwarded.tasks[0].label, "send_message");
}

function testFacebookMiniChatSecureSendWithAlternateTargetsIsForwarded() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const message = {
        issue_new_task: true,
        tasks: [
            {
                label: "send_message",
                queue_name: "messenger_send_message",
                payload: {
                    target_id: "redacted-user",
                    other_user_fbid: "redacted-user",
                    open_message_thread_key: "redacted-open-thread",
                    armadillo_thread_key: "redacted-open-thread",
                    send_type: 1,
                    offline_threading_id: "redacted-offline-id",
                    message: { text: "1" },
                    should_send_read_receipt: true,
                    chatstate: "typing_indicator",
                },
            },
        ],
    };
    const outcome = workerOutcome(context, message);

    assert.strictEqual(
        outcome.result,
        "worker-sent",
        "Facebook mini-chat secure sends with alternate thread targets must not be dropped as typing",
    );
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);

    const forwarded = parseForwardedMessage(outcome.post);
    assert.strictEqual(forwarded.tasks.length, 1);
    assert.strictEqual(forwarded.tasks[0].label, "send_message");
    assert.strictEqual(forwarded.tasks[0].payload.message.text, "1");
}

function testFacebookMiniChatQueueDirectSendSanitizesBundledPrivacy() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const message = {
        issue_new_task: true,
        tasks: [
            {
                label: "46",
                queue_name: "redacted-user",
                payload: JSON.stringify({
                    other_user_id: "redacted-user",
                    offline_threading_id: "redacted-offline-id",
                    send_type: 1,
                    message: { text: "a" },
                    sync_group: 104,
                    should_send_read_receipt: true,
                    last_read_watermark_ts: 1779530000000,
                }),
            },
            {
                label: "sendChatStateFromComposer",
                queue_name: "redacted-user",
                payload: JSON.stringify({
                    other_user_id: "redacted-user",
                    chatstate: "typing_indicator",
                    send_type: "typing",
                }),
            },
        ],
    };
    const outcome = workerOutcome(context, message);

    assert.strictEqual(
        outcome.result,
        "worker-sent",
        "Facebook queue-routed direct sends must survive bundled privacy sanitization",
    );
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);
    assert.strictEqual(
        outcome.sanitizedSeen,
        1,
        "direct sends must remove bundled Seen metadata without dropping the message",
    );
    const forwarded = parseForwardedMessage(outcome.post);
    assert.strictEqual(forwarded.tasks.length, 1);
    assert.strictEqual(forwarded.tasks[0].label, "46");
    const payload = JSON.parse(forwarded.tasks[0].payload);
    assert.strictEqual(payload.other_user_id, "redacted-user");
    assert.strictEqual(payload.message.text, "a");
    assert.strictEqual(payload.should_send_read_receipt, false);
    assert.strictEqual(payload.last_read_watermark_ts, SAFE_READ_WATERMARK);
    assert.strictEqual(
        JSON.parse(message.tasks[0].payload).should_send_read_receipt,
        true,
    );

    const portContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const port = portOutcome(portContext, message);
    assert.strictEqual(port.result, "port-sent");
    assert.strictEqual(port.postCount, 1);
    assert.strictEqual(port.blocked, 0);
    assert.strictEqual(port.sanitizedSeen, 1);
    assert.strictEqual(port.post.message.tasks.length, 1);
    const portPayload = JSON.parse(port.post.message.tasks[0].payload);
    assert.strictEqual(portPayload.other_user_id, "redacted-user");
    assert.strictEqual(portPayload.should_send_read_receipt, false);
    assert.strictEqual(portPayload.last_read_watermark_ts, SAFE_READ_WATERMARK);

    const seenDisabled = workerOutcome(
        makeMessengerPatchPage(
            {
                msgSeen: false,
                msgTyping: true,
            },
            {
                hostname: "www.facebook.com",
                pathname: "/",
                href: "https://www.facebook.com/",
                facebookMiniChatOpen: true,
            },
        ),
        message,
    );
    assert.strictEqual(seenDisabled.result, "worker-sent");
    assert.strictEqual(seenDisabled.postCount, 1);
    assert.strictEqual(seenDisabled.sanitized, 1);
    assert.strictEqual(seenDisabled.sanitizedSeen, 0);
    assert.strictEqual(seenDisabled.post.message.tasks.length, 1);
    const seenDisabledPayload = JSON.parse(
        seenDisabled.post.message.tasks[0].payload,
    );
    assert.strictEqual(seenDisabledPayload.should_send_read_receipt, true);
    assert.strictEqual(
        seenDisabledPayload.last_read_watermark_ts,
        1779530000000,
    );

    const typingDisabled = workerOutcome(
        makeMessengerPatchPage(
            {
                msgSeen: true,
                msgTyping: false,
            },
            {
                hostname: "www.facebook.com",
                pathname: "/",
                href: "https://www.facebook.com/",
                facebookMiniChatOpen: true,
            },
        ),
        message,
    );
    assert.strictEqual(typingDisabled.result, "worker-sent");
    assert.strictEqual(typingDisabled.postCount, 1);
    assert.strictEqual(typingDisabled.sanitizedSeen, 1);
    assert.strictEqual(typingDisabled.post.message.tasks.length, 2);
    const typingDisabledPayload = JSON.parse(
        typingDisabled.post.message.tasks[0].payload,
    );
    assert.strictEqual(typingDisabledPayload.should_send_read_receipt, false);
    assert.strictEqual(
        typingDisabledPayload.last_read_watermark_ts,
        SAFE_READ_WATERMARK,
    );
    assert.strictEqual(
        typingDisabled.post.message.tasks[1].label,
        "sendChatStateFromComposer",
    );

    const protectionsDisabled = workerOutcome(
        makeMessengerPatchPage(
            {
                msgSeen: false,
                msgTyping: false,
            },
            {
                hostname: "www.facebook.com",
                pathname: "/",
                href: "https://www.facebook.com/",
                facebookMiniChatOpen: true,
            },
        ),
        message,
    );
    assert.strictEqual(protectionsDisabled.result, "worker-sent");
    assert.strictEqual(protectionsDisabled.postCount, 1);
    assert.strictEqual(protectionsDisabled.post.message, message);
}

function testFacebookGroupSendWithQueueOnlyTargetPreservesSendAndRemovesTyping() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const message = {
        issue_new_task: true,
        tasks: [
            {
                label: "46",
                queue_name: "redacted-group-thread",
                task_id: 414,
                payload: JSON.stringify({
                    offline_threading_id: "redacted-offline-id",
                    send_type: 1,
                    message: { text: "group message" },
                    sync_group: 104,
                }),
            },
            {
                label: "sendChatStateFromComposer",
                queue_name: "redacted-group-thread",
                task_id: 415,
                payload: JSON.stringify({
                    chatstate: "typing_indicator",
                    send_type: "typing",
                }),
            },
        ],
    };
    const outcome = workerOutcome(context, message);

    assert.strictEqual(outcome.result, "worker-sent");
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);
    assert.strictEqual(
        outcome.sanitized,
        1,
        "Facebook group sends routed only by queue_name must remove bundled typing without dropping the send",
    );
    assert.notStrictEqual(outcome.post.message, message);
    assert.strictEqual(outcome.post.message.tasks.length, 1);
    assert.strictEqual(outcome.post.message.tasks[0], message.tasks[0]);

    const seenContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const workerThreadId = "7466158453245588004";
    const workerPayload = JSON.stringify({
        thread_id: "__GHOSTIFY_WORKER_THREAD_ID__",
        offline_threading_id: "redacted-offline-id",
        send_type: "1",
        message: {
            text: "group message",
            metadata: {
                should_send_read_receipt: true,
                last_read_watermark_ts: 1779530000000,
            },
        },
        sync_group: 104,
        last_read_watermark_ts: 1779530000000,
        should_send_read_receipt: true,
    }).replace('"__GHOSTIFY_WORKER_THREAD_ID__"', workerThreadId);
    const seenMessage = {
        issue_new_task: true,
        tasks: [
            {
                label: "46",
                queue_name: "redacted-group-thread",
                task_id: 416,
                should_send_read_receipt: true,
                last_read_watermark_ts: 1779530000000,
                readReceiptMutation: { should_send_read_receipt: true },
                payload: workerPayload,
            },
        ],
    };
    const seenOutcome = workerOutcome(seenContext, seenMessage);

    assert.strictEqual(seenOutcome.result, "worker-sent");
    assert.strictEqual(seenOutcome.postCount, 1);
    assert.strictEqual(seenOutcome.blocked, 0);
    assert.strictEqual(
        seenOutcome.sanitizedSeen,
        1,
        "queue-only Facebook group sends must remove bundled Seen metadata without dropping the send",
    );
    assert.notStrictEqual(seenOutcome.post.message, seenMessage);
    assert.strictEqual(seenOutcome.post.message.tasks.length, 1);
    assert.strictEqual(seenOutcome.post.message.tasks[0].label, "46");
    assert.strictEqual(
        seenOutcome.post.message.tasks[0].queue_name,
        "redacted-group-thread",
    );
    assert.strictEqual(seenOutcome.post.message.tasks[0].task_id, 416);
    assert.strictEqual(
        seenOutcome.post.message.tasks[0].should_send_read_receipt,
        false,
    );
    assert.strictEqual(
        seenOutcome.post.message.tasks[0].last_read_watermark_ts,
        SAFE_READ_WATERMARK,
    );
    assert.strictEqual(
        seenOutcome.post.message.tasks[0].readReceiptMutation,
        null,
    );
    const sanitizedWorkerPayloadSource =
        seenOutcome.post.message.tasks[0].payload;
    assert.match(
        sanitizedWorkerPayloadSource,
        new RegExp(`"thread_id":${workerThreadId}(?:,|})`),
    );
    assert.doesNotMatch(
        sanitizedWorkerPayloadSource,
        /"thread_id":7466158453245588000(?:,|})/,
    );
    const sanitizedSendPayload = JSON.parse(sanitizedWorkerPayloadSource);
    assert.strictEqual(sanitizedSendPayload.message.text, "group message");
    assert.strictEqual(
        sanitizedSendPayload.message.metadata.should_send_read_receipt,
        false,
    );
    assert.strictEqual(
        sanitizedSendPayload.message.metadata.last_read_watermark_ts,
        SAFE_READ_WATERMARK,
    );
    assert.strictEqual(
        sanitizedSendPayload.offline_threading_id,
        "redacted-offline-id",
    );
    assert.strictEqual(sanitizedSendPayload.send_type, "1");
    assert.strictEqual(sanitizedSendPayload.should_send_read_receipt, false);
    assert.strictEqual(
        sanitizedSendPayload.last_read_watermark_ts,
        SAFE_READ_WATERMARK,
    );
    assert.strictEqual(seenMessage.tasks[0].should_send_read_receipt, true);
    assert.strictEqual(
        seenMessage.tasks[0].last_read_watermark_ts,
        1779530000000,
    );
    assert.strictEqual(seenMessage.tasks[0].payload, workerPayload);

    const portContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const portSeenOutcome = portOutcome(portContext, seenMessage);
    assert.strictEqual(portSeenOutcome.result, "port-sent");
    assert.strictEqual(portSeenOutcome.postCount, 1);
    assert.strictEqual(portSeenOutcome.blocked, 0);
    assert.strictEqual(portSeenOutcome.sanitizedSeen, 1);
    const portTask = portSeenOutcome.post.message.tasks[0];
    assert.strictEqual(portTask.should_send_read_receipt, false);
    assert.strictEqual(portTask.last_read_watermark_ts, SAFE_READ_WATERMARK);
    assert.strictEqual(portTask.readReceiptMutation, null);
    assert.match(
        portTask.payload,
        new RegExp(`"thread_id":${workerThreadId}(?:,|})`),
    );
    const portPayload = JSON.parse(portTask.payload);
    assert.strictEqual(portPayload.send_type, "1");
    assert.strictEqual(portPayload.message.text, "group message");
    assert.strictEqual(portPayload.should_send_read_receipt, false);

    const seenDisabledContext = makeMessengerPatchPage(
        {
            msgSeen: false,
            msgTyping: true,
        },
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const seenDisabled = workerOutcome(seenDisabledContext, seenMessage);
    assert.strictEqual(seenDisabled.result, "worker-sent");
    assert.strictEqual(seenDisabled.postCount, 1);
    assert.strictEqual(seenDisabled.blocked, 0);
    assert.strictEqual(seenDisabled.sanitized, 0);
    assert.strictEqual(seenDisabled.sanitizedSeen, 0);
    assert.strictEqual(
        seenDisabled.post.message,
        seenMessage,
        "disabling Hide Seen must preserve the exact queue-routed send while Hide Typing remains enabled",
    );
    assert.strictEqual(seenMessage.tasks[0].should_send_read_receipt, true);
    assert.strictEqual(
        JSON.parse(seenMessage.tasks[0].payload).should_send_read_receipt,
        true,
    );
}

function testFacebookQueueOnlyGroupUserContentDoesNotTriggerPrivacyBlock() {
    const privacyLikeText =
        '{"should_send_read_receipt":true,"last_read_watermark_ts":1779530000000}';
    const message = {
        issue_new_task: true,
        tasks: [
            {
                label: "46",
                queue_name: "redacted-group-thread",
                task_id: 417,
                payload: JSON.stringify({
                    offline_threading_id: "redacted-offline-id",
                    send_type: 1,
                    message: { text: privacyLikeText },
                    sync_group: 104,
                }),
            },
        ],
    };
    const page = {
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatOpen: true,
    };

    const worker = workerOutcome(makeMessengerPatchPage({}, page), message);
    assert.strictEqual(worker.result, "worker-sent");
    assert.strictEqual(worker.postCount, 1);
    assert.strictEqual(worker.blocked, 0);
    assert.strictEqual(worker.post.message, message);
    assert.strictEqual(
        JSON.parse(worker.post.message.tasks[0].payload).message.text,
        privacyLikeText,
    );

    const port = portOutcome(makeMessengerPatchPage({}, page), message);
    assert.strictEqual(port.result, "port-sent");
    assert.strictEqual(port.postCount, 1);
    assert.strictEqual(port.blocked, 0);
    assert.strictEqual(port.post.message, message);
    assert.strictEqual(
        JSON.parse(port.post.message.tasks[0].payload).message.text,
        privacyLikeText,
    );
}

function testFacebookQueueOnlyPrivacyTasksAreNotClassifiedAsSends() {
    const typingContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const typingTask = {
        issue_new_task: true,
        tasks: [
            {
                label: "sendChatStateFromComposer",
                queue_name: "redacted-group-thread",
                task_id: 417,
                payload: JSON.stringify({
                    offline_threading_id: "redacted-offline-id",
                    send_type: "typing",
                    message: { text: "incidental metadata" },
                    chatstate: "typing_indicator",
                }),
            },
        ],
    };
    const typingOutcome = workerOutcome(typingContext, typingTask);

    assert.strictEqual(typingOutcome.result, undefined);
    assert.strictEqual(typingOutcome.postCount, 0);
    assert.strictEqual(typingOutcome.blocked, 1);

    const seenContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const seenTask = {
        issue_new_task: true,
        tasks: [
            {
                label: "markThreadAsRead",
                queue_name: "redacted-group-thread",
                task_id: 418,
                payload: JSON.stringify({
                    offline_threading_id: "redacted-offline-id",
                    send_type: 1,
                    message: { text: "incidental metadata" },
                    last_read_watermark_ts: 1779530000000,
                    should_send_read_receipt: true,
                }),
            },
        ],
    };
    const seenOutcome = workerOutcome(seenContext, seenTask);

    assert.strictEqual(seenOutcome.result, undefined);
    assert.strictEqual(seenOutcome.postCount, 0);
    assert.strictEqual(seenOutcome.blocked, 1);
}

function testFacebookQueueOnlyGroupSendWithSeenMetadataIsAllowedOnRealtimeWebSocket() {
    const epochId = "7466158453245588002";
    const makeSendTask = (payloadOverrides = {}, taskOverrides = {}) => ({
        failure_count: null,
        label: "46",
        payload: JSON.stringify({
            offline_threading_id: "redacted-offline-id",
            send_type: 1,
            message: { text: "group message" },
            sync_group: 104,
            last_read_watermark_ts: 1779530000000,
            should_send_read_receipt: true,
            ...payloadOverrides,
        }),
        queue_name: "redacted-group-thread",
        task_id: 419,
        ...taskOverrides,
    });
    const makeFrame = (prefix, tasks = [makeSendTask()]) => {
        const inner = JSON.stringify({
            epoch_id: "__GHOSTIFY_EPOCH_ID__",
            tasks,
            version_id: "27029912679952307",
        }).replace('"__GHOSTIFY_EPOCH_ID__"', epochId);
        return new Uint8Array(
            Buffer.from(
                `${prefix}${JSON.stringify({
                    app_id: "2220391788200892",
                    payload: inner,
                    request_id: 183,
                    type: 3,
                })}`,
                "utf8",
            ),
        );
    };
    const cases = [
        {
            label: "Facebook top frame edge-chat Uint8Array",
            page: {
                hostname: "www.facebook.com",
                pathname: "/",
                href: "https://www.facebook.com/",
            },
            url: "wss://edge-chat.facebook.com/chat?region=redacted",
            prefix: "{}\r\u0000",
            asArrayBuffer: false,
        },
        {
            label: "Facebook top frame lightspeed ArrayBuffer",
            page: {
                hostname: "www.facebook.com",
                pathname: "/",
                href: "https://www.facebook.com/",
            },
            url: "wss://gateway.facebook.com/ws/lightspeed",
            prefix: facebookFramePrefix,
            asArrayBuffer: true,
        },
        {
            label: "Facebook MAW proxy edge-chat Uint8Array",
            page: {
                hostname: "www.fbsbx.com",
                pathname: "/maw_proxy_page/",
                href: "https://www.fbsbx.com/maw_proxy_page/",
            },
            url: "wss://edge-chat.facebook.com/chat?region=redacted",
            prefix: facebookFramePrefix,
            asArrayBuffer: false,
        },
        {
            label: "Facebook MAW proxy lightspeed ArrayBuffer",
            page: {
                hostname: "www.fbsbx.com",
                pathname: "/maw_proxy_page/",
                href: "https://www.fbsbx.com/maw_proxy_page/",
            },
            url: "wss://gateway.facebook.com/ws/lightspeed",
            prefix: "{}\r\u0000",
            asArrayBuffer: true,
        },
    ];

    for (const testCase of cases) {
        const window = makeGhostPage(testCase.page);
        const frameBytes = makeFrame(testCase.prefix);
        const originalBytes = Array.from(frameBytes);
        const frame = testCase.asArrayBuffer
            ? frameBytes.buffer.slice(
                  frameBytes.byteOffset,
                  frameBytes.byteOffset + frameBytes.byteLength,
              )
            : frameBytes;
        const expectedTag = testCase.asArrayBuffer
            ? "[object ArrayBuffer]"
            : "[object Uint8Array]";
        const outcome = websocketSend(window, frame, testCase.url);

        assert.strictEqual(
            outcome.result,
            "sent",
            `${testCase.label} must leave Sending`,
        );
        assert.strictEqual(
            outcome.socket.sent.length,
            1,
            `${testCase.label} must send exactly once`,
        );
        assert.deepStrictEqual(
            Array.from(testCase.asArrayBuffer ? new Uint8Array(frame) : frame),
            originalBytes,
            `${testCase.label} must not mutate the original frame`,
        );

        const forwarded = outcome.socket.sent[0];
        assert.strictEqual(
            Object.prototype.toString.call(forwarded),
            expectedTag,
        );
        const { outer, inner } = decodeFacebookFramedTasks(
            forwarded,
            testCase.prefix,
        );
        assert.strictEqual(outer.app_id, "2220391788200892");
        assert.strictEqual(outer.request_id, 183);
        assert.strictEqual(outer.type, 3);
        assert.match(outer.payload, new RegExp(`"epoch_id":${epochId}(?:,|})`));
        assert.strictEqual(inner.version_id, "27029912679952307");
        assert.strictEqual(inner.tasks.length, 1);

        const task = inner.tasks[0];
        assert.strictEqual(task.label, "46");
        assert.strictEqual(task.queue_name, "redacted-group-thread");
        assert.strictEqual(task.task_id, 419);
        const payload = JSON.parse(task.payload);
        assert.strictEqual(payload.offline_threading_id, "redacted-offline-id");
        assert.strictEqual(payload.send_type, 1);
        assert.deepStrictEqual(payload.message, { text: "group message" });
        assert.strictEqual(payload.sync_group, 104);
        assert.strictEqual(payload.should_send_read_receipt, false);
        assert.strictEqual(payload.last_read_watermark_ts, SAFE_READ_WATERMARK);
    }

    const privacyLikeUserText =
        '{"should_send_read_receipt":true,"last_read_watermark_ts":1779530000000}';
    const userTextWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    const userText = websocketSend(
        userTextWindow,
        makeFrame("{}\r\u0000", [
            makeSendTask({ message: { text: privacyLikeUserText } }),
        ]),
        "wss://edge-chat.facebook.com/chat?region=redacted",
    );
    assert.strictEqual(userText.result, "sent");
    const userTextDecoded = decodeFacebookFramedTasks(
        userText.socket.sent[0],
        "{}\r\u0000",
    );
    const userTextPayload = JSON.parse(userTextDecoded.inner.tasks[0].payload);
    assert.strictEqual(userTextPayload.message.text, privacyLikeUserText);
    assert.strictEqual(userTextPayload.should_send_read_receipt, false);
    assert.strictEqual(
        userTextPayload.last_read_watermark_ts,
        SAFE_READ_WATERMARK,
    );

    const threadId = "7466158453245588003";
    const payloadWithLargeThreadId = JSON.stringify({
        thread_id: "__GHOSTIFY_THREAD_ID__",
        offline_threading_id: "redacted-offline-id",
        send_type: 1,
        message: { text: "group message" },
        sync_group: 104,
        last_read_watermark_ts: 1779530000000,
        should_send_read_receipt: true,
    }).replace('"__GHOSTIFY_THREAD_ID__"', threadId);
    const largeIdWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    const largeId = websocketSend(
        largeIdWindow,
        makeFrame("{}\r\u0000", [
            makeSendTask({}, { payload: payloadWithLargeThreadId }),
        ]),
        "wss://edge-chat.facebook.com/chat?region=redacted",
    );
    assert.strictEqual(largeId.result, "sent");
    const largeIdDecoded = decodeFacebookFramedTasks(
        largeId.socket.sent[0],
        "{}\r\u0000",
    );
    const forwardedPayloadSource = largeIdDecoded.inner.tasks[0].payload;
    assert.match(
        forwardedPayloadSource,
        new RegExp(`"thread_id":${threadId}(?:,|})`),
    );
    assert.doesNotMatch(
        forwardedPayloadSource,
        /"thread_id":7466158453245588000(?:,|})/,
    );
    const largeIdPayload = JSON.parse(forwardedPayloadSource);
    assert.strictEqual(largeIdPayload.should_send_read_receipt, false);
    assert.strictEqual(
        largeIdPayload.last_read_watermark_ts,
        SAFE_READ_WATERMARK,
    );

    const directWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    const direct = websocketSend(
        directWindow,
        makeFrame("{}\r\u0000", [
            makeSendTask({
                other_user_id: "redacted-user",
                message: {
                    text: "direct message",
                    metadata: {
                        should_send_read_receipt: true,
                        last_read_watermark_ts: 1779530000000,
                    },
                },
                sync_group: 104,
            }),
        ]),
        "wss://edge-chat.facebook.com/chat?region=redacted",
    );
    assert.strictEqual(direct.result, "sent");
    assert.strictEqual(direct.socket.sent.length, 1);
    const directDecoded = decodeFacebookFramedTasks(
        direct.socket.sent[0],
        "{}\r\u0000",
    );
    const directPayload = JSON.parse(directDecoded.inner.tasks[0].payload);
    assert.strictEqual(directPayload.other_user_id, "redacted-user");
    assert.strictEqual(directPayload.message.text, "direct message");
    assert.strictEqual(
        directPayload.message.metadata.should_send_read_receipt,
        false,
    );
    assert.strictEqual(
        directPayload.message.metadata.last_read_watermark_ts,
        SAFE_READ_WATERMARK,
    );
    assert.strictEqual(directPayload.should_send_read_receipt, false);
    assert.strictEqual(
        directPayload.last_read_watermark_ts,
        SAFE_READ_WATERMARK,
    );

    const taskMetadataWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    const taskMetadata = websocketSend(
        taskMetadataWindow,
        makeFrame("{}\r\u0000", [
            makeSendTask(
                { send_type: "1" },
                {
                    should_send_read_receipt: true,
                    last_read_watermark_ts: 1779530000000,
                    readReceiptMutation: { should_send_read_receipt: true },
                },
            ),
        ]),
        "wss://edge-chat.facebook.com/chat?region=redacted",
    );
    assert.strictEqual(taskMetadata.result, "sent");
    assert.strictEqual(taskMetadata.socket.sent.length, 1);
    const taskMetadataDecoded = decodeFacebookFramedTasks(
        taskMetadata.socket.sent[0],
        "{}\r\u0000",
    );
    const sanitizedTask = taskMetadataDecoded.inner.tasks[0];
    assert.strictEqual(sanitizedTask.label, "46");
    assert.strictEqual(sanitizedTask.queue_name, "redacted-group-thread");
    assert.strictEqual(sanitizedTask.task_id, 419);
    assert.strictEqual(sanitizedTask.should_send_read_receipt, false);
    assert.strictEqual(
        sanitizedTask.last_read_watermark_ts,
        SAFE_READ_WATERMARK,
    );
    assert.strictEqual(sanitizedTask.readReceiptMutation, null);
    const taskMetadataPayload = JSON.parse(sanitizedTask.payload);
    assert.strictEqual(taskMetadataPayload.send_type, "1");
    assert.strictEqual(taskMetadataPayload.message.text, "group message");

    const invalidCases = [
        {
            label: "missing queue_name",
            task: (() => {
                const task = makeSendTask();
                delete task.queue_name;
                return task;
            })(),
        },
        {
            label: "missing client message id",
            task: makeSendTask({ offline_threading_id: undefined }),
        },
        {
            label: "missing message payload",
            task: makeSendTask({ message: undefined }),
        },
        {
            label: "read command with misleading send fields",
            task: makeSendTask({}, { label: "markThreadAsRead" }),
        },
    ];

    for (const invalidCase of invalidCases) {
        const window = makeGhostPage({
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        });
        const outcome = websocketSend(
            window,
            makeFrame("{}\r\u0000", [invalidCase.task]),
            "wss://edge-chat.facebook.com/chat?region=redacted",
        );
        assert.strictEqual(
            outcome.result,
            undefined,
            `${invalidCase.label} must not receive the send exemption`,
        );
        assert.strictEqual(outcome.socket.sent.length, 0);
    }

    const mixedWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    const mixedFrame = makeFrame(facebookFramePrefix, [
        makeSendTask(),
        {
            label: "21",
            payload: JSON.stringify({
                thread_id: "redacted-group-thread",
                last_read_watermark_ts: 1779530000000,
                sync_group: 104,
            }),
            queue_name: "redacted-group-thread",
            task_id: 420,
        },
    ]);
    const mixed = websocketSend(
        mixedWindow,
        mixedFrame,
        "wss://edge-chat.facebook.com/chat?region=redacted",
    );
    assert.strictEqual(mixed.result, "sent");
    assert.strictEqual(mixed.socket.sent.length, 1);
    const mixedDecoded = decodeFacebookFramedTasks(
        mixed.socket.sent[0],
        facebookFramePrefix,
    );
    assert.deepStrictEqual(
        mixedDecoded.inner.tasks.map((task) => task.label),
        ["46"],
    );
    const mixedPayload = JSON.parse(mixedDecoded.inner.tasks[0].payload);
    assert.strictEqual(mixedPayload.should_send_read_receipt, false);
    assert.strictEqual(
        mixedPayload.last_read_watermark_ts,
        SAFE_READ_WATERMARK,
    );

    const disabledWindow = makeGhostPage(
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
        { msgSeen: false, msgTyping: true },
    );
    const disabledFrame = makeFrame("{}\r\u0000");
    const disabled = websocketSend(
        disabledWindow,
        disabledFrame,
        "wss://edge-chat.facebook.com/chat?region=redacted",
    );
    assert.strictEqual(disabled.result, "sent");
    assert.strictEqual(disabled.socket.sent[0], disabledFrame);
    const disabledDecoded = decodeFacebookFramedTasks(
        disabled.socket.sent[0],
        "{}\r\u0000",
    );
    const disabledPayload = JSON.parse(disabledDecoded.inner.tasks[0].payload);
    assert.strictEqual(disabledPayload.should_send_read_receipt, true);
    assert.strictEqual(disabledPayload.last_read_watermark_ts, 1779530000000);

    const malformedWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    const completeMalformedSource = makeFrame("{}\r\u0000");
    const malformedFrame = completeMalformedSource.slice(
        0,
        completeMalformedSource.byteLength - 1,
    );
    const malformedOriginal = Array.from(malformedFrame);
    const malformed = websocketSend(
        malformedWindow,
        malformedFrame,
        "wss://edge-chat.facebook.com/chat?region=redacted",
    );
    assert.strictEqual(
        malformed.result,
        undefined,
        "truncated queue-send frames with Seen metadata must fail closed",
    );
    assert.strictEqual(malformed.socket.sent.length, 0);
    assert.deepStrictEqual(Array.from(malformedFrame), malformedOriginal);
}

async function testFacebookSecureEncryptedDirectRecipientSendsAreAllowed() {
    const facebookWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    const variables = encodeURIComponent(
        JSON.stringify({
            input: {
                other_user_id: "redacted-user",
                otid: "redacted-otid",
                send_type: 1,
                encrypted_message: "redacted-ciphertext",
                should_send_read_receipt: true,
                last_read_watermark_ts: 1780070888819,
            },
        }),
    );
    const graphQlSend = `fb_api_req_friendly_name=MessengerSendMessageMutation&variables=${variables}`;

    assert.strictEqual(
        await fetchOutcomeAt(facebookWindow, "/api/graphql/", graphQlSend),
        "allowed",
        "Facebook encrypted direct-recipient GraphQL sends must not be replaced as read receipts",
    );

    const miniChatContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const bridgeSend = {
        issue_new_task: true,
        tasks: [
            {
                label: "46",
                queue_name: "redacted-user",
                payload: JSON.stringify({
                    other_user_id: "redacted-user",
                    offline_threading_id: "redacted-otid",
                    send_type: 1,
                    encrypted_message: "redacted-ciphertext",
                }),
            },
            {
                label: "sendChatStateFromComposer",
                payload: JSON.stringify({
                    other_user_id: "redacted-user",
                    chatstate: "typing_indicator",
                    send_type: "typing",
                }),
            },
        ],
    };
    const outcome = workerOutcome(miniChatContext, bridgeSend);

    assert.strictEqual(
        outcome.result,
        "worker-sent",
        "Facebook encrypted direct-recipient bridge sends bundled with typing must preserve the send task",
    );
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);
    assert.strictEqual(outcome.sanitized, 1);
    const forwarded = parseForwardedMessage(outcome.post);
    assert.strictEqual(forwarded.tasks.length, 1);
    assert.strictEqual(forwarded.tasks[0].label, "46");
    assert.strictEqual(
        JSON.parse(forwarded.tasks[0].payload).encrypted_message,
        "redacted-ciphertext",
    );
}

function testMessengerPatchMixedSendReadStringBatchPreservesSend() {
    const context = makeMessengerPatchPage();
    const outcome = workerOutcome(context, messengerBatchedSendWithReadReceipt);

    assert.strictEqual(outcome.result, "worker-sent");
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);

    const forwarded = parseForwardedMessage(outcome.post);
    assert.strictEqual(forwarded.tasks.length, 1);
    assert.strictEqual(forwarded.tasks[0].label, "send_message");
}

function testMessengerPatchObjectMapBatchSanitizesPrivacyTasks() {
    const context = makeMessengerPatchPage();
    const message = {
        send: JSON.parse(messengerSendWithUserAuthoredPrivacyTerms).tasks[0],
        seen: JSON.parse(messengerReadReceipt).tasks[0],
        epoch_id: "redacted-epoch",
    };
    const outcome = workerOutcome(context, message);

    assert.strictEqual(outcome.result, "worker-sent");
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);

    const forwarded = parseForwardedMessage(outcome.post);
    assert.strictEqual(forwarded.send.label, "send_message");
    assert.strictEqual(
        forwarded.send.payload.message.text,
        "mark_read reel_seen typing_indicator delivery_receipt",
    );
    assert.strictEqual(forwarded.seen, undefined);
    assert.strictEqual(forwarded.epoch_id, "redacted-epoch");
}

function testMessengerPatchSendWithTransferIsForwarded() {
    const context = makeMessengerPatchPage();
    const transfer = [new ArrayBuffer(8)];
    const outcome = workerOutcome(
        context,
        JSON.parse(messengerSendWithReadReceiptFlag),
        transfer,
    );

    assert.strictEqual(outcome.result, "worker-sent");
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);
    assert.strictEqual(outcome.post.transfer, transfer);
}

function testMessengerPatchMixedTransferBatchesSanitizePrivacyTasks() {
    const typingContext = makeMessengerPatchPage();
    const typingTransfer = [new ArrayBuffer(8)];
    const typingOutcome = workerOutcome(
        typingContext,
        JSON.parse(messengerBatchedSendWithTyping),
        typingTransfer,
    );

    assert.strictEqual(typingOutcome.result, "worker-sent");
    assert.strictEqual(typingOutcome.postCount, 1);
    assert.strictEqual(typingOutcome.blocked, 0);
    assert.strictEqual(typingOutcome.post.transfer, undefined);

    const forwardedTyping = parseForwardedMessage(typingOutcome.post);
    assert.strictEqual(forwardedTyping.tasks.length, 1);
    assert.strictEqual(forwardedTyping.tasks[0].label, "send_message");

    const seenContext = makeMessengerPatchPage();
    const seenTransfer = [new ArrayBuffer(8)];
    const seenOutcome = workerOutcome(
        seenContext,
        messengerBatchedSendWithReadReceipt,
        seenTransfer,
    );

    assert.strictEqual(seenOutcome.result, "worker-sent");
    assert.strictEqual(seenOutcome.postCount, 1);
    assert.strictEqual(seenOutcome.blocked, 0);
    assert.strictEqual(seenOutcome.post.transfer, undefined);

    const forwardedSeen = parseForwardedMessage(seenOutcome.post);
    assert.strictEqual(forwardedSeen.tasks.length, 1);
    assert.strictEqual(forwardedSeen.tasks[0].label, "send_message");
}

function testMessengerPatchReferencedSendTransferIsPreserved() {
    const context = makeMessengerPatchPage();
    const attachmentBuffer = new ArrayBuffer(8);
    const message = JSON.parse(messengerBatchedSendWithTyping);
    message.tasks[0].payload.attachment = attachmentBuffer;

    const outcome = workerOutcome(context, message, [attachmentBuffer]);

    assert.strictEqual(outcome.result, "worker-sent");
    assert.strictEqual(outcome.postCount, 1);
    assert.strictEqual(outcome.blocked, 0);
    assert.strictEqual(outcome.post.transfer.length, 1);
    assert.strictEqual(outcome.post.transfer[0], attachmentBuffer);

    const forwarded = parseForwardedMessage(outcome.post);
    assert.strictEqual(forwarded.tasks.length, 1);
    assert.strictEqual(forwarded.tasks[0].label, "send_message");
    assert.strictEqual(forwarded.tasks[0].payload.attachment, attachmentBuffer);
}

async function testFacebookJsonShapedPrivacyTextInsideRealSendsIsPreserved() {
    const userText = JSON.stringify({
        tasks: [
            {
                label: "openThreadHistory",
                cursor: "user-authored-example",
            },
            {
                label: "markThreadAsRead",
                thread_key: { thread_fbid: "user-authored-example" },
                readReceipt: true,
            },
        ],
    });
    const envelope = {
        issue_new_task: true,
        tasks: [
            {
                label: "send_message",
                queue_name: "messenger_send_message",
                payload: {
                    thread_key: { thread_fbid: "redacted-thread" },
                    send_type: 1,
                    offline_threading_id: "redacted-offline",
                    message: { text: userText },
                },
            },
        ],
    };
    const body = JSON.stringify(envelope);
    const assertTextPreserved = (value) => {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        assert.strictEqual(parsed.tasks[0].payload.message.text, userText);
    };

    const fetchWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    assert.strictEqual(await fetchOutcome(fetchWindow, body), "allowed");
    assertTextPreserved(fetchWindow.fetchCalls[0].init.body);

    const websocketWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    const websocket = websocketSend(
        websocketWindow,
        body,
        "wss://gateway.facebook.com/ws/lightspeed",
    );
    assert.strictEqual(websocket.result, "sent");
    assertTextPreserved(websocket.socket.sent[0]);

    const xhrWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    const xhr = xhrSend(xhrWindow, body);
    assert.strictEqual(xhr.result, "sent");
    assertTextPreserved(xhr.xhr.sent);

    for (const outcome of ["worker", "port"]) {
        const context = makeMessengerPatchPage(
            {},
            {
                hostname: "www.facebook.com",
                pathname: "/",
                href: "https://www.facebook.com/",
            },
        );
        const result =
            outcome === "worker"
                ? workerOutcome(context, envelope)
                : portOutcome(context, envelope);
        assert.ok(result.result, `${outcome} send envelopes must be forwarded`);
        assertTextPreserved(result.post.message);
    }
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
    testFacebookMiniChatQueueDirectSendSanitizesBundledPrivacy();
    testFacebookGroupSendWithQueueOnlyTargetPreservesSendAndRemovesTyping();
    testFacebookQueueOnlyGroupUserContentDoesNotTriggerPrivacyBlock();
    testFacebookQueueOnlyPrivacyTasksAreNotClassifiedAsSends();
    testFacebookQueueOnlyGroupSendWithSeenMetadataIsAllowedOnRealtimeWebSocket();
    await testFacebookSecureEncryptedDirectRecipientSendsAreAllowed();
    testMessengerPatchMixedSendReadStringBatchPreservesSend();
    testMessengerPatchObjectMapBatchSanitizesPrivacyTasks();
    testMessengerPatchSendWithTransferIsForwarded();
    testMessengerPatchMixedTransferBatchesSanitizePrivacyTasks();
    testMessengerPatchReferencedSendTransferIsPreserved();
    console.log(
        "Messenger and Facebook send preservation regression tests passed",
    );
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
