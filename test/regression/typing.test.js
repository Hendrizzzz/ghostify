const assert = require("assert");

const {
    makeMessengerPatchPage,
    registerMessengerModule,
    registerMessengerModuleWithDependencies,
} = require("../helpers/regression-harness");

function testTypingSenderIdNormalizationPreservesEncryptedChatHydration() {
    for (const page of [
        {
            hostname: "www.messenger.com",
            pathname: "/e2ee/t/123",
        },
        {
            hostname: "www.facebook.com",
            pathname: "/messages/e2ee/t/123",
        },
        {
            hostname: "www.fbsbx.com",
            pathname: "/maw_proxy_page/",
        },
    ]) {
        for (const msgTyping of [true, false]) {
            const context = makeMessengerPatchPage({ msgTyping }, page);
            const senderId = Object.freeze([0, 123]);
            const normalizerCalls = [];
            const normalizeTypingIndicatorSenderId = function (value) {
                normalizerCalls.push({ value, thisArg: this });
                return senderId;
            };
            const helper = registerMessengerModule(
                context,
                "MAWBridgeTypingIndicatorSenderId",
                function (_a, _b, _c, _d, _module, exports) {
                    exports.normalizeTypingIndicatorSenderId =
                        normalizeTypingIndicatorSenderId;
                },
            );
            const nativeHelper = helper.exports;
            const hydration = registerMessengerModuleWithDependencies(
                context,
                "MAWBridgeNewMsgHandler",
                ["MAWBridgeTypingIndicatorSenderId", "LSSendTypingIndicator"],
                {
                    MAWBridgeTypingIndicatorSenderId: nativeHelper,
                    LSSendTypingIndicator: { default() {} },
                },
                function (_a, require, _c, _d, _module, exports) {
                    exports.load = function () {
                        const helper = require("MAWBridgeTypingIndicatorSenderId");
                        const id =
                            helper.normalizeTypingIndicatorSenderId("123");
                        // Native encrypted-message insertion consumes an I64 ID.
                        return id[1];
                    };
                },
            );

            assert.strictEqual(
                helper.exports.normalizeTypingIndicatorSenderId,
                normalizeTypingIndicatorSenderId,
                "an ID normalizer must never be classified as an outgoing typing operation",
            );
            assert.strictEqual(hydration.exports.load(), 123);
            assert.strictEqual(normalizerCalls.length, 1);
            assert.strictEqual(normalizerCalls[0].value, "123");
            assert.strictEqual(normalizerCalls[0].thisArg, nativeHelper);
            assert.strictEqual(
                context.window.__GHOSTIFY_BLOCKED_TYPING_EXPORT_CALLS__ || 0,
                0,
            );
        }
    }
}

function testTypingWriteClassificationPreservesNonSendingExports() {
    for (const hostname of ["www.messenger.com", "www.fbsbx.com"]) {
        for (const name of [
            "LSSendTypingIndicator",
            "LSSendTypingIndicatorStoredProcedure",
            "MWV2SendChatStateFromComposer",
            "MW_send_chat_state",
            "MAWSendSecureTypingNotification",
            "MW_send_typing_indicator",
        ]) {
            const context = makeMessengerPatchPage(
                {},
                { hostname, pathname: "/maw_proxy_page/" },
            );
            let sends = 0;
            const senderId = Object.freeze([0, 123]);
            const normalizer = () => senderId;
            const receiver = () => "incoming-state";
            const nativeResult = Object.freeze({ sent: true });
            const send = function () {
                assert.strictEqual(this, module.exports);
                sends++;
                return nativeResult;
            };
            const module = registerMessengerModule(
                context,
                name,
                function (_a, _b, _c, _d, _module, exports) {
                    exports.default = send;
                    exports.sendTypingIndicator = send;
                    exports.normalizeTypingIndicatorSenderId = normalizer;
                    exports.getTypingIndicator = receiver;
                },
            );

            assert.strictEqual(
                module.exports.normalizeTypingIndicatorSenderId,
                normalizer,
            );
            assert.strictEqual(module.exports.getTypingIndicator, receiver);
            assert.strictEqual(
                module.exports.normalizeTypingIndicatorSenderId(),
                senderId,
            );
            assert.strictEqual(
                module.exports.getTypingIndicator(),
                "incoming-state",
            );
            assert.strictEqual(module.exports.default(), undefined);
            assert.strictEqual(module.exports.sendTypingIndicator(), undefined);
            assert.strictEqual(
                sends,
                0,
                `${name} must suppress outgoing typing`,
            );
            assert.strictEqual(
                context.window.__GHOSTIFY_BLOCKED_TYPING_EXPORT_CALLS__,
                2,
            );

            context.window.__GHOSTIFY_SETTINGS__.msgTyping = false;
            assert.strictEqual(module.exports.default(), nativeResult);
            assert.strictEqual(
                module.exports.sendTypingIndicator(),
                nativeResult,
            );
            assert.strictEqual(sends, 2);
        }
    }
}

async function testFacebookSecureTypingStateModulesPreserveReturnContract() {
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
    const ack = { ok: true, armadillo_thread_key: "redacted-armadillo-thread" };
    const module = registerMessengerModule(
        context,
        "MAWSecureTypingState",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function secureTypingState(payload) {
                calls.push(payload);
                return Promise.resolve(ack);
            };
        },
    );

    const result = module.exports.default({
        armadillo_thread_key: "redacted-armadillo-thread",
        offline_threading_id: "redacted-offline-id",
    });

    assert.strictEqual(
        typeof result?.then,
        "function",
        "Facebook MAW secure typing-state modules must keep promise-like return values for protected chat send state",
    );
    assert.strictEqual(await result, ack);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_TYPING_EXPORT_CALLS__ || 0,
        0,
    );

    const typingCalls = [];
    const typingModule = registerMessengerModule(
        makeMessengerPatchPage(),
        "LSSendTypingIndicator",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function sendTypingIndicator(
                payload,
            ) {
                typingCalls.push(payload);
                return "typing-sent";
            };
        },
    );
    assert.strictEqual(
        typingModule.exports.default({
            thread_key: { thread_fbid: "redacted-thread" },
            chatstate: "typing_indicator",
            send_type: "typing",
        }),
        undefined,
        "explicit typing indicator modules must still be blocked",
    );
    assert.strictEqual(typingCalls.length, 0);
}

async function testFacebookMawSecureTypingStateDependenciesPreserveSecureSend() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const dependencyCalls = [];
    const dependencyExports = {
        LSSendTypingIndicator: {
            default(payload) {
                dependencyCalls.push({ module: "typing", payload });
                return Promise.resolve("secure-send-state-ok");
            },
        },
        LSUpdateThreadReadWatermark: {
            default(payload) {
                dependencyCalls.push({ module: "read", payload });
                return "local-state-ok";
            },
        },
    };
    const module = registerMessengerModuleWithDependencies(
        context,
        "MAWSecureTypingState",
        ["LSSendTypingIndicator", "LSUpdateThreadReadWatermark"],
        dependencyExports,
        function (_a, require, _c, _d, moduleObject) {
            moduleObject.exports.default = async function secureTypingState(
                payload,
            ) {
                await require("LSSendTypingIndicator").default(payload);
                require("LSUpdateThreadReadWatermark").default(payload);
                return "secure-send-ok";
            };
        },
    );
    const secureSendPayload = {
        armadillo_thread_key: "redacted-armadillo-thread",
        offline_threading_id: "redacted-offline-id",
        send_type: 1,
        encrypted_message: "redacted-ciphertext",
        last_read_watermark: 1779530000000,
        should_send_read_receipt: false,
    };

    assert.strictEqual(
        await module.exports.default(secureSendPayload),
        "secure-send-ok",
    );
    assert.deepStrictEqual(
        dependencyCalls,
        [
            { module: "typing", payload: secureSendPayload },
            { module: "read", payload: secureSendPayload },
        ],
        "MAW secure-send dependencies must receive the original payload and preserve their return contracts",
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_TYPING_EXPORT_CALLS__ || 0,
        0,
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
        0,
    );
}

async function testFacebookMiniChatComposerSendDependenciesPreserveSecureSend() {
    for (const page of [
        {
            label: "Facebook mini-chat",
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
    ]) {
        const context = makeMessengerPatchPage({}, page);
        const dependencyCalls = [];
        const dependencyExports = {
            LSSendTypingIndicator: {
                default(payload) {
                    dependencyCalls.push({ module: "typing", payload });
                    return Promise.resolve("secure-send-state-ok");
                },
            },
            LSUpdateThreadReadWatermark: {
                default(payload) {
                    dependencyCalls.push({ module: "read", payload });
                    return "local-send-state-ok";
                },
            },
        };
        const module = registerMessengerModuleWithDependencies(
            context,
            "MWChatComposerSendMessageAction",
            ["LSSendTypingIndicator", "LSUpdateThreadReadWatermark"],
            dependencyExports,
            function (_a, require, _c, _d, moduleObject) {
                moduleObject.exports.default = async function sendMessage(
                    payload,
                ) {
                    const typingResult =
                        await require("LSSendTypingIndicator").default(payload);
                    const readResult =
                        require("LSUpdateThreadReadWatermark").default(payload);
                    return { typingResult, readResult };
                };
            },
        );
        const secureSendPayload = {
            open_message_thread_key: "redacted-open-thread",
            armadillo_thread_key: "redacted-armadillo-thread",
            offline_threading_id: "redacted-offline-id",
            client_message_id: "redacted-client-message-id",
            send_type: 1,
            encrypted_payload: "redacted-ciphertext",
            should_send_read_receipt: false,
            last_read_watermark: 1779530000000,
        };

        assert.deepStrictEqual(
            await module.exports.default(secureSendPayload),
            {
                typingResult: "secure-send-state-ok",
                readResult: "local-send-state-ok",
            },
            `${page.label} composer send dependencies must preserve secure-send return values`,
        );
        assert.deepStrictEqual(
            dependencyCalls,
            [
                { module: "typing", payload: secureSendPayload },
                { module: "read", payload: secureSendPayload },
            ],
            `${page.label} send modules must receive original secure-send dependency payloads`,
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_BLOCKED_TYPING_EXPORT_CALLS__ || 0,
            0,
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
            0,
        );
    }
}

(async () => {
    testTypingSenderIdNormalizationPreservesEncryptedChatHydration();
    testTypingWriteClassificationPreservesNonSendingExports();
    await testFacebookSecureTypingStateModulesPreserveReturnContract();
    await testFacebookMawSecureTypingStateDependenciesPreserveSecureSend();
    await testFacebookMiniChatComposerSendDependenciesPreserveSecureSend();
    console.log("typing indicator regression tests passed");
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
