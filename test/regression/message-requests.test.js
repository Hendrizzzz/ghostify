const assert = require("assert");

const {
    messengerTyping,
    messengerReadReceipt,
    lsMessageRequestThreadListLoad,
    makeGhostPage,
    makeMessengerPatchPage,
    registerMessengerModule,
    fetchOutcome,
    fetchOutcomeAt,
    websocketOutcome,
    xhrSend,
    workerOutcome,
    portOutcome,
    createRequestClickTarget,
} = require("../helpers/regression-harness");

const messengerMessageRequestsQuery = `fb_api_req_friendly_name=MWMessageRequestsThreadListPaginationQuery&doc_id=redacted-doc&variables=${encodeURIComponent(
    JSON.stringify({
        folder: "message_requests",
        message_requests: true,
        thread_id: "redacted-thread",
        last_read_watermark: 1779530000000,
        cursor: "redacted-cursor",
    }),
)}`;

const lsMessageRequestLoadWithFalseReceiptFlag = JSON.stringify({
    issue_new_task: true,
    tasks: [
        {
            label: "MWMessageRequestsThreadListPaginationQuery",
            queue_name: "mwchat_fetch_thread_list",
            payload: {
                folder: "message_requests",
                thread_key: { thread_fbid: "redacted-thread" },
                should_send_read_receipt: false,
            },
        },
    ],
});

const lsPendingThreadsRequestLoad = JSON.stringify({
    issue_new_task: true,
    tasks: [
        {
            label: "MWFilteredThreadsQuery",
            queue_name: "mwchat_fetch_thread_list",
            payload: {
                folder: "pending_threads",
                thread_key: { thread_fbid: "redacted-thread" },
                cursor: "redacted-cursor",
                last_read_watermark: 1779530000000,
            },
        },
    ],
});

const lsSpamThreadsRequestLoad = JSON.stringify({
    issue_new_task: true,
    tasks: [
        {
            label: "MWSpamThreadsQuery",
            queue_name: "mwchat_fetch_thread_list",
            payload: {
                folder: "spam_threads",
                thread_key: { thread_fbid: "redacted-thread" },
                cursor: "redacted-cursor",
                should_send_read_receipt: false,
            },
        },
    ],
});

const messageRequestRoutePreloadMutationShape = `fb_api_req_friendly_name=CometMessengerMessageRequestsRoutePreloadMutation&doc_id=redacted-doc&variables=${encodeURIComponent(
    JSON.stringify({
        folder: "message_requests",
        thread_id: "redacted-thread",
        cursor: "redacted-cursor",
        last_read_watermark: 1779530000000,
        route_name: "message_requests",
    }),
)}`;

const pendingThreadsRoutePreloadMutationShape = `fb_api_req_friendly_name=CometMessengerFilteredThreadsRoutePreloadMutation&doc_id=redacted-doc&variables=${encodeURIComponent(
    JSON.stringify({
        folder: "pending_threads",
        thread_id: "redacted-thread",
        cursor: "redacted-cursor",
        last_read_watermark: 1779530000000,
        route_name: "filtered_threads",
    }),
)}`;

async function testMessageRequestsAndInboxQueriesAreAllowed() {
    const messengerWindow = makeGhostPage({
        hostname: "www.messenger.com",
        pathname: "/requests/t/redacted-thread",
        href: "https://www.messenger.com/requests/t/redacted-thread",
    });
    assert.strictEqual(
        await fetchOutcomeAt(
            messengerWindow,
            "/api/graphql/",
            messengerMessageRequestsQuery,
        ),
        "allowed",
        "Messenger message-request GraphQL queries must not be replaced with empty JSON",
    );

    const facebookWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/messages/requests",
        href: "https://www.facebook.com/messages/requests",
    });
    assert.strictEqual(
        await fetchOutcomeAt(
            facebookWindow,
            "/api/graphql/",
            messengerMessageRequestsQuery,
        ),
        "allowed",
        "Facebook message-request GraphQL queries must not be treated as read receipts",
    );

    const facebookProxyWindow = makeGhostPage({
        hostname: "www.fbsbx.com",
        pathname: "/maw_proxy_page/",
        search: "?__cci=redacted",
        href: "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted",
    });
    assert.strictEqual(
        await fetchOutcomeAt(
            facebookProxyWindow,
            "/api/graphql/",
            messengerMessageRequestsQuery,
        ),
        "allowed",
        "Facebook MAW proxy message-request GraphQL queries must not be treated as read receipts",
    );

    assert.strictEqual(
        await fetchOutcome(messengerWindow, lsMessageRequestThreadListLoad),
        "allowed",
        "Messenger.com LS message-request thread-list loads must not be treated as read receipts",
    );
    assert.strictEqual(
        websocketOutcome(messengerWindow, lsMessageRequestThreadListLoad),
        "allowed",
        "Messenger.com WebSocket message-request thread-list loads must not be dropped",
    );
    assert.strictEqual(
        xhrSend(messengerWindow, lsMessageRequestThreadListLoad).result,
        "sent",
        "Messenger.com XHR message-request thread-list loads must not be replaced with synthetic JSON",
    );

    assert.strictEqual(
        await fetchOutcome(
            messengerWindow,
            lsMessageRequestLoadWithFalseReceiptFlag,
        ),
        "allowed",
        "Messenger.com message-request loads with should_send_read_receipt=false must stay allowed",
    );
    assert.strictEqual(
        websocketOutcome(
            messengerWindow,
            lsMessageRequestLoadWithFalseReceiptFlag,
        ),
        "allowed",
        "Messenger.com WebSocket message-request loads with should_send_read_receipt=false must stay allowed",
    );

    assert.strictEqual(
        await fetchOutcomeAt(
            messengerWindow,
            "/api/graphql/",
            messageRequestRoutePreloadMutationShape,
        ),
        "allowed",
        "Messenger.com message-request route preload mutation-shaped loads must stay allowed",
    );
    assert.strictEqual(
        await fetchOutcomeAt(
            facebookWindow,
            "/api/graphql/",
            messageRequestRoutePreloadMutationShape,
        ),
        "allowed",
        "Facebook message-request route preload mutation-shaped loads must stay allowed",
    );

    assert.strictEqual(
        await fetchOutcome(messengerWindow, lsPendingThreadsRequestLoad),
        "allowed",
        "Messenger.com pending_threads request loads must not be treated as read receipts",
    );
    assert.strictEqual(
        websocketOutcome(messengerWindow, lsPendingThreadsRequestLoad),
        "allowed",
        "Messenger.com WebSocket pending_threads request loads must not be dropped",
    );
    assert.strictEqual(
        xhrSend(messengerWindow, lsPendingThreadsRequestLoad).result,
        "sent",
        "Messenger.com XHR pending_threads request loads must not be replaced with synthetic JSON",
    );
    assert.strictEqual(
        await fetchOutcome(messengerWindow, lsSpamThreadsRequestLoad),
        "allowed",
        "Messenger.com spam_threads request loads with false receipt flags must stay allowed",
    );
    assert.strictEqual(
        await fetchOutcomeAt(
            messengerWindow,
            "/api/graphql/",
            pendingThreadsRoutePreloadMutationShape,
        ),
        "allowed",
        "Messenger.com pending_threads route preload mutation-shaped loads must stay allowed",
    );
    assert.strictEqual(
        await fetchOutcomeAt(
            facebookWindow,
            "/api/graphql/",
            pendingThreadsRoutePreloadMutationShape,
        ),
        "allowed",
        "Facebook pending_threads route preload mutation-shaped loads must stay allowed",
    );

    const patchContext = makeMessengerPatchPage();
    const workerResult = workerOutcome(
        patchContext,
        JSON.parse(lsMessageRequestLoadWithFalseReceiptFlag),
    );
    assert.strictEqual(
        workerResult.result,
        "worker-sent",
        "Messenger patch worker bridge must forward message-request loads with should_send_read_receipt=false",
    );
    assert.strictEqual(workerResult.blocked, 0);
    const portResult = portOutcome(
        patchContext,
        JSON.parse(lsMessageRequestThreadListLoad),
    );
    assert.strictEqual(
        portResult.result,
        "port-sent",
        "Messenger patch MessagePort bridge must forward message-request thread-list loads",
    );
    assert.strictEqual(portResult.blocked, 0);

    const pendingWorkerResult = workerOutcome(
        patchContext,
        JSON.parse(lsPendingThreadsRequestLoad),
    );
    assert.strictEqual(
        pendingWorkerResult.result,
        "worker-sent",
        "Messenger patch worker bridge must forward pending_threads request loads",
    );
    assert.strictEqual(pendingWorkerResult.blocked, 0);
    const spamPortResult = portOutcome(
        patchContext,
        JSON.parse(lsSpamThreadsRequestLoad),
    );
    assert.strictEqual(
        spamPortResult.result,
        "port-sent",
        "Messenger patch MessagePort bridge must forward spam_threads request loads",
    );
    assert.strictEqual(spamPortResult.blocked, 0);
}

function testMessengerPatchRequestRouteModulesHydrateUntouched() {
    for (const page of [
        {
            label: "Messenger.com",
            hostname: "www.messenger.com",
            pathname: "/requests/t/redacted-thread",
            href: "https://www.messenger.com/requests/t/redacted-thread",
        },
        {
            label: "Facebook",
            hostname: "www.facebook.com",
            pathname: "/messages/requests/t/redacted-thread",
            href: "https://www.facebook.com/messages/requests/t/redacted-thread",
        },
        {
            label: "Facebook MAW proxy",
            hostname: "www.fbsbx.com",
            pathname: "/maw_proxy_page/",
            search: "?__cci=redacted",
            href: "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted",
        },
    ]) {
        const context = makeMessengerPatchPage({}, page);
        const calls = [];
        const module = registerMessengerModule(
            context,
            "LSUpdateThreadReadWatermark",
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function (payload) {
                    calls.push(payload);
                    return "request-hydrated";
                };
            },
        );
        const requestHydrationPayload = {
            folder: "pending_threads",
            thread_key: { thread_fbid: "redacted-thread" },
            last_read_watermark: 1779530000000,
            should_send_read_receipt: false,
        };

        assert.strictEqual(
            module.exports.default(requestHydrationPayload),
            "request-hydrated",
        );
        assert.strictEqual(
            calls.length,
            1,
            `${page.label} request modules must call the original hydrator`,
        );
        assert.strictEqual(
            calls[0],
            requestHydrationPayload,
            `${page.label} request modules must not receive cloned/sanitized request payloads`,
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
            0,
            `${page.label} request module hydration must not increment read-export sanitization`,
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
            0,
            `${page.label} request module hydration must not be blocked`,
        );
    }

    const normalContext = makeMessengerPatchPage();
    const blockedCalls = [];
    const readReceiptModule = registerMessengerModule(
        normalContext,
        "LSSendReadReceipt",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.sendReadReceipt = function (payload) {
                blockedCalls.push(payload);
                return "sent";
            };
        },
    );
    assert.strictEqual(
        readReceiptModule.exports.sendReadReceipt({
            thread_key: { thread_fbid: "redacted-thread" },
            sendReadReceipt: true,
        }),
        undefined,
        "normal Messenger thread read-receipt modules must still be blocked",
    );
    assert.strictEqual(blockedCalls.length, 0);
    assert.strictEqual(
        normalContext.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
        1,
    );
    assert(
        normalContext.window.__GHOSTIFY_STATUS__?.hooks?.[
            "module_interceptor.hooked"
        ],
    );
}

function testMessengerPatchLocalReadModulesStayUntouchedAfterRequestSpaNavigation() {
    for (const page of [
        {
            label: "Messenger.com",
            hostname: "www.messenger.com",
            normalPathname: "/t/redacted-thread",
            normalHref: "https://www.messenger.com/t/redacted-thread",
            requestPathname: "/requests/t/redacted-thread",
            requestHref: "https://www.messenger.com/requests/t/redacted-thread",
        },
        {
            label: "Facebook",
            hostname: "www.facebook.com",
            normalPathname: "/messages/t/redacted-thread",
            normalHref: "https://www.facebook.com/messages/t/redacted-thread",
            requestPathname: "/messages/requests/t/redacted-thread",
            requestHref:
                "https://www.facebook.com/messages/requests/t/redacted-thread",
        },
    ]) {
        const context = makeMessengerPatchPage(
            {},
            {
                hostname: page.hostname,
                pathname: page.normalPathname,
                href: page.normalHref,
            },
        );
        const calls = [];
        const module = registerMessengerModule(
            context,
            "LSUpdateThreadReadWatermark",
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function (payload) {
                    calls.push(payload);
                    return "request-hydrated";
                };
            },
        );
        const requestHydrationPayload = {
            folder: "message_requests",
            thread_key: { thread_fbid: "redacted-thread" },
            cursor: "redacted-cursor",
            sendReadReceipt: true,
            readReceiptMutation: { should_send_read_receipt: true },
        };

        assert.strictEqual(
            module.exports.default(requestHydrationPayload),
            "request-hydrated",
        );
        assert.strictEqual(
            calls.length,
            1,
            `${page.label} request hydration must pass before the URL route settles`,
        );
        assert.strictEqual(
            calls[0],
            requestHydrationPayload,
            `${page.label} request hydration payloads must stay intact before the URL route settles`,
        );

        context.window.location.pathname = page.requestPathname;
        context.window.location.href = page.requestHref;

        assert.strictEqual(
            module.exports.default(requestHydrationPayload),
            "request-hydrated",
        );
        assert.strictEqual(
            calls.length,
            2,
            `${page.label} stale local read modules must still call the original hydrator`,
        );
        assert.strictEqual(
            calls[1],
            requestHydrationPayload,
            `${page.label} stale local read modules must not sanitize request hydration after SPA navigation`,
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
            0,
            `${page.label} stale local read modules must not increment sanitization after SPA navigation`,
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
            0,
            `${page.label} stale local read modules must not block request hydration after SPA navigation`,
        );
    }
}

function testFacebookMessageRequestGraceLeavesLocalReadModulesUntouched() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
    );
    context.window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ =
        Date.now() + 15000;

    const calls = [];
    const module = registerMessengerModule(
        context,
        "LSUpdateThreadReadWatermark",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (payload) {
                calls.push(payload);
                return "request-hydrated";
            };
        },
    );
    const requestHydrationPayload = {
        folder: "message_requests",
        thread_key: { thread_fbid: "redacted-thread" },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
        cursor: "redacted-cursor",
    };

    assert.strictEqual(
        module.exports.default(requestHydrationPayload),
        "request-hydrated",
    );
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(
        calls[0],
        requestHydrationPayload,
        "Facebook message-request click grace must leave local request hydration payloads untouched before URL settles",
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
        0,
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
        0,
    );
}

function testMarkThreadAsReadModulesStayUntouchedOnRequestsAndMessengerDotCom() {
    const pages = [
        {
            label: "Facebook Message Requests",
            hostname: "www.facebook.com",
            pathname: "/messages/requests",
            href: "https://www.facebook.com/messages/requests",
        },
        {
            label: "Messenger.com",
            hostname: "www.messenger.com",
            pathname: "/t/redacted-thread",
            href: "https://www.messenger.com/t/redacted-thread",
        },
    ];

    for (const page of pages) {
        const context = makeMessengerPatchPage({}, page);
        const calls = [];
        const module = registerMessengerModule(
            context,
            "MWMarkThreadAsRead",
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.markThreadAsRead =
                    function markThreadAsRead(payload) {
                        calls.push(payload);
                        return "native-read-state-applied";
                    };
            },
        );
        const payload = {
            folder: page.hostname.includes("facebook")
                ? "message_requests"
                : "inbox",
            thread_key: { thread_fbid: "redacted-thread" },
            last_read_watermark: 1779530000000,
            should_send_read_receipt: true,
            cursor: "redacted-cursor",
        };

        assert.strictEqual(
            module.exports.markThreadAsRead(payload),
            "native-read-state-applied",
        );
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(
            calls[0],
            payload,
            `${page.label} must keep exact MarkThreadAsRead payloads on the native path`,
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
            0,
            `${page.label} must not sanitize local MarkThreadAsRead modules`,
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
            0,
        );
    }
}

function testMessengerPatchRequestRouteExplicitModulesStayProtected() {
    const requestContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.messenger.com",
            pathname: "/requests/t/redacted-thread",
            href: "https://www.messenger.com/requests/t/redacted-thread",
        },
    );
    const requestCalls = [];
    const requestRouteModule = registerMessengerModule(
        requestContext,
        "LSSendReadReceipt",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.sendReadReceipt = function (payload) {
                requestCalls.push(payload);
                return "sent";
            };
        },
    );

    assert.strictEqual(
        requestRouteModule.exports.sendReadReceipt({
            thread_key: { thread_fbid: "redacted-thread" },
            sendReadReceipt: true,
        }),
        undefined,
        "explicit read-receipt modules must still block on request routes",
    );
    assert.strictEqual(requestCalls.length, 0);
    assert.strictEqual(
        requestContext.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
        1,
    );

    requestContext.window.location.pathname = "/t/redacted-thread";
    requestContext.window.location.href =
        "https://www.messenger.com/t/redacted-thread";
    assert.strictEqual(
        requestRouteModule.exports.sendReadReceipt({
            thread_key: { thread_fbid: "redacted-thread" },
            sendReadReceipt: true,
        }),
        undefined,
        "explicit read-receipt modules first registered on request routes must stay protected after SPA navigation",
    );
    assert.strictEqual(requestCalls.length, 0);
    assert.strictEqual(
        requestContext.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
        2,
    );
    assert(
        requestContext.window.__GHOSTIFY_STATUS__?.hooks?.[
            "module_interceptor.hooked"
        ],
    );
}

async function testMessageRequestClickGraceKeepsTransportAndBridgeNative() {
    const messengerWindow = makeGhostPage({
        hostname: "www.messenger.com",
        pathname: "/t/redacted-thread",
        href: "https://www.messenger.com/t/redacted-thread",
    });
    messengerWindow.document.dispatchEvent({
        type: "pointerdown",
        target: createRequestClickTarget({
            href: "/requests/t/redacted-thread",
            label: "Requests · 3 unread",
        }),
    });

    assert.strictEqual(
        await fetchOutcome(messengerWindow, lsMessageRequestThreadListLoad),
        "allowed",
        "Messenger request-click grace must not synthesize-block request transition fetches before the SPA URL settles",
    );
    assert.strictEqual(
        websocketOutcome(messengerWindow, lsMessageRequestThreadListLoad),
        "allowed",
        "Messenger request-click grace must not drop request transition WebSocket frames before the SPA URL settles",
    );
    assert.strictEqual(
        xhrSend(messengerWindow, lsMessageRequestThreadListLoad).result,
        "sent",
        "Messenger request-click grace must not synthesize-block request transition XHR before the SPA URL settles",
    );
    assert.strictEqual(
        await fetchOutcome(messengerWindow, messengerReadReceipt),
        "MSG_SEEN",
        "Messenger request-click grace must not allow explicit read-receipt writes",
    );
    assert.strictEqual(
        websocketOutcome(messengerWindow, messengerTyping),
        "blocked",
        "Messenger request-click grace must not allow explicit typing writes",
    );

    const facebookWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/messages/t/redacted-thread",
        href: "https://www.facebook.com/messages/t/redacted-thread",
    });
    facebookWindow.document.dispatchEvent({
        type: "click",
        target: createRequestClickTarget({
            href: "",
            label: "Message requests",
        }),
    });

    assert.strictEqual(
        await fetchOutcome(facebookWindow, lsMessageRequestThreadListLoad),
        "allowed",
        "Facebook message-request click grace must not synthesize-block request transition fetches before the SPA URL settles",
    );
    assert.strictEqual(
        await fetchOutcome(facebookWindow, messengerReadReceipt),
        "MSG_SEEN",
        "Facebook message-request click grace must not allow explicit read-receipt writes",
    );

    const patchContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.messenger.com",
            pathname: "/t/redacted-thread",
            href: "https://www.messenger.com/t/redacted-thread",
        },
    );
    patchContext.window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ =
        Date.now() + 15000;
    assert.strictEqual(
        workerOutcome(patchContext, lsMessageRequestThreadListLoad).result,
        "worker-sent",
        "Messenger request-click grace must forward bridge request-loader frames while the request loader hydrates",
    );
    assert.strictEqual(
        workerOutcome(patchContext, JSON.parse(messengerTyping)).result,
        undefined,
        "Messenger request-click grace must not forward explicit bridge typing writes",
    );
}

(async () => {
    await testMessageRequestsAndInboxQueriesAreAllowed();
    testMessengerPatchRequestRouteModulesHydrateUntouched();
    testMessengerPatchLocalReadModulesStayUntouchedAfterRequestSpaNavigation();
    testFacebookMessageRequestGraceLeavesLocalReadModulesUntouched();
    testMarkThreadAsReadModulesStayUntouchedOnRequestsAndMessengerDotCom();
    testMessengerPatchRequestRouteExplicitModulesStayProtected();
    await testMessageRequestClickGraceKeepsTransportAndBridgeNative();
    console.log("message request regression tests passed");
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
