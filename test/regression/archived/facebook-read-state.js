// Archived Facebook read-state scenarios for behavior Ghostify has since
// replaced. Most fail against the current bundles, and no runner executes them
// (the previous single-file suite never invoked them either).

const assert = require("assert");
const vm = require("vm");

const {
    SAFE_READ_WATERMARK,
    makeMessengerPatchPage,
    registerMessengerModule,
    registerMessengerModuleWithDependencies,
} = require("../../helpers/regression-harness");

const SAFE_READ_WATERMARK_STRING = String(SAFE_READ_WATERMARK);

function getLatestWorkerBootstrapSource(context) {
    const blob =
        context.createdObjectUrls[context.createdObjectUrls.length - 1]?.blob;
    assert.ok(blob, "expected a worker bootstrap blob to be created");
    return blob.parts.join("");
}

function stripModuleBootstrapImport(bootstrapSource) {
    return String(bootstrapSource || "").replace(
        /\n(?:await\s+|void\s+)?import\([\s\S]*$/,
        "\n",
    );
}

function runWorkerBootstrap(
    bootstrapSource,
    wsBody,
    wsUrl = "wss://edge-chat.facebook.com/chat?region=redacted",
) {
    const sent = [];
    const workerContext = {
        TextDecoder,
        TextEncoder,
        ArrayBuffer,
        Uint8Array,
        URLSearchParams,
        importScripts() {},
    };

    class WorkerFakeWebSocket {
        constructor(url) {
            this.url = url;
        }

        send(data) {
            sent.push({ url: this.url, data });
            return "worker-ws-sent";
        }
    }

    workerContext.self = workerContext;
    workerContext.WebSocket = WorkerFakeWebSocket;
    vm.runInNewContext(bootstrapSource, workerContext, {
        filename: "ghostify-worker-bootstrap.js",
    });
    const socket = new workerContext.WebSocket(wsUrl);
    const result = socket.send(wsBody);
    return { result, sent };
}

function testFacebookNormalThreadLocalReadModulesAreSanitized() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/messages/t/redacted-thread",
            href: "https://www.facebook.com/messages/t/redacted-thread",
        },
    );
    const calls = [];
    const module = registerMessengerModule(
        context,
        "LSUpdateThreadReadWatermark",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (payload) {
                calls.push(payload);
                return "read-updated";
            };
        },
    );
    const normalReadPayload = {
        thread_key: { thread_fbid: "redacted-thread" },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
        readReceiptMutation: { should_send_read_receipt: true },
    };

    assert.strictEqual(
        module.exports.default(normalReadPayload),
        "read-updated",
    );
    assert.strictEqual(calls.length, 1);
    assert.notStrictEqual(
        calls[0],
        normalReadPayload,
        "Facebook normal message-thread local read modules must receive a sanitized clone",
    );
    assert.strictEqual(calls[0].should_send_read_receipt, false);
    assert.strictEqual(
        calls[0].last_read_watermark,
        SAFE_READ_WATERMARK,
        "Facebook normal message-thread local read modules must receive a stale read watermark so local UI stays unread",
    );
    assert.strictEqual(calls[0].readReceiptMutation, null);
    assert.strictEqual(
        context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
        1,
        "Facebook normal message-thread local read modules must increment sanitization",
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
        0,
    );
}

function testFacebookFeedMiniChatLocalReadModulesSanitizeReadReceiptsWithoutBlockingHistoryLoading() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const calls = [];
    const module = registerMessengerModule(
        context,
        "LSUpdateThreadReadWatermark",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (payload) {
                calls.push(payload);
                return "feed-mini-chat-read-updated";
            };
        },
    );
    const normalReadPayload = {
        thread_key: { thread_fbid: "redacted-thread" },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
        readReceiptMutation: { should_send_read_receipt: true },
    };

    assert.strictEqual(
        module.exports.default(normalReadPayload),
        "feed-mini-chat-read-updated",
    );
    assert.strictEqual(calls.length, 1);
    assert.notStrictEqual(
        calls[0],
        normalReadPayload,
        "Facebook feed mini-chat local read modules must receive a sanitized clone while still calling the hydrator",
    );
    assert.deepStrictEqual(calls[0].thread_key, normalReadPayload.thread_key);
    assert.strictEqual(
        calls[0].last_read_watermark,
        SAFE_READ_WATERMARK,
        "Facebook feed mini-chat local read modules must receive a stale read watermark so the real unread UI remains",
    );
    assert.strictEqual(calls[0].should_send_read_receipt, false);
    assert.strictEqual(calls[0].readReceiptMutation, null);
    assert.strictEqual(
        context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
        1,
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
        0,
    );
}

function testFacebookFeedMiniChatStaleLocalReadModulesSanitizeReadReceiptsWithoutBlockingHistoryLoading() {
    const page = {
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatOpen: false,
    };
    const context = makeMessengerPatchPage({}, page);
    const calls = [];
    const module = registerMessengerModule(
        context,
        "LSUpdateThreadReadWatermark",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (payload) {
                calls.push(payload);
                return "feed-mini-chat-read-updated";
            };
        },
    );
    const normalReadPayload = {
        thread_key: { thread_fbid: "redacted-thread" },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
        readReceiptMutation: { should_send_read_receipt: true },
    };

    page.facebookMiniChatOpen = true;

    assert.strictEqual(
        module.exports.default(normalReadPayload),
        "feed-mini-chat-read-updated",
    );
    assert.strictEqual(calls.length, 1);
    assert.notStrictEqual(
        calls[0],
        normalReadPayload,
        "Facebook feed mini-chat stale local read modules must receive a sanitized clone after the chat opens",
    );
    assert.deepStrictEqual(calls[0].thread_key, normalReadPayload.thread_key);
    assert.strictEqual(
        calls[0].last_read_watermark,
        SAFE_READ_WATERMARK,
        "Facebook feed mini-chat stale local read modules must receive a stale read watermark so the real unread UI remains",
    );
    assert.strictEqual(calls[0].should_send_read_receipt, false);
    assert.strictEqual(calls[0].readReceiptMutation, null);
    assert.strictEqual(
        context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
        1,
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
        0,
    );
}

function testFacebookExactMarkThreadAsReadModulesSuppressLocalMutation() {
    for (const moduleName of [
        "LSMarkThreadAsRead",
        "MWMarkThreadAsRead",
        "MarkThreadAsRead",
    ]) {
        for (const exportName of ["default", "markThreadAsRead"]) {
            const context = makeMessengerPatchPage(
                {},
                {
                    hostname: "www.facebook.com",
                    pathname: "/",
                    href: "https://www.facebook.com/",
                    facebookMiniChatOpen: true,
                },
            );
            const calls = [];
            const state = { unread: true };
            const module = registerMessengerModule(
                context,
                moduleName,
                function (_a, _b, _c, _d, moduleObject) {
                    moduleObject.exports[exportName] =
                        function markThreadAsRead(payload) {
                            calls.push(payload);
                            state.unread = false;
                            return "mark-thread-as-read-updated";
                        };
                },
            );
            const readPayload = {
                thread_key: { thread_fbid: "redacted-thread" },
                last_read_watermark: 1779530000000,
                should_send_read_receipt: true,
                readReceiptMutation: { should_send_read_receipt: true },
            };

            assert.strictEqual(
                module.exports[exportName](readPayload),
                undefined,
                `${moduleName}.${exportName} must return a neutral value when its local read mutation is suppressed`,
            );
            assert.strictEqual(
                calls.length,
                0,
                `${moduleName}.${exportName} must not execute its local read mutation`,
            );
            assert.strictEqual(
                state.unread,
                true,
                `${moduleName}.${exportName} must preserve modeled unread UI state`,
            );
            assert.strictEqual(readPayload.last_read_watermark, 1779530000000);
            assert.strictEqual(
                context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
                0,
            );
            assert.strictEqual(
                context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
                1,
            );
        }
    }
}

function testFacebookExactMarkThreadAsReadDependencyIsSuppressedWithoutBreakingOpen() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const calls = [];
    let historyHydrations = 0;
    const dependencyExports = {
        LSMarkThreadAsRead: {
            markThreadAsRead(payload) {
                calls.push(payload);
                return "dependency-mark-thread-as-read-updated";
            },
        },
    };
    const module = registerMessengerModuleWithDependencies(
        context,
        "CometChatOpenHandler",
        ["LSMarkThreadAsRead"],
        dependencyExports,
        function (_a, require, _c, _d, moduleObject) {
            const readState = require("LSMarkThreadAsRead");
            moduleObject.exports.openThread = (payload) => {
                readState.markThreadAsRead(payload);
                historyHydrations += 1;
                return "thread-opened";
            };
        },
    );
    const readPayload = {
        thread_key: { thread_fbid: "redacted-thread" },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
        readReceiptMutation: { should_send_read_receipt: true },
    };

    assert.strictEqual(module.exports.openThread(readPayload), "thread-opened");
    assert.strictEqual(
        historyHydrations,
        1,
        "thread opening and history hydration must continue after suppression",
    );
    assert.strictEqual(
        calls.length,
        0,
        "the required MarkThreadAsRead dependency must not mutate local unread state",
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
        0,
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
        1,
    );
}

async function testFacebookUseMarkThreadAsReadHookReturnsSuppressedCallback() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
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
        "useMWLSMarkThreadAsRead",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function useMWLSMarkThreadAsRead() {
                hookCalls += 1;
                return originalMarkThreadAsRead;
            };
        },
    );
    const markThreadAsRead = module.exports.default();
    const secondMarkThreadAsRead = module.exports.default();
    const readPayload = {
        thread_key: { thread_fbid: "redacted-thread" },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
    };

    assert.strictEqual(
        hookCalls,
        2,
        "the React hook itself must still execute on every render",
    );
    assert.strictEqual(
        typeof markThreadAsRead,
        "function",
        "the hook contract must remain a callback",
    );
    assert.strictEqual(
        markThreadAsRead,
        secondMarkThreadAsRead,
        "stable hook callbacks must keep stable wrapper identity",
    );
    assert.strictEqual(await markThreadAsRead(readPayload), undefined);
    assert.strictEqual(
        mutationCalls,
        0,
        "the callback returned by the hook must not mutate local unread state",
    );
    assert.strictEqual(state.unread, true);
    assert.strictEqual(
        context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
        0,
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
        1,
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_WRAPPED_MARK_THREAD_AS_READ_CALLBACKS__ || 0,
        1,
    );

    context.window.__GHOSTIFY_SETTINGS__.msgSeen = false;
    assert.strictEqual(
        markThreadAsRead(readPayload),
        readPayload,
        "disabling Hide Seen must restore native callback behavior",
    );
    assert.strictEqual(mutationCalls, 1);
}

async function testFacebookGroupReadOperationsPreserveUnreadAndPromiseContracts() {
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);
    const groupOptions = Object.freeze({
        threadType: "GROUP",
        readWatermarkTimestampMs: watermarkI64,
        shouldSendReadReceipt: true,
    });

    for (const moduleName of ["MAWMarkThreadAsRead"]) {
        const context = makeMessengerPatchPage(
            {},
            {
                hostname: moduleName.startsWith("MAW")
                    ? "www.fbsbx.com"
                    : "www.facebook.com",
                pathname: moduleName.startsWith("MAW")
                    ? "/maw_proxy_page/"
                    : "/",
                search: moduleName.startsWith("MAW") ? "?__cci=redacted" : "",
                href: moduleName.startsWith("MAW")
                    ? "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted"
                    : "https://www.facebook.com/",
                facebookMiniChatOpen: !moduleName.startsWith("MAW"),
            },
        );
        let mutationCalls = 0;
        const state = { unread: true };
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.markThreadAsReadImpl = async function (
                    ...args
                ) {
                    mutationCalls += 1;
                    state.unread = false;
                    return args;
                };
            },
        );

        const result = module.exports.markThreadAsReadImpl(
            threadKeyI64,
            watermarkI64,
            groupOptions,
        );
        assert.ok(
            result && typeof result.then === "function",
            `${moduleName} suppression must preserve thenability`,
        );
        assert.strictEqual(await result, undefined);
        assert.strictEqual(
            mutationCalls,
            0,
            `${moduleName} must not execute the local group-read mutation`,
        );
        assert.strictEqual(state.unread, true);
        assert.strictEqual(
            context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0,
            1,
        );
    }
}

function testFacebookReadWrappersUpgradeAcrossLateAliasReexports() {
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
    let mutationCalls = 0;
    const sharedLeaf = function () {
        mutationCalls += 1;
        return "mutated";
    };

    const sanitizeModule = registerMessengerModule(
        context,
        "LSUpdateThreadReadWatermark",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = sharedLeaf;
        },
    );
    const exactModule = registerMessengerModule(
        context,
        "LSMarkThreadRead",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = sanitizeModule.exports.default;
        },
    );

    assert.strictEqual(
        exactModule.exports.default(threadKeyI64, watermarkI64, 95),
        undefined,
    );
    assert.strictEqual(
        mutationCalls,
        0,
        "a late exact alias must upgrade an earlier sanitize wrapper",
    );

    const reverseContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    let reverseCalls = 0;
    const reverseLeaf = function () {
        reverseCalls += 1;
        return "mutated";
    };
    const blockModule = registerMessengerModule(
        reverseContext,
        "LSMarkThreadRead",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = reverseLeaf;
        },
    );
    const laterSanitizeModule = registerMessengerModule(
        reverseContext,
        "LSUpdateThreadReadWatermark",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = blockModule.exports.default;
        },
    );
    assert.strictEqual(
        laterSanitizeModule.exports.default(threadKeyI64, watermarkI64, 95),
        undefined,
    );
    assert.strictEqual(
        reverseCalls,
        0,
        "a late generic alias must not downgrade an exact block wrapper",
    );

    const hookContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    let hookNativeCalls = 0;
    const hookLeaf = function () {
        hookNativeCalls += 1;
        return function () {
            return Promise.resolve("native-hook-callback");
        };
    };
    const hookModule = registerMessengerModule(
        hookContext,
        "useMWLSMarkThreadAsRead",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = hookLeaf;
        },
    );
    const hookToExactModule = registerMessengerModule(
        hookContext,
        "LSMarkThreadRead",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = hookModule.exports.default;
        },
    );
    const inheritedHookResult = hookToExactModule.exports.default(
        threadKeyI64,
        watermarkI64,
        95,
    );
    assert.strictEqual(typeof inheritedHookResult, "function");
    assert.strictEqual(
        hookNativeCalls,
        1,
        "an unconfirmed alias must preserve the already-wrapped hook contract",
    );

    const positionalToCursorContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    let positionalToCursorCalls = 0;
    const positionalModule = registerMessengerModule(
        positionalToCursorContext,
        "LSUpdateThreadReadWatermark",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function () {
                positionalToCursorCalls += 1;
                return "cursor-loaded";
            };
        },
    );
    const cursorModule = registerMessengerModule(
        positionalToCursorContext,
        "LSReadWatermarkPaginationCursor",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = positionalModule.exports.default;
        },
    );
    assert.strictEqual(
        cursorModule.exports.default(threadKeyI64, watermarkI64, {
            cursor: "redacted-cursor",
            direction: "older",
        }),
        "cursor-loaded",
        "positional blocking must not spread from an allowlisted alias into a broad cursor helper re-export",
    );
    assert.strictEqual(positionalToCursorCalls, 1);
}

async function testFacebookThreadListPressUsesConsumerScopedUnreadSelector() {
    const facebookPage = {
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatOpen: true,
    };
    const selectorError = new Error("native unread selector failure");
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
        sibling: Object.freeze({ contract: "native" }),
    });
    const navigationCalls = [];
    const callback = function () {
        return "thread-opened";
    };
    let requiredSelector;
    const context = makeMessengerPatchPage({}, facebookPage);
    const module = registerMessengerModuleWithDependencies(
        context,
        "useOnPressMWThreadListItem",
        ["MWPIsThreadUnread"],
        { MWPIsThreadUnread: selectorExports },
        function (_a, require, importDefault, importAll, moduleObject) {
            const first = require("MWPIsThreadUnread");
            const second = importDefault("MWPIsThreadUnread");
            const third = importAll("MWPIsThreadUnread");
            requiredSelector = first;
            moduleObject.exports.requiredSelectors = [first, second, third];
            moduleObject.exports.openThread = function (record, returnMode) {
                const isUnread = first.isThreadUnread.call(
                    first,
                    record,
                    "preserve-args",
                );
                const payload = {
                    clientThreadKey: record.clientThreadKey,
                    isUnread,
                    threadKey: record.threadKey,
                    threadType: record.threadType,
                };
                navigationCalls.push(payload);
                if (isUnread) record.modeledLocalReadMutations += 1;
                if (returnMode === "promise") return Promise.resolve(payload);
                return callback;
            };
        },
    );

    const unreadGroup = {
        clientThreadKey: "redacted-client-thread",
        modeledLocalReadMutations: 0,
        threadKey: "redacted-group-thread",
        threadType: "GROUP",
        unread: true,
    };
    assert.strictEqual(
        module.exports.openThread(unreadGroup, "callback"),
        callback,
    );
    assert.strictEqual(
        callback(),
        "thread-opened",
        "the native navigation callback contract must remain intact",
    );
    assert.strictEqual(
        navigationCalls[0].isUnread,
        false,
        "only the OnPress navigation descriptor must see unread=false",
    );
    assert.strictEqual(
        unreadGroup.modeledLocalReadMutations,
        0,
        "the modeled local read transition must not run",
    );
    assert.strictEqual(
        selectorCalls.length,
        1,
        "the native selector must still run exactly once",
    );
    assert.strictEqual(
        selectorCalls[0].thisArg,
        requiredSelector,
        "the selector wrapper must preserve its received this value",
    );
    assert.strictEqual(selectorCalls[0].args[0], unreadGroup);
    assert.strictEqual(
        selectorCalls[0].args[1],
        "preserve-args",
        "the selector wrapper must preserve every argument",
    );
    assert.notStrictEqual(
        requiredSelector,
        selectorExports,
        "the OnPress consumer must receive a scoped dependency shadow",
    );
    assert.strictEqual(
        Object.getPrototypeOf(requiredSelector),
        Object.getPrototypeOf(selectorExports),
    );
    assert.strictEqual(
        requiredSelector.useIsThreadUnread,
        nativeRowHook,
        "the React row hook must remain native",
    );
    assert.strictEqual(
        requiredSelector.sibling,
        selectorExports.sibling,
        "unrelated selector exports must remain native",
    );
    assert.strictEqual(
        Object.isFrozen(selectorExports),
        true,
        "the frozen native export object must stay untouched",
    );
    assert.strictEqual(selectorExports.isThreadUnread, nativeSelector);
    assert.strictEqual(
        module.exports.requiredSelectors[0],
        module.exports.requiredSelectors[1],
    );
    assert.strictEqual(
        module.exports.requiredSelectors[1],
        module.exports.requiredSelectors[2],
        "all require forms must share one stable shadow",
    );

    const alreadyReadGroup = {
        clientThreadKey: "redacted-client-thread-2",
        modeledLocalReadMutations: 0,
        threadKey: "redacted-read-group",
        threadType: "GROUP",
        unread: false,
    };
    const asyncResult = module.exports.openThread(alreadyReadGroup, "promise");
    assert.ok(
        asyncResult && typeof asyncResult.then === "function",
        "Promise navigation must remain thenable",
    );
    assert.strictEqual(
        (await asyncResult).isUnread,
        false,
        "native false must remain false",
    );
    assert.strictEqual(alreadyReadGroup.modeledLocalReadMutations, 0);
    assert.strictEqual(selectorCalls.length, 2);

    assert.throws(
        () =>
            module.exports.openThread({ throwSelectorError: true }, "callback"),
        (error) => error === selectorError,
        "native selector errors must propagate without translation",
    );

    let rowRequiredSelector;
    const rowModule = registerMessengerModuleWithDependencies(
        context,
        "MWThreadListItemReact",
        ["MWPIsThreadUnread"],
        { MWPIsThreadUnread: selectorExports },
        function (_a, require, _c, _d, moduleObject) {
            rowRequiredSelector = require("MWPIsThreadUnread");
            moduleObject.exports.render = function (record) {
                return {
                    hook: rowRequiredSelector.useIsThreadUnread(
                        record.threadKey,
                    ),
                    unread: rowRequiredSelector.isThreadUnread(record),
                };
            };
        },
    );
    const renderedRow = rowModule.exports.render({
        threadKey: "redacted-group-thread",
        unread: true,
    });
    assert.notStrictEqual(
        rowRequiredSelector,
        selectorExports,
        "row rendering must receive only a consumer-scoped selector shadow",
    );
    assert.strictEqual(rowRequiredSelector.sibling, selectorExports.sibling);
    assert.strictEqual(
        selectorExports.isThreadUnread,
        nativeSelector,
        "the global native selector export must remain untouched",
    );
    assert.deepStrictEqual(renderedRow, {
        hook: "row:redacted-group-thread",
        unread: true,
    });
}

function testFacebookMessageListUsesNativeManualUnreadGuard() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const dependencyName = "useMWPMessageListOnScrollToBottom";
    const nativeHookError = new Error("native message-list hook failure");
    const nativeHookThis = Object.freeze({ contract: "native-hook-this" });
    const nativeGuardThis = Object.freeze({ contract: "native-guard-this" });
    const nativeHookCalls = [];
    const nativeGuardCalls = [];
    const nativeReturn = function (...args) {
        return { args, contract: "native-return" };
    };
    nativeReturn.cleanup = function () {
        return "native-cleanup";
    };
    const nativeGuard = function (...args) {
        nativeGuardCalls.push({ args, thisArg: this });
        return false;
    };
    const nativeHook = function (...args) {
        nativeHookCalls.push({ args, thisArg: this });
        if (args[5]?.throwHookError) throw nativeHookError;
        assert.strictEqual(args[0].call(nativeGuardThis, "guard-arg"), true);
        return nativeReturn;
    };
    let requiredHook;
    const module = registerMessengerModuleWithDependencies(
        context,
        "MWPRelayBaseMessageListReact",
        [dependencyName],
        { [dependencyName]: nativeHook },
        function (_a, require, importDefault, importAll, moduleObject) {
            const first = require(dependencyName);
            const second = importDefault(dependencyName);
            const third = importAll(dependencyName);
            requiredHook = first;
            moduleObject.exports.requiredHooks = [first, second, third];
            moduleObject.exports.render = function (
                guard,
                entryPoint,
                hasNext,
                onScrollToBottom,
                scrollAreaRef,
                thread,
            ) {
                return first.call(
                    nativeHookThis,
                    guard,
                    entryPoint,
                    hasNext,
                    onScrollToBottom,
                    scrollAreaRef,
                    thread,
                );
            };
        },
    );

    const entryPoint = Object.freeze({ entryPoint: "popup-chat-box" });
    const onScrollToBottom = function () {
        return "native-scroll";
    };
    const scrollAreaRef = Object.freeze({ current: null });
    const thread = Object.freeze({
        threadKey: "redacted-group-thread",
        threadType: "GROUP",
    });
    const firstResult = module.exports.render(
        nativeGuard,
        entryPoint,
        false,
        onScrollToBottom,
        scrollAreaRef,
        thread,
    );
    assert.strictEqual(
        firstResult,
        nativeReturn,
        "the native hook return must be forwarded by identity",
    );
    assert.deepStrictEqual(firstResult("return-arg"), {
        args: ["return-arg"],
        contract: "native-return",
    });
    assert.strictEqual(
        firstResult.cleanup(),
        "native-cleanup",
        "native cleanup behavior must remain intact",
    );
    assert.strictEqual(
        nativeHookCalls.length,
        1,
        "the native message-list hook must execute exactly once",
    );
    assert.strictEqual(
        nativeHookCalls[0].thisArg,
        nativeHookThis,
        "the hook shadow must preserve this",
    );
    assert.notStrictEqual(
        nativeHookCalls[0].args[0],
        nativeGuard,
        "only the native manual-unread predicate may be shadowed",
    );
    assert.strictEqual(nativeHookCalls[0].args[1], entryPoint);
    assert.strictEqual(nativeHookCalls[0].args[2], false);
    assert.strictEqual(nativeHookCalls[0].args[3], onScrollToBottom);
    assert.strictEqual(nativeHookCalls[0].args[4], scrollAreaRef);
    assert.strictEqual(
        nativeHookCalls[0].args[5],
        thread,
        "all non-predicate arguments must preserve identity",
    );
    assert.strictEqual(
        nativeGuardCalls.length,
        0,
        "active Hide Seen must use the native manual-unread branch without calling the original predicate",
    );
    assert.notStrictEqual(
        requiredHook,
        nativeHook,
        "the exact consumer must receive a scoped hook shadow",
    );
    assert.strictEqual(
        module.exports.requiredHooks[0],
        module.exports.requiredHooks[1],
    );
    assert.strictEqual(
        module.exports.requiredHooks[1],
        module.exports.requiredHooks[2],
        "all require forms must share one stable hook shadow",
    );

    assert.strictEqual(
        module.exports.render(
            nativeGuard,
            entryPoint,
            false,
            onScrollToBottom,
            scrollAreaRef,
            thread,
        ),
        nativeReturn,
    );
    assert.strictEqual(nativeHookCalls.length, 2);
    assert.strictEqual(
        nativeHookCalls[1].args[0],
        nativeHookCalls[0].args[0],
        "the predicate wrapper must keep stable identity across renders",
    );
    assert.strictEqual(nativeGuardCalls.length, 0);

    assert.throws(
        () =>
            module.exports.render(
                nativeGuard,
                entryPoint,
                false,
                onScrollToBottom,
                scrollAreaRef,
                { throwHookError: true },
            ),
        (error) => error === nativeHookError,
        "native hook errors must propagate without translation",
    );
}

function testFacebookMessageListManualUnreadGuardPreservesNativeBypasses() {
    const facebookPage = () => ({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatOpen: true,
    });
    const dependencyName = "useMWPMessageListOnScrollToBottom";
    const registerConsumer = (
        context,
        moduleName = "MWPRelayBaseMessageListReact",
        requiredName = dependencyName,
    ) => {
        const guardError = new Error("native manual-unread predicate failure");
        const guardThis = Object.freeze({ contract: "native-guard-this" });
        const guardCalls = [];
        const nativeGuard = function (...args) {
            guardCalls.push({ args, thisArg: this });
            if (args[0] === "throw") throw guardError;
            return "native-guard-result";
        };
        const nativeHook = function (guard, ...args) {
            return {
                args,
                guardResult: guard.call(
                    guardThis,
                    args[4]?.guardInput || "guard-arg",
                ),
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
                        "entry-point",
                        false,
                        "scroll-callback",
                        "scroll-ref",
                        thread,
                    );
                };
            },
        );
        return {
            context,
            guardCalls,
            guardError,
            guardThis,
            module,
            nativeGuard,
            nativeHook,
            get requiredHook() {
                return requiredHook;
            },
        };
    };
    const assertNative = (fixture, label) => {
        const before = fixture.guardCalls.length;
        const result = fixture.module.exports.render();
        assert.strictEqual(
            result.guardResult,
            "native-guard-result",
            `${label} must call the native predicate`,
        );
        assert.strictEqual(fixture.guardCalls.length, before + 1);
        assert.strictEqual(
            fixture.guardCalls[before].thisArg,
            fixture.guardThis,
            `${label} must preserve predicate this`,
        );
        assert.deepStrictEqual(
            fixture.guardCalls[before].args,
            ["guard-arg"],
            `${label} must preserve predicate arguments`,
        );
    };

    const toggled = registerConsumer(
        makeMessengerPatchPage({}, facebookPage()),
    );
    assert.strictEqual(toggled.module.exports.render().guardResult, true);
    assert.strictEqual(toggled.guardCalls.length, 0);
    toggled.context.window.postMessage({
        type: "GHOSTIFY_SETTINGS_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        settings: { msgSeen: false },
    });
    assertNative(toggled, "settings-off behavior");
    assert.throws(
        () => toggled.module.exports.render({ guardInput: "throw" }),
        (error) => error === toggled.guardError,
        "native predicate errors must propagate when the runtime bypass is active",
    );
    toggled.context.window.postMessage({
        type: "GHOSTIFY_SETTINGS_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        settings: { msgSeen: true },
    });
    assert.strictEqual(
        toggled.module.exports.render().guardResult,
        true,
        "reenabling Hide Seen must affect the existing shadow",
    );

    const killed = registerConsumer(makeMessengerPatchPage({}, facebookPage()));
    killed.context.window.postMessage({
        type: "GHOSTIFY_CONFIG_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        config: { killSwitch: ["msgSeen"] },
    });
    assertNative(killed, "kill-switched behavior");
    killed.context.window.postMessage({
        type: "GHOSTIFY_CONFIG_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        config: { killSwitch: [] },
    });
    assert.strictEqual(
        killed.module.exports.render().guardResult,
        true,
        "removing the kill switch must reactivate the existing shadow",
    );

    const request = registerConsumer(
        makeMessengerPatchPage(
            {},
            {
                ...facebookPage(),
                pathname: "/messages/requests",
                href: "https://www.facebook.com/messages/requests",
            },
        ),
    );
    assertNative(request, "Message Requests");

    const staleRequest = registerConsumer(
        makeMessengerPatchPage({}, facebookPage()),
    );
    assert.strictEqual(staleRequest.module.exports.render().guardResult, true);
    staleRequest.context.window.location.pathname = "/messages/requests";
    staleRequest.context.window.location.href =
        "https://www.facebook.com/messages/requests";
    assertNative(
        staleRequest,
        "stale wrapper after Message Requests navigation",
    );

    for (const page of [
        {
            label: "Messenger.com",
            hostname: "www.messenger.com",
            pathname: "/t/redacted-thread",
            href: "https://www.messenger.com/t/redacted-thread",
        },
    ]) {
        const fixture = registerConsumer(makeMessengerPatchPage({}, page));
        assertNative(fixture, page.label);
        assert.strictEqual(
            fixture.requiredHook,
            fixture.nativeHook,
            `${page.label} must retain the native dependency`,
        );
    }

    const childContext = makeMessengerPatchPage({}, facebookPage());
    childContext.window.top = {};
    const child = registerConsumer(childContext);
    assertNative(child, "Facebook child frame");
    assert.strictEqual(child.requiredHook, child.nativeHook);

    const wrongConsumer = registerConsumer(
        makeMessengerPatchPage({}, facebookPage()),
        "MWPRelayBaseMessageListReactAnalytics",
    );
    assertNative(wrongConsumer, "suffix consumer identity");
    assert.strictEqual(wrongConsumer.requiredHook, wrongConsumer.nativeHook);

    const wrongDependency = registerConsumer(
        makeMessengerPatchPage({}, facebookPage()),
        "MWPRelayBaseMessageListReact",
        "useMWPMessageListOnScrollToBottom.bs",
    );
    assertNative(wrongDependency, "suffix dependency identity");
    assert.strictEqual(
        wrongDependency.requiredHook,
        wrongDependency.nativeHook,
    );
}

function testFacebookMessageListManualUnreadGuardPreservesExportShapes() {
    const dependencyName = "useMWPMessageListOnScrollToBottom";
    const registerShape = (dependencyExports, selectHook) => {
        const context = makeMessengerPatchPage(
            {},
            {
                hostname: "www.facebook.com",
                pathname: "/",
                href: "https://www.facebook.com/",
                facebookMiniChatOpen: true,
            },
        );
        let first;
        let second;
        let third;
        const module = registerMessengerModuleWithDependencies(
            context,
            "MWPRelayBaseMessageListReact",
            [dependencyName],
            { [dependencyName]: dependencyExports },
            function (_a, require, importDefault, importAll, moduleObject) {
                first = require(dependencyName);
                second = importDefault(dependencyName);
                third = importAll(dependencyName);
                moduleObject.exports.render = (guard) =>
                    selectHook(first)(
                        guard,
                        "entry-point",
                        false,
                        "scroll-callback",
                        "scroll-ref",
                        "thread",
                    );
            },
        );
        return { first, module, second, third };
    };
    const createNativeHook = (calls) =>
        function (...args) {
            calls.push({ args, thisArg: this });
            return Object.freeze({
                contract: "native-return",
                guardResult: args[0]("guard-arg"),
            });
        };
    const nativeGuard = function () {
        throw new Error("active wrapper must not call the native guard");
    };

    const directCalls = [];
    const directHook = createNativeHook(directCalls);
    const direct = registerShape(directHook, (value) => value);
    assert.deepStrictEqual(direct.module.exports.render(nativeGuard), {
        contract: "native-return",
        guardResult: true,
    });
    assert.strictEqual(directCalls.length, 1);
    assert.notStrictEqual(direct.first, directHook);
    assert.strictEqual(direct.first, direct.second);
    assert.strictEqual(
        direct.second,
        direct.third,
        "direct-function require forms must share one stable shadow",
    );

    const defaultCalls = [];
    const defaultHook = createNativeHook(defaultCalls);
    const defaultSibling = Object.freeze({
        contract: "native-default-sibling",
    });
    const defaultExports = Object.freeze({
        default: defaultHook,
        sibling: defaultSibling,
    });
    const defaultShape = registerShape(
        defaultExports,
        (value) => value.default,
    );
    assert.strictEqual(
        defaultShape.module.exports.render(nativeGuard).guardResult,
        true,
    );
    assert.notStrictEqual(defaultShape.first, defaultExports);
    assert.strictEqual(defaultShape.first, defaultShape.second);
    assert.strictEqual(defaultShape.second, defaultShape.third);
    assert.strictEqual(defaultShape.first.sibling, defaultSibling);
    assert.strictEqual(
        defaultExports.default,
        defaultHook,
        "frozen default exports must remain untouched",
    );

    const namedCalls = [];
    const namedHook = createNativeHook(namedCalls);
    const namedExports = Object.freeze({
        useMWPMessageListOnScrollToBottom: namedHook,
        sibling: "native-named-sibling",
    });
    const named = registerShape(
        namedExports,
        (value) => value.useMWPMessageListOnScrollToBottom,
    );
    assert.strictEqual(
        named.module.exports.render(nativeGuard).guardResult,
        true,
    );
    assert.strictEqual(named.first.sibling, "native-named-sibling");
    assert.strictEqual(
        namedExports.useMWPMessageListOnScrollToBottom,
        namedHook,
    );

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
            },
        },
        sibling: {
            configurable: false,
            enumerable: true,
            value: "native-accessor-sibling",
            writable: false,
        },
    });
    Object.freeze(accessorExports);
    const accessor = registerShape(accessorExports, (value) => value.default);
    assert.strictEqual(
        accessor.module.exports.render(nativeGuard).guardResult,
        true,
    );
    assert.ok(
        getterCalls >= 1,
        "the native accessor must still supply the hook",
    );
    assert.strictEqual(
        Object.getOwnPropertyDescriptor(accessor.first, "default").enumerable,
        false,
    );
    assert.strictEqual(accessor.first.sibling, "native-accessor-sibling");
    assert.strictEqual(
        accessorExports.default,
        accessorHook,
        "the frozen native accessor must remain untouched",
    );
}

function testFacebookSafelyMarkReadConsumerShadowsNativeTriggerCallback() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const dependencyName = "useMWMarkThreadAsReadWhenNewMessagesArrive";
    const nativeError = new Error("native mark-read trigger hook failure");
    const nativeThis = Object.freeze({ contract: "native-this" });
    const nativeHookCalls = [];
    const nativeReturns = [];
    let modeledLocalReadMutations = 0;
    const nativeMarkRead = function () {
        modeledLocalReadMutations += 1;
        return "native-mark-read";
    };
    const nativeTriggerHook = function (...args) {
        nativeHookCalls.push({ args, thisArg: this });
        if (args[0]?.throwNative) throw nativeError;
        const capturedMarkRead = args[1];
        capturedMarkRead("effect");
        const nativeReturn = function (...callbackArgs) {
            capturedMarkRead("returned-callback");
            return { callbackArgs, contract: "native-return" };
        };
        nativeReturn.cleanup = function () {
            return "native-cleanup";
        };
        nativeReturns.push(nativeReturn);
        return nativeReturn;
    };
    let requiredTrigger;
    const module = registerMessengerModuleWithDependencies(
        context,
        "useMWPSafelyMarkThreadAsRead",
        [dependencyName],
        { [dependencyName]: nativeTriggerHook },
        function (_a, require, _c, _d, moduleObject) {
            requiredTrigger = require(dependencyName);
            moduleObject.exports.openThread = function (
                thread,
                predicateA,
                predicateL,
            ) {
                return requiredTrigger.call(
                    nativeThis,
                    thread,
                    nativeMarkRead,
                    predicateA,
                    predicateL,
                );
            };
        },
    );

    const thread = Object.freeze({
        threadKey: "redacted-group-thread",
        threadType: "GROUP",
    });
    const predicateA = function () {
        return true;
    };
    const predicateL = function () {
        return false;
    };
    const first = module.exports.openThread(thread, predicateA, predicateL);
    assert.strictEqual(
        first,
        nativeReturns[0],
        "the native hook return must be forwarded by identity",
    );
    assert.strictEqual(
        first.cleanup(),
        "native-cleanup",
        "cleanup behavior on the native return must remain intact",
    );
    assert.deepStrictEqual(first("preserve-callback-args"), {
        callbackArgs: ["preserve-callback-args"],
        contract: "native-return",
    });
    assert.strictEqual(
        modeledLocalReadMutations,
        0,
        "neither the internal effect nor returned callback may invoke native mark-read",
    );
    assert.strictEqual(
        nativeHookCalls.length,
        1,
        "the native trigger hook must execute exactly once",
    );
    assert.strictEqual(
        nativeHookCalls[0].thisArg,
        nativeThis,
        "the dependency shadow must preserve this",
    );
    assert.strictEqual(nativeHookCalls[0].args[0], thread);
    assert.strictEqual(nativeHookCalls[0].args[2], predicateA);
    assert.strictEqual(
        nativeHookCalls[0].args[3],
        predicateL,
        "all arguments except the mark-read callback must remain exact",
    );
    assert.notStrictEqual(
        nativeHookCalls[0].args[1],
        nativeMarkRead,
        "the consumer-scoped hook must not capture native mark-read",
    );
    assert.strictEqual(
        nativeHookCalls[0].args[1]("sync-contract"),
        undefined,
        "the replacement callback must be a synchronous no-op",
    );

    const second = module.exports.openThread(thread, predicateA, predicateL);
    assert.strictEqual(second, nativeReturns[1]);
    assert.strictEqual(
        nativeHookCalls[1].args[1],
        nativeHookCalls[0].args[1],
        "the replacement callback must have stable identity across renders",
    );
    assert.strictEqual(modeledLocalReadMutations, 0);

    assert.throws(
        () =>
            module.exports.openThread(
                { throwNative: true },
                predicateA,
                predicateL,
            ),
        (error) => error === nativeError,
        "native hook errors must propagate without translation",
    );
}

function testFacebookSafelyMarkReadConsumerPreservesNativeBypasses() {
    const facebookPage = () => ({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatOpen: true,
    });
    const dependencyName = "useMWMarkThreadAsReadWhenNewMessagesArrive";
    const registerConsumer = (
        context,
        moduleName = "useMWPSafelyMarkThreadAsRead",
        requiredName = dependencyName,
    ) => {
        let modeledMutations = 0;
        const receivedMarkReads = [];
        const nativeMarkRead = function () {
            modeledMutations += 1;
        };
        const nativeTrigger = function (
            thread,
            markRead,
            predicateA,
            predicateL,
        ) {
            receivedMarkReads.push(markRead);
            markRead("effect");
            return function () {
                markRead("returned-callback");
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
                        { threadKey: "redacted-thread" },
                        nativeMarkRead,
                        "predicate-a",
                        "predicate-l",
                    );
                };
            },
        );
        return {
            get modeledMutations() {
                return modeledMutations;
            },
            module,
            nativeMarkRead,
            nativeTrigger,
            receivedMarkReads,
            requiredTrigger,
        };
    };
    const assertNative = (fixture, label) => {
        const result = fixture.module.exports.openThread();
        assert.strictEqual(
            fixture.modeledMutations,
            1,
            `${label} must keep the native internal effect`,
        );
        assert.deepStrictEqual(result(), {
            predicateA: "predicate-a",
            predicateL: "predicate-l",
            thread: { threadKey: "redacted-thread" },
        });
        assert.strictEqual(
            fixture.modeledMutations,
            2,
            `${label} must keep the native returned callback`,
        );
    };

    assertNative(
        registerConsumer(
            makeMessengerPatchPage({ msgSeen: false }, facebookPage()),
        ),
        "settings-off behavior",
    );

    const killedContext = makeMessengerPatchPage({}, facebookPage());
    const killed = registerConsumer(killedContext);
    killedContext.window.postMessage({
        type: "GHOSTIFY_CONFIG_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        config: { killSwitch: ["msgSeen"] },
    });
    assertNative(killed, "kill-switched behavior");

    const request = registerConsumer(
        makeMessengerPatchPage(
            {},
            {
                ...facebookPage(),
                pathname: "/messages/requests",
                href: "https://www.facebook.com/messages/requests",
            },
        ),
    );
    assertNative(request, "Message Requests");

    const staleContext = makeMessengerPatchPage({}, facebookPage());
    const stale = registerConsumer(staleContext);
    const blocked = stale.module.exports.openThread();
    blocked();
    assert.strictEqual(stale.modeledMutations, 0);
    staleContext.window.location.pathname = "/messages/requests";
    staleContext.window.location.href =
        "https://www.facebook.com/messages/requests";
    assertNative(stale, "stale wrapper after Message Requests navigation");

    for (const page of [
        {
            label: "Messenger.com",
            hostname: "www.messenger.com",
            pathname: "/t/redacted-thread",
            href: "https://www.messenger.com/t/redacted-thread",
        },
    ]) {
        const fixture = registerConsumer(makeMessengerPatchPage({}, page));
        assert.strictEqual(fixture.requiredTrigger, fixture.nativeTrigger);
        assertNative(fixture, page.label);
    }

    const childFrameContext = makeMessengerPatchPage({}, facebookPage());
    childFrameContext.window.top = {};
    const childFrame = registerConsumer(childFrameContext);
    childFrame.module.exports.openThread();
    assert.strictEqual(
        childFrame.modeledMutations,
        1,
        "the exact consumer shadow must not replace child-frame mark-read",
    );
    assert.strictEqual(
        childFrame.receivedMarkReads[0],
        childFrame.nativeMarkRead,
    );

    const wrongConsumer = registerConsumer(
        makeMessengerPatchPage({}, facebookPage()),
        "useMWPSafelyMarkThreadAsReadAnalytics",
    );
    wrongConsumer.module.exports.openThread();
    assert.strictEqual(
        wrongConsumer.modeledMutations,
        1,
        "the exact consumer shadow must not replace suffix-consumer mark-read",
    );
    assert.strictEqual(
        wrongConsumer.receivedMarkReads[0],
        wrongConsumer.nativeMarkRead,
    );

    const wrongDependency = registerConsumer(
        makeMessengerPatchPage({}, facebookPage()),
        "useMWPSafelyMarkThreadAsRead",
        "useMWMarkThreadAsReadWhenNewMessagesArrive.bs",
    );
    assert.strictEqual(
        wrongDependency.requiredTrigger,
        wrongDependency.nativeTrigger,
    );
    assertNative(wrongDependency, "suffix dependency identity");
}

function testFacebookSafelyMarkReadConsumerPreservesExportDescriptors() {
    const dependencyName = "useMWMarkThreadAsReadWhenNewMessagesArrive";
    const registerShape = (dependencyExports, selectHook) => {
        const context = makeMessengerPatchPage(
            {},
            {
                hostname: "www.facebook.com",
                pathname: "/",
                href: "https://www.facebook.com/",
                facebookMiniChatOpen: true,
            },
        );
        let first;
        let second;
        let third;
        let mutations = 0;
        const nativeMarkRead = function () {
            mutations += 1;
        };
        const module = registerMessengerModuleWithDependencies(
            context,
            "useMWPSafelyMarkThreadAsRead",
            [dependencyName],
            { [dependencyName]: dependencyExports },
            function (_a, require, importDefault, importAll, moduleObject) {
                first = require(dependencyName);
                second = importDefault(dependencyName);
                third = importAll(dependencyName);
                moduleObject.exports.openThread = function () {
                    return selectHook(first)(
                        { threadKey: "redacted-group" },
                        nativeMarkRead,
                        true,
                        false,
                    );
                };
            },
        );
        return {
            first,
            get mutations() {
                return mutations;
            },
            module,
            second,
            third,
        };
    };
    const createNativeHook = (calls) =>
        function (thread, markRead, predicateA, predicateL) {
            calls.push({ predicateA, predicateL, thread });
            markRead("effect");
            return function () {
                markRead("returned-callback");
                return "native-return";
            };
        };

    const directCalls = [];
    const directHook = createNativeHook(directCalls);
    const direct = registerShape(directHook, (value) => value);
    const directResult = direct.module.exports.openThread();
    assert.strictEqual(directResult(), "native-return");
    assert.strictEqual(direct.mutations, 0);
    assert.strictEqual(directCalls.length, 1);
    assert.strictEqual(direct.first, direct.second);
    assert.strictEqual(
        direct.second,
        direct.third,
        "all require forms must share the same direct-function shadow",
    );
    assert.notStrictEqual(direct.first, directHook);

    const defaultCalls = [];
    const defaultHook = createNativeHook(defaultCalls);
    const defaultExports = Object.freeze({
        default: defaultHook,
        sibling: Object.freeze({ contract: "native-default-sibling" }),
    });
    const defaultShape = registerShape(
        defaultExports,
        (value) => value.default,
    );
    const defaultResult = defaultShape.module.exports.openThread();
    assert.strictEqual(defaultResult(), "native-return");
    assert.strictEqual(defaultShape.mutations, 0);
    assert.notStrictEqual(defaultShape.first, defaultExports);
    assert.strictEqual(defaultShape.first, defaultShape.second);
    assert.strictEqual(defaultShape.second, defaultShape.third);
    assert.strictEqual(defaultShape.first.sibling, defaultExports.sibling);
    assert.strictEqual(
        defaultExports.default,
        defaultHook,
        "frozen default exports must remain untouched",
    );

    const namedCalls = [];
    const namedHook = createNativeHook(namedCalls);
    const namedExports = Object.freeze({
        useMWMarkThreadAsReadWhenNewMessagesArrive: namedHook,
        sibling: "native-named-sibling",
    });
    const named = registerShape(
        namedExports,
        (value) => value.useMWMarkThreadAsReadWhenNewMessagesArrive,
    );
    const namedResult = named.module.exports.openThread();
    assert.strictEqual(namedResult(), "native-return");
    assert.strictEqual(named.mutations, 0);
    assert.strictEqual(named.first.sibling, "native-named-sibling");
    assert.strictEqual(
        namedExports.useMWMarkThreadAsReadWhenNewMessagesArrive,
        namedHook,
    );

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
            },
        },
        sibling: {
            configurable: false,
            enumerable: true,
            value: "native-accessor-sibling",
            writable: false,
        },
    });
    Object.freeze(accessorExports);
    const accessor = registerShape(accessorExports, (value) => value.default);
    const accessorResult = accessor.module.exports.openThread();
    assert.strictEqual(accessorResult(), "native-return");
    assert.strictEqual(accessor.mutations, 0);
    assert.ok(
        getterCalls >= 1,
        "the native accessor must still supply the trigger hook",
    );
    assert.strictEqual(
        Object.getOwnPropertyDescriptor(accessor.first, "default").enumerable,
        false,
    );
    assert.strictEqual(accessor.first.sibling, "native-accessor-sibling");
    assert.strictEqual(
        accessorExports.default,
        accessorHook,
        "the frozen native accessor must remain untouched",
    );
}

function testFacebookThreadListPressUnreadSelectorPreservesNativeBypasses() {
    const makePage = () => ({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatOpen: true,
    });
    const registerSelectorConsumer = (
        context,
        moduleName = "useOnPressMWThreadListItem",
        dependencyName = "MWPIsThreadUnread",
    ) => {
        const selectorExports = {
            isThreadUnread() {
                return true;
            },
            useIsThreadUnread() {
                return true;
            },
        };
        let requiredSelector;
        const module = registerMessengerModuleWithDependencies(
            context,
            moduleName,
            [dependencyName],
            { [dependencyName]: selectorExports },
            function (_a, require, _c, _d, moduleObject) {
                requiredSelector = require(dependencyName);
                moduleObject.exports.openThread = (record) =>
                    requiredSelector.isThreadUnread(record);
            },
        );
        return { module, requiredSelector, selectorExports };
    };

    const settingsOffContext = makeMessengerPatchPage(
        { msgSeen: false },
        makePage(),
    );
    const settingsOff = registerSelectorConsumer(settingsOffContext);
    assert.strictEqual(
        settingsOff.module.exports.openThread({}),
        true,
        "settings-off behavior must remain native",
    );

    const killedContext = makeMessengerPatchPage({}, makePage());
    const killed = registerSelectorConsumer(killedContext);
    killedContext.window.postMessage({
        type: "GHOSTIFY_CONFIG_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        config: { killSwitch: ["msgSeen"] },
    });
    assert.strictEqual(
        killed.module.exports.openThread({}),
        true,
        "kill-switched behavior must remain native",
    );

    const requestContext = makeMessengerPatchPage(
        {},
        {
            ...makePage(),
            pathname: "/messages/requests",
            href: "https://www.facebook.com/messages/requests",
        },
    );
    const request = registerSelectorConsumer(requestContext);
    assert.strictEqual(
        request.module.exports.openThread({}),
        true,
        "Message Requests must retain native unread navigation",
    );

    const staleRouteContext = makeMessengerPatchPage({}, makePage());
    const staleRoute = registerSelectorConsumer(staleRouteContext);
    assert.strictEqual(staleRoute.module.exports.openThread({}), false);
    staleRouteContext.window.location.pathname = "/messages/requests";
    staleRouteContext.window.location.href =
        "https://www.facebook.com/messages/requests";
    assert.strictEqual(
        staleRoute.module.exports.openThread({}),
        true,
        "a stale wrapper must become native after request navigation",
    );

    const toggledContext = makeMessengerPatchPage({}, makePage());
    const toggled = registerSelectorConsumer(toggledContext);
    assert.strictEqual(toggled.module.exports.openThread({}), false);
    toggledContext.window.postMessage({
        type: "GHOSTIFY_SETTINGS_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        settings: { msgSeen: false },
    });
    assert.strictEqual(
        toggled.module.exports.openThread({}),
        true,
        "settings changes must affect an already-created selector shadow",
    );

    for (const page of [
        {
            label: "Messenger.com",
            hostname: "www.messenger.com",
            pathname: "/t/redacted-thread",
            href: "https://www.messenger.com/t/redacted-thread",
        },
        {
            label: "Facebook MAW proxy",
            hostname: "www.fbsbx.com",
            pathname: "/maw_proxy_page/",
            href: "https://www.fbsbx.com/maw_proxy_page/",
        },
    ]) {
        const nativeHost = registerSelectorConsumer(
            makeMessengerPatchPage({}, page),
        );
        assert.strictEqual(
            nativeHost.module.exports.openThread({}),
            true,
            `${page.label} must remain native`,
        );
        assert.strictEqual(
            nativeHost.requiredSelector,
            nativeHost.selectorExports,
        );
    }

    const childFrameContext = makeMessengerPatchPage({}, makePage());
    childFrameContext.window.top = {};
    const childFrame = registerSelectorConsumer(childFrameContext);
    assert.strictEqual(
        childFrame.module.exports.openThread({}),
        true,
        "Facebook child frames must remain native",
    );
    assert.strictEqual(childFrame.requiredSelector, childFrame.selectorExports);

    const wrongModuleContext = makeMessengerPatchPage({}, makePage());
    const wrongModule = registerSelectorConsumer(
        wrongModuleContext,
        "useOnPressMWThreadListItemAnalytics",
    );
    assert.strictEqual(
        wrongModule.module.exports.openThread({}),
        true,
        "suffix module names must not be patched",
    );
    assert.strictEqual(
        wrongModule.requiredSelector,
        wrongModule.selectorExports,
    );

    const wrongDependencyContext = makeMessengerPatchPage({}, makePage());
    const wrongDependency = registerSelectorConsumer(
        wrongDependencyContext,
        "useOnPressMWThreadListItem",
        "MWPIsThreadUnread.bs",
    );
    assert.strictEqual(
        wrongDependency.module.exports.openThread({}),
        true,
        "legacy or suffix selector aliases must remain native",
    );
    assert.strictEqual(
        wrongDependency.requiredSelector,
        wrongDependency.selectorExports,
    );
}

function testFacebookThreadListPressUnreadSelectorPreservesExportDescriptors() {
    const page = {
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatOpen: true,
    };
    const registerShape = (selectorExports) => {
        const context = makeMessengerPatchPage({}, page);
        let first;
        let second;
        const module = registerMessengerModuleWithDependencies(
            context,
            "UseOnPressMWThreadListItem",
            ["MWPIsThreadUnread"],
            { MWPIsThreadUnread: selectorExports },
            function (_a, require, importDefault, _d, moduleObject) {
                first = require("MWPIsThreadUnread");
                second = importDefault("MWPIsThreadUnread");
                moduleObject.exports.openThread = (record) =>
                    first.isThreadUnread(record);
            },
        );
        return { first, module, second };
    };

    const nullPrototypeExports = Object.assign(Object.create(null), {
        isThreadUnread() {
            return true;
        },
        useIsThreadUnread() {
            return "native-null-hook";
        },
        sibling: "native-null-sibling",
    });
    Object.freeze(nullPrototypeExports);
    const nullPrototype = registerShape(nullPrototypeExports);
    assert.strictEqual(nullPrototype.module.exports.openThread({}), false);
    assert.strictEqual(
        Object.getPrototypeOf(nullPrototype.first),
        null,
        "null-prototype selector exports must retain their prototype",
    );
    assert.strictEqual(
        nullPrototype.first,
        nullPrototype.second,
        "the null-prototype shadow must keep stable identity",
    );
    assert.strictEqual(
        nullPrototype.first.useIsThreadUnread,
        nullPrototypeExports.useIsThreadUnread,
    );
    assert.strictEqual(nullPrototype.first.sibling, "native-null-sibling");

    let getterCalls = 0;
    const accessorSelector = function () {
        return true;
    };
    const accessorExports = {};
    Object.defineProperties(accessorExports, {
        isThreadUnread: {
            configurable: false,
            enumerable: false,
            get() {
                getterCalls += 1;
                return accessorSelector;
            },
        },
        useIsThreadUnread: {
            configurable: false,
            enumerable: true,
            value: function () {
                return "native-accessor-hook";
            },
            writable: false,
        },
        sibling: {
            configurable: false,
            enumerable: false,
            value: "native-accessor-sibling",
            writable: false,
        },
    });
    Object.freeze(accessorExports);
    const accessor = registerShape(accessorExports);
    assert.strictEqual(
        accessor.module.exports.openThread({}),
        false,
        "accessor-backed selectors must be shadowed safely",
    );
    assert.ok(
        getterCalls >= 1,
        "the native accessor must still supply the selector function",
    );
    assert.strictEqual(
        Object.getOwnPropertyDescriptor(accessor.first, "isThreadUnread")
            .enumerable,
        false,
    );
    assert.strictEqual(
        accessor.first.useIsThreadUnread,
        accessorExports.useIsThreadUnread,
    );
    assert.strictEqual(accessor.first.sibling, "native-accessor-sibling");
    assert.strictEqual(
        accessorExports.isThreadUnread,
        accessorSelector,
        "the frozen native accessor must remain untouched",
    );
}

function testFacebookThreadListPressLateDefinitionsRemainScoped() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const selectorExports = Object.freeze({
        isThreadUnread() {
            return true;
        },
        useIsThreadUnread() {
            return true;
        },
    });
    const register = (moduleName) =>
        registerMessengerModuleWithDependencies(
            context,
            moduleName,
            ["MWPIsThreadUnread"],
            { MWPIsThreadUnread: selectorExports },
            function (_a, require, _c, _d, moduleObject) {
                const selector = require("MWPIsThreadUnread");
                moduleObject.exports.openThread = () =>
                    selector.isThreadUnread({ unread: true });
            },
        );

    const first = register("useOnPressMWThreadListItem");
    const second = register("UseOnPressMWThreadListItem");
    assert.strictEqual(first.exports.openThread(), false);
    assert.strictEqual(
        second.exports.openThread(),
        false,
        "a late same-identity definition must not bypass the scoped selector shadow",
    );
    assert.strictEqual(
        selectorExports.isThreadUnread(),
        true,
        "late definitions must never mutate the global selector export",
    );
}

function testFacebookPressedUnreadThreadsStayNativeUnreadInExactRowConsumers() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const keyText = (value) => {
        const key = value?.threadKey || value;
        return Array.isArray(key) ? `${key[0]}:${key[1]}` : String(key);
    };
    const unreadByKey = new Map([
        ["135791357:246802468", true],
        ["975319753:864208642", false],
        ["314159265:271828182", true],
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
    const sibling = Object.freeze({ contract: "native" });
    const selectorExports = Object.freeze({
        isThreadUnread: nativeSelector,
        useIsThreadUnread: nativeHook,
        sibling,
    });
    let pressSelector;
    const pressModule = registerMessengerModuleWithDependencies(
        context,
        "useOnPressMWThreadListItem",
        ["MWPIsThreadUnread"],
        { MWPIsThreadUnread: selectorExports },
        function (_a, require, _c, _d, moduleObject) {
            pressSelector = require("MWPIsThreadUnread");
            moduleObject.exports.open = (record) =>
                pressSelector.isThreadUnread(record);
        },
    );

    const rowSelectors = [];
    const registerRow = (moduleName) =>
        registerMessengerModuleWithDependencies(
            context,
            moduleName,
            ["MWPIsThreadUnread"],
            { MWPIsThreadUnread: selectorExports },
            function (_a, require, importDefault, importAll, moduleObject) {
                const first = require("MWPIsThreadUnread");
                const second = importDefault("MWPIsThreadUnread");
                const third = importAll("MWPIsThreadUnread");
                rowSelectors.push(first);
                moduleObject.exports.render = (threadKey, record) => ({
                    hook: first.useIsThreadUnread(threadKey),
                    selector: first.isThreadUnread(record),
                    stableRequireIdentity: first === second && second === third,
                });
            },
        );
    const rowModule = registerRow("MWThreadListItemReact");
    const addonModule = registerRow("MWThreadListItemAddonEndReact");
    const unreadKey = Object.freeze([135791357, 246802468]);
    const unreadRecord = Object.freeze({
        threadKey: unreadKey,
        threadType: "GROUP",
    });

    const unopenedKey = Object.freeze([314159265, 271828182]);
    const unopenedRecord = Object.freeze({
        threadKey: unopenedKey,
        threadType: "GROUP",
    });
    assert.deepStrictEqual(
        rowModule.exports.render(unopenedKey, unopenedRecord),
        { hook: true, selector: true, stableRequireIdentity: true },
    );
    unreadByKey.set("314159265:271828182", false);
    assert.deepStrictEqual(
        rowModule.exports.render(unopenedKey, unopenedRecord),
        { hook: false, selector: false, stableRequireIdentity: true },
        "rendering an unread row alone must not pin it; only the exact press path may create a latch",
    );

    assert.deepStrictEqual(rowModule.exports.render(unreadKey, unreadRecord), {
        hook: true,
        selector: true,
        stableRequireIdentity: true,
    });
    assert.deepStrictEqual(
        addonModule.exports.render(unreadKey, unreadRecord),
        { hook: true, selector: true, stableRequireIdentity: true },
    );
    const callsBeforePress = {
        hook: nativeHookCalls,
        selector: nativeSelectorCalls,
    };
    assert.strictEqual(
        pressModule.exports.open(unreadRecord),
        false,
        "the exact press consumer must suppress its unread navigation flag",
    );
    assert.strictEqual(
        nativeHookCalls,
        callsBeforePress.hook,
        "press handling must not call the React row hook",
    );
    assert.strictEqual(
        nativeSelectorCalls,
        callsBeforePress.selector + 1,
        "press handling must call the native selector exactly once",
    );

    unreadByKey.set("135791357:246802468", false);
    const rerenderHookCalls = nativeHookCalls;
    const rerenderSelectorCalls = nativeSelectorCalls;
    assert.deepStrictEqual(
        rowModule.exports.render(
            Object.freeze([135791357, 246802468]),
            Object.freeze({ threadKey: Object.freeze([135791357, 246802468]) }),
        ),
        { hook: true, selector: true, stableRequireIdentity: true },
        "the native row branches must stay unread after the same-tab record turns read",
    );
    assert.deepStrictEqual(
        addonModule.exports.render(
            Object.freeze([135791357, 246802468]),
            Object.freeze({ threadKey: Object.freeze([135791357, 246802468]) }),
        ),
        { hook: true, selector: true, stableRequireIdentity: true },
        "the native end-addon branch must keep the unread indicator for the same I64 key",
    );
    assert.strictEqual(
        nativeHookCalls,
        rerenderHookCalls + 2,
        "each exact renderer must still call the native hook once",
    );
    assert.strictEqual(
        nativeSelectorCalls,
        rerenderSelectorCalls + 2,
        "each exact renderer must still call the native selector once",
    );

    const initiallyReadKey = Object.freeze([975319753, 864208642]);
    const initiallyReadRecord = Object.freeze({
        threadKey: initiallyReadKey,
        threadType: "GROUP",
    });
    assert.strictEqual(
        pressModule.exports.open(initiallyReadRecord),
        false,
        "an initially read thread must remain native false",
    );
    assert.deepStrictEqual(
        rowModule.exports.render(initiallyReadKey, initiallyReadRecord),
        { hook: false, selector: false, stableRequireIdentity: true },
        "native false must not create an unread latch",
    );

    let badgeSelector;
    const badgeModule = registerMessengerModuleWithDependencies(
        context,
        "MWChatBadgeCountUpdatesReact",
        ["MWPIsThreadUnread"],
        { MWPIsThreadUnread: selectorExports },
        function (_a, require, _c, _d, moduleObject) {
            badgeSelector = require("MWPIsThreadUnread");
            moduleObject.exports.render = (record) => ({
                hook: badgeSelector.useIsThreadUnread(record.threadKey),
                selector: badgeSelector.isThreadUnread(record),
            });
        },
    );
    assert.strictEqual(
        badgeSelector,
        selectorExports,
        "non-row consumers must keep the global native selector object",
    );
    assert.deepStrictEqual(
        badgeModule.exports.render(unreadRecord),
        { hook: false, selector: false },
        "both selector exports must remain native outside the two exact row consumers",
    );
    assert.notStrictEqual(rowSelectors[0], selectorExports);
    assert.strictEqual(
        rowSelectors[0],
        rowSelectors[1],
        "the two exact row consumers must share one stable selector shadow",
    );
    assert.strictEqual(rowSelectors[0].sibling, sibling);
    assert.strictEqual(selectorExports.isThreadUnread, nativeSelector);
    assert.strictEqual(selectorExports.useIsThreadUnread, nativeHook);
    assert.strictEqual(
        Object.isFrozen(selectorExports),
        true,
        "the native frozen export object must remain untouched",
    );
}

function testFacebookUnreadRowLatchClearsAndPreservesNativeBypasses() {
    const facebookPage = {
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatOpen: true,
    };
    const createSurface = (page, configureContext) => {
        const context = makeMessengerPatchPage({}, page);
        if (configureContext) configureContext(context);
        let unread = true;
        const selectorExports = Object.freeze({
            isThreadUnread(record) {
                return unread && !!record;
            },
            useIsThreadUnread() {
                return unread;
            },
            sibling: "native",
        });
        let requiredRowSelector;
        const press = registerMessengerModuleWithDependencies(
            context,
            "useOnPressMWThreadListItem",
            ["MWPIsThreadUnread"],
            { MWPIsThreadUnread: selectorExports },
            function (_a, require, _c, _d, moduleObject) {
                const selector = require("MWPIsThreadUnread");
                moduleObject.exports.open = (record) =>
                    selector.isThreadUnread(record);
            },
        );
        const row = registerMessengerModuleWithDependencies(
            context,
            "MWThreadListItemReact",
            ["MWPIsThreadUnread"],
            { MWPIsThreadUnread: selectorExports },
            function (_a, require, _c, _d, moduleObject) {
                requiredRowSelector = require("MWPIsThreadUnread");
                moduleObject.exports.render = (record) => ({
                    hook: requiredRowSelector.useIsThreadUnread(
                        record.threadKey,
                    ),
                    selector: requiredRowSelector.isThreadUnread(record),
                });
            },
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
            get requiredRowSelector() {
                return requiredRowSelector;
            },
        };
    };

    const settings = createSurface(facebookPage);
    assert.strictEqual(settings.latch(), false);
    assert.deepStrictEqual(settings.render(), { hook: true, selector: true });
    settings.context.window.postMessage({
        type: "GHOSTIFY_SETTINGS_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        settings: { msgTyping: true, msgSeen: false },
    });
    assert.deepStrictEqual(
        settings.render(),
        { hook: false, selector: false },
        "settings off must expose native state and clear the latch",
    );
    settings.context.window.postMessage({
        type: "GHOSTIFY_SETTINGS_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        settings: { msgTyping: true, msgSeen: true },
    });
    assert.deepStrictEqual(
        settings.render(),
        { hook: false, selector: false },
        "reenabling Hide Seen must not resurrect a cleared latch",
    );

    const killed = createSurface(facebookPage);
    assert.strictEqual(killed.latch(), false);
    assert.deepStrictEqual(killed.render(), { hook: true, selector: true });
    killed.context.window.postMessage({
        type: "GHOSTIFY_CONFIG_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        config: { killSwitch: ["msgSeen"] },
    });
    assert.deepStrictEqual(
        killed.render(),
        { hook: false, selector: false },
        "the kill switch must expose native state and clear the latch",
    );
    killed.context.window.postMessage({
        type: "GHOSTIFY_CONFIG_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        config: { killSwitch: [] },
    });
    assert.deepStrictEqual(
        killed.render(),
        { hook: false, selector: false },
        "removing the kill switch must not resurrect a cleared latch",
    );

    for (const scenario of [
        {
            label: "Message Requests",
            page: {
                ...facebookPage,
                pathname: "/messages/requests",
                href: "https://www.facebook.com/messages/requests",
            },
            dynamicBypass: true,
        },
        {
            label: "Messenger.com",
            page: {
                hostname: "www.messenger.com",
                pathname: "/t/redacted",
                href: "https://www.messenger.com/t/redacted",
            },
        },
        {
            label: "Facebook MAW proxy",
            page: {
                hostname: "www.fbsbx.com",
                pathname: "/maw_proxy_page/",
                href: "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted",
            },
        },
        {
            label: "Facebook child frame",
            page: facebookPage,
            configureContext(context) {
                context.window.top = {};
            },
        },
    ]) {
        const surface = createSurface(scenario.page, scenario.configureContext);
        assert.strictEqual(
            surface.latch(),
            true,
            `${scenario.label} press behavior must remain native`,
        );
        assert.deepStrictEqual(
            surface.render(),
            { hook: false, selector: false },
            `${scenario.label} row behavior must remain native`,
        );
        if (scenario.dynamicBypass) {
            assert.notStrictEqual(
                surface.requiredRowSelector,
                surface.selectorExports,
                `${scenario.label} may retain a dynamically bypassed row shadow`,
            );
        } else {
            assert.strictEqual(
                surface.requiredRowSelector,
                surface.selectorExports,
                `${scenario.label} must not receive a row shadow`,
            );
        }
    }
}

function testFacebookUnreadRowShadowPreservesNullAndAccessorExports() {
    const page = {
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatOpen: true,
    };
    const exerciseShape = (selectorExports) => {
        const context = makeMessengerPatchPage({}, page);
        let rowSelector;
        const press = registerMessengerModuleWithDependencies(
            context,
            "useOnPressMWThreadListItem",
            ["MWPIsThreadUnread"],
            { MWPIsThreadUnread: selectorExports },
            function (_a, require, _c, _d, moduleObject) {
                const selector = require("MWPIsThreadUnread");
                moduleObject.exports.open = (record) =>
                    selector.isThreadUnread(record);
            },
        );
        const row = registerMessengerModuleWithDependencies(
            context,
            "MWThreadListItemAddonEndReact",
            ["MWPIsThreadUnread"],
            { MWPIsThreadUnread: selectorExports },
            function (_a, require, _c, _d, moduleObject) {
                rowSelector = require("MWPIsThreadUnread");
                moduleObject.exports.render = (record) => ({
                    hook: rowSelector.useIsThreadUnread(record.threadKey),
                    selector: rowSelector.isThreadUnread(record),
                    sibling: rowSelector.sibling,
                });
            },
        );
        const record = Object.freeze({ threadKey: Object.freeze([333, 444]) });
        assert.strictEqual(press.exports.open(record), false);
        selectorExports.setUnread(false);
        return { context, record, row, rowSelector };
    };

    let nullUnread = true;
    const nullPrototypeExports = Object.assign(Object.create(null), {
        isThreadUnread() {
            return nullUnread;
        },
        useIsThreadUnread() {
            return nullUnread;
        },
        sibling: Object.freeze({ contract: "null-prototype" }),
        setUnread(value) {
            nullUnread = value;
        },
    });
    Object.freeze(nullPrototypeExports);
    const nullShape = exerciseShape(nullPrototypeExports);
    assert.deepStrictEqual(nullShape.row.exports.render(nullShape.record), {
        hook: true,
        selector: true,
        sibling: nullPrototypeExports.sibling,
    });
    assert.strictEqual(Object.getPrototypeOf(nullShape.rowSelector), null);
    assert.notStrictEqual(nullShape.rowSelector, nullPrototypeExports);

    let accessorUnread = true;
    let hookGetterCalls = 0;
    let selectorGetterCalls = 0;
    const accessorHook = function () {
        return accessorUnread;
    };
    const accessorSelector = function () {
        return accessorUnread;
    };
    const accessorExports = {};
    Object.defineProperties(accessorExports, {
        isThreadUnread: {
            configurable: false,
            enumerable: false,
            get() {
                selectorGetterCalls += 1;
                return accessorSelector;
            },
        },
        useIsThreadUnread: {
            configurable: false,
            enumerable: true,
            get() {
                hookGetterCalls += 1;
                return accessorHook;
            },
        },
        sibling: {
            configurable: false,
            enumerable: false,
            value: "accessor-native",
            writable: false,
        },
        setUnread: {
            configurable: false,
            enumerable: false,
            value(value) {
                accessorUnread = value;
            },
            writable: false,
        },
    });
    Object.freeze(accessorExports);
    const accessorShape = exerciseShape(accessorExports);
    assert.deepStrictEqual(
        accessorShape.row.exports.render(accessorShape.record),
        { hook: true, selector: true, sibling: "accessor-native" },
    );
    assert.ok(hookGetterCalls >= 1);
    assert.ok(selectorGetterCalls >= 1);
    assert.strictEqual(
        Object.getOwnPropertyDescriptor(
            accessorShape.rowSelector,
            "isThreadUnread",
        ).enumerable,
        false,
    );
    assert.strictEqual(
        Object.getOwnPropertyDescriptor(
            accessorShape.rowSelector,
            "useIsThreadUnread",
        ).enumerable,
        true,
    );
    assert.strictEqual(accessorExports.isThreadUnread, accessorSelector);
    assert.strictEqual(accessorExports.useIsThreadUnread, accessorHook);
}

function testFacebookLateLocalReadAliasesBlockOnlyPositionalI64Mutations() {
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);

    for (const moduleName of [
        "LSUpdateThreadReadWatermark",
        "LSMarkThreadReadV2",
        "MWMarkThreadRead",
    ]) {
        const context = makeMessengerPatchPage(
            {},
            {
                hostname: "www.facebook.com",
                pathname: "/",
                href: "https://www.facebook.com/",
                facebookMiniChatOpen: true,
            },
        );
        let calls = 0;
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function () {
                    calls += 1;
                    return "mutated";
                };
            },
        );

        assert.strictEqual(
            module.exports.default(threadKeyI64, watermarkI64, 95),
            undefined,
        );
        assert.strictEqual(
            calls,
            0,
            `${moduleName} positional I64 local-read mutation must be blocked`,
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0,
            1,
        );

        const hydrationPayload = {
            thread_key: { thread_fbid: "redacted-thread" },
            cursor: "redacted-cursor",
            direction: "older",
            metadata_only: true,
        };
        assert.strictEqual(module.exports.default(hydrationPayload), "mutated");
        assert.strictEqual(
            calls,
            1,
            `${moduleName} non-read hydration payload must remain native`,
        );
    }

    const controlContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    let controlCalls = 0;
    const controlModule = registerMessengerModule(
        controlContext,
        "LSReadWatermarkPaginationCursor",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function () {
                controlCalls += 1;
                return "cursor-loaded";
            };
        },
    );
    assert.strictEqual(
        controlModule.exports.default(threadKeyI64, watermarkI64, {
            cursor: "redacted-cursor",
            direction: "older",
        }),
        "cursor-loaded",
        "a broad read-watermark cursor helper must not be mistaken for a positional read mutation",
    );
    assert.strictEqual(controlCalls, 1);
}

function testFacebookLongSessionLateModuleChurnRemainsProtected() {
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
    let mutationCalls = 0;

    for (let index = 0; index < 60; index += 1) {
        const leaf = function () {
            mutationCalls += 1;
            return index;
        };
        const generic = registerMessengerModule(
            context,
            "LSUpdateThreadReadWatermark",
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = leaf;
            },
        );
        const exact = registerMessengerModule(
            context,
            "LSMarkThreadRead",
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = generic.exports.default;
            },
        );
        assert.strictEqual(
            exact.exports.default(threadKeyI64, watermarkI64, 95),
            undefined,
        );
    }

    assert.strictEqual(
        mutationCalls,
        0,
        "late module churn must never expose a native positional read leaf",
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0,
        60,
    );
}

async function testFacebookGroupReadHooksWrapCallbacksWithoutBreakingRestoredHydration() {
    for (const moduleName of [
        "useMAWMarkThreadAsRead",
        "useMWPSafelyMarkThreadAsRead",
        "useMWMarkThreadAsReadWhenNewMessagesArrive",
    ]) {
        const context = makeMessengerPatchPage(
            {},
            {
                hostname: moduleName.startsWith("useMAW")
                    ? "www.fbsbx.com"
                    : "www.facebook.com",
                pathname: moduleName.startsWith("useMAW")
                    ? "/maw_proxy_page/"
                    : "/",
                search: moduleName.startsWith("useMAW")
                    ? "?__cci=redacted"
                    : "",
                href: moduleName.startsWith("useMAW")
                    ? "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted"
                    : "https://www.facebook.com/",
                facebookMiniChatOpen: !moduleName.startsWith("useMAW"),
            },
        );
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
            },
        );

        const first = module.exports.default();
        const second = module.exports.default();
        assert.strictEqual(
            first,
            second,
            `${moduleName} must preserve stable callback identity`,
        );
        assert.strictEqual(
            hookCalls,
            2,
            `${moduleName} hook orchestration must continue running`,
        );
        assert.strictEqual(await first({ threadType: "GROUP" }), undefined);
        hydrationCalls += 1;
        assert.strictEqual(hydrationCalls, 1);
        assert.strictEqual(mutationCalls, 0);
        assert.strictEqual(state.unread, true);
    }

    const restoredContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    let restoredMutationCalls = 0;
    let restoredHydrationCalls = 0;
    const restoredModule = registerMessengerModule(
        restoredContext,
        "LSOptimisticMarkThreadReadV2StoredProcedure",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = async function () {
                restoredMutationCalls += 1;
            };
        },
    );
    const restoredResult = restoredModule.exports
        .default({ threadType: "GROUP" })
        .then(() => {
            restoredHydrationCalls += 1;
            return "restored-chat-hydrated";
        });
    assert.strictEqual(await restoredResult, "restored-chat-hydrated");
    assert.strictEqual(
        restoredMutationCalls,
        1,
        "the native optimistic adapter must execute during restored hydration",
    );
    assert.strictEqual(restoredHydrationCalls, 1);
}

async function testFacebookAsyncGroupReadHookPreservesThenability() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.fbsbx.com",
            pathname: "/maw_proxy_page/",
            search: "?__cci=redacted",
            href: "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted",
        },
    );
    let mutationCalls = 0;
    const module = registerMessengerModule(
        context,
        "useMAWMarkThreadAsRead",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function () {
                return async function () {
                    mutationCalls += 1;
                    return "native-async-read";
                };
            };
        },
    );

    const callback = module.exports.default();
    const result = callback({ threadType: "GROUP" });
    assert.ok(
        result && typeof result.then === "function",
        "async hook callback suppression must preserve thenability",
    );
    assert.strictEqual(await result, undefined);
    assert.strictEqual(mutationCalls, 0);

    context.window.__GHOSTIFY_SETTINGS__.msgSeen = false;
    assert.strictEqual(
        await callback({ threadType: "GROUP" }),
        "native-async-read",
    );
    assert.strictEqual(mutationCalls, 1);
}

async function testFacebookCompiledPromiseGroupReadHookPreservesThenability() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.fbsbx.com",
            pathname: "/maw_proxy_page/",
            search: "?__cci=redacted",
            href: "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted",
        },
    );
    let mutationCalls = 0;
    const module = registerMessengerModule(
        context,
        "useMAWMarkThreadAsRead",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function () {
                return function compiledPromiseCallback() {
                    mutationCalls += 1;
                    return Promise.resolve("native-compiled-read");
                };
            };
        },
    );

    const callback = module.exports.default();
    const result = callback({ threadType: "GROUP" });
    assert.ok(
        result && typeof result.then === "function",
        "compiled Promise callbacks must keep a neutral thenable contract",
    );
    assert.strictEqual(await result, undefined);
    assert.strictEqual(mutationCalls, 0);
}

async function testFacebookPromiseReadOperationsKeepNativeBypasses() {
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);
    const options = Object.freeze({
        folder: "message_requests",
        threadType: "GROUP",
        cursor: "redacted-cursor",
        shouldSendReadReceipt: true,
    });

    for (const moduleName of [
        "MAWMarkThreadAsRead",
        "LSOptimisticMarkThreadReadV2StoredProcedure",
    ]) {
        for (const bypass of ["settings-off", "message-request-grace"]) {
            const isMaw = moduleName.startsWith("MAW");
            const context = makeMessengerPatchPage(
                {},
                {
                    hostname: isMaw ? "www.fbsbx.com" : "www.facebook.com",
                    pathname: isMaw ? "/maw_proxy_page/" : "/",
                    search: isMaw ? "?__cci=redacted" : "",
                    href: isMaw
                        ? "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted"
                        : "https://www.facebook.com/",
                },
            );
            const calls = [];
            const sentinel = Object.freeze({ moduleName, bypass });
            const module = registerMessengerModule(
                context,
                moduleName,
                function (_a, _b, _c, _d, moduleObject) {
                    moduleObject.exports.markThreadAsReadImpl = async function (
                        ...args
                    ) {
                        calls.push(args);
                        return sentinel;
                    };
                },
            );

            if (bypass === "settings-off") {
                context.window.__GHOSTIFY_SETTINGS__.msgSeen = false;
            } else {
                context.window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ =
                    Date.now() + 15000;
            }

            const result = await module.exports.markThreadAsReadImpl(
                threadKeyI64,
                watermarkI64,
                options,
            );
            assert.strictEqual(
                result,
                sentinel,
                `${moduleName} ${bypass} must preserve the native resolved value`,
            );
            assert.strictEqual(calls.length, 1);
            assert.strictEqual(calls[0][0], threadKeyI64);
            assert.strictEqual(calls[0][1], watermarkI64);
            assert.strictEqual(calls[0][2], options);
            assert.strictEqual(
                context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ ||
                    0,
                0,
            );
        }
    }
}

function testFacebookLocalReadModulesRewriteNestedWatermarksToPreserveUnreadUi() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const calls = [];
    const module = registerMessengerModule(
        context,
        "LSUpdateThreadReadWatermark",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (payload) {
                calls.push(payload);
                return "feed-mini-chat-read-updated";
            };
        },
    );
    const normalReadPayload = {
        thread_key: { thread_fbid: "redacted-thread" },
        last_read_watermark: 1779530000000,
        last_read_watermark_ts: "1779530000001",
        last_seen_time_ms: 1779530000002,
        read_watermark: "1779530000003",
        nested: {
            watermark_timestamp: 1779530000004,
        },
        should_send_read_receipt: true,
        readReceiptMutation: { should_send_read_receipt: true },
    };

    assert.strictEqual(
        module.exports.default(normalReadPayload),
        "feed-mini-chat-read-updated",
    );
    assert.strictEqual(calls.length, 1);
    assert.notStrictEqual(
        calls[0],
        normalReadPayload,
        "Facebook local read modules must receive a clone when read UI state is neutralized",
    );
    assert.strictEqual(calls[0].last_read_watermark, SAFE_READ_WATERMARK);
    assert.strictEqual(
        calls[0].last_read_watermark_ts,
        SAFE_READ_WATERMARK_STRING,
    );
    assert.strictEqual(calls[0].last_seen_time_ms, SAFE_READ_WATERMARK);
    assert.strictEqual(calls[0].read_watermark, SAFE_READ_WATERMARK_STRING);
    assert.strictEqual(
        calls[0].nested.watermark_timestamp,
        SAFE_READ_WATERMARK,
    );
    assert.strictEqual(calls[0].should_send_read_receipt, false);
    assert.strictEqual(calls[0].readReceiptMutation, null);
    assert.strictEqual(
        normalReadPayload.last_read_watermark,
        1779530000000,
        "the original Facebook payload must not be mutated while neutralizing local read UI state",
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
        1,
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
        0,
    );
}

function testFacebookFeedMiniChatLocalReadModulesPreserveSendAckStatePayloads() {
    for (const moduleName of [
        "LSUpdateThreadReadWatermark",
        "LSMarkThreadRead",
        "MWMarkThreadRead",
        "LSMarkThreadAsRead",
        "MWMarkThreadAsRead",
        "MarkThreadAsRead",
    ]) {
        const context = makeMessengerPatchPage(
            {},
            {
                hostname: "www.facebook.com",
                pathname: "/",
                href: "https://www.facebook.com/",
                facebookMiniChatOpen: true,
            },
        );
        const calls = [];
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function (payload) {
                    calls.push(payload);
                    return "send-state-applied";
                };
            },
        );
        const sendAckPayload = {
            thread_key: { thread_fbid: "redacted-thread" },
            offline_threading_id: "redacted-offline-id",
            client_message_id: "redacted-client-message-id",
            message_id: "redacted-message-id",
            send_state: "sent",
            delivery_receipt: true,
            last_read_watermark: 1779530000000,
            should_send_read_receipt: false,
        };

        assert.strictEqual(
            module.exports.default(sendAckPayload),
            "send-state-applied",
            `${moduleName} send ack/state payloads must still call the original implementation`,
        );
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(
            calls[0],
            sendAckPayload,
            `${moduleName} send ack/state payloads must not be cloned or stale-watermarked`,
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
            0,
            `${moduleName} send ack/state payloads must not increment read sanitization`,
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
            0,
        );

        const pureReadPayload = {
            thread_key: { thread_fbid: "redacted-thread" },
            last_read_watermark: 1779530000001,
            should_send_read_receipt: true,
            readReceiptMutation: { should_send_read_receipt: true },
        };
        const exactLocalReadBlock = moduleName
            .toLowerCase()
            .includes("markthreadasread");
        if (moduleName === "LSMarkThreadRead") {
            assert.strictEqual(
                module.exports.default(pureReadPayload),
                "send-state-applied",
            );
            assert.strictEqual(calls.length, 2);
            assert.strictEqual(
                calls[1],
                pureReadPayload,
                "unconfirmed LSMarkThreadRead must remain native",
            );
            assert.strictEqual(
                context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
                0,
            );
            assert.strictEqual(
                context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
                0,
            );
        } else if (exactLocalReadBlock) {
            assert.strictEqual(
                module.exports.default(pureReadPayload),
                undefined,
            );
            assert.strictEqual(
                calls.length,
                1,
                `${moduleName} pure local-read mutation must be suppressed`,
            );
            assert.strictEqual(
                context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
                0,
            );
            assert.strictEqual(
                context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
                1,
            );
        } else {
            assert.strictEqual(
                module.exports.default(pureReadPayload),
                "send-state-applied",
            );
            assert.strictEqual(calls.length, 2);
            assert.notStrictEqual(
                calls[1],
                pureReadPayload,
                `${moduleName} pure read payloads should still be sanitized for Hide Seen`,
            );
            assert.strictEqual(
                calls[1].last_read_watermark,
                SAFE_READ_WATERMARK,
            );
            assert.strictEqual(calls[1].should_send_read_receipt, false);
            assert.strictEqual(
                context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
                1,
            );
        }
    }
}

function testFacebookFeedMiniChatLocalReadModulesPreservePendingSendStatePayloads() {
    for (const moduleName of [
        "LSUpdateThreadReadWatermark",
        "LSMarkThreadRead",
        "MWMarkThreadRead",
        "LSMarkThreadAsRead",
        "MWMarkThreadAsRead",
        "MarkThreadAsRead",
    ]) {
        const context = makeMessengerPatchPage(
            {},
            {
                hostname: "www.facebook.com",
                pathname: "/",
                href: "https://www.facebook.com/",
                facebookMiniChatOpen: true,
            },
        );
        const calls = [];
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function (payload) {
                    calls.push(payload);
                    return "pending-send-state-applied";
                };
            },
        );
        const pendingSendPayload = {
            thread_key: { thread_fbid: "redacted-thread" },
            offline_threading_id: "redacted-offline-id",
            client_message_id: "redacted-client-message-id",
            message: { text: "1" },
            send_type: 1,
            send_state: "sending",
            status: "Sending",
            last_read_watermark: 1779530000000,
            should_send_read_receipt: true,
        };

        assert.strictEqual(
            module.exports.default(pendingSendPayload),
            "pending-send-state-applied",
            `${moduleName} pending send-state payloads must still call the original implementation`,
        );
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(
            calls[0],
            pendingSendPayload,
            `${moduleName} pending send-state payloads must not be cloned or stale-watermarked`,
        );
        assert.strictEqual(calls[0].last_read_watermark, 1779530000000);
        assert.strictEqual(calls[0].should_send_read_receipt, true);
        assert.strictEqual(
            context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
            0,
            `${moduleName} pending send-state payloads must not increment read sanitization`,
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
            0,
        );
    }
}

function testFacebookMessageRequestGraceBypassesStaleLocalReadWrappersAtCallTime() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
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
    const normalReadPayload = {
        thread_key: { thread_fbid: "redacted-thread" },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
        readReceiptMutation: { should_send_read_receipt: true },
    };
    assert.strictEqual(
        module.exports.default(normalReadPayload),
        "request-hydrated",
    );
    assert.notStrictEqual(
        calls[0],
        normalReadPayload,
        "normal Facebook feed local read modules should still sanitize read receipt writes",
    );

    context.window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ =
        Date.now() + 15000;
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
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(
        calls[1],
        requestHydrationPayload,
        "stale local read wrappers must bypass sanitization during message-request click grace",
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
        1,
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
        0,
    );
}

function testFacebookMessageRequestGraceBypassesStaleExactMarkThreadAsReadWrapper() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
        },
    );
    const calls = [];
    const module = registerMessengerModule(
        context,
        "MWMarkThreadAsRead",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.markThreadAsRead = function markThreadAsRead(
                payload,
            ) {
                calls.push(payload);
                return "native-request-read-state";
            };
        },
    );
    const inboxPayload = {
        thread_key: { thread_fbid: "redacted-thread" },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
    };
    assert.strictEqual(
        module.exports.markThreadAsRead(inboxPayload),
        undefined,
    );
    assert.strictEqual(calls.length, 0);
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
        1,
    );

    context.window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ =
        Date.now() + 15000;
    const requestPayload = {
        folder: "message_requests",
        thread_key: { thread_fbid: "redacted-request" },
        last_read_watermark: 1779530000001,
        should_send_read_receipt: true,
        cursor: "redacted-cursor",
    };
    assert.strictEqual(
        module.exports.markThreadAsRead(requestPayload),
        "native-request-read-state",
    );
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0], requestPayload);
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
        1,
    );
}
