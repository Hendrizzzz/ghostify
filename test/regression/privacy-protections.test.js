const assert = require("assert");

const {
    messengerSendWithWatermark,
    messengerSendWithReadReceiptFlag,
    messengerBatchedSendWithReadReceipt,
    messengerSendWithUserAuthoredPrivacyTerms,
    messengerDeliveryWithWatermark,
    messengerTyping,
    messengerReadReceipt,
    makeMessengerPage,
    makeMessengerPatchPage,
    fetchOutcome,
    websocketOutcome,
    workerOutcome,
} = require("../helpers/regression-harness");

const messengerReadReceiptWithDeliveryMarker = JSON.stringify({
    issue_new_task: true,
    tasks: [
        {
            label: "read_receipt",
            queue_name: "read_receipt",
            payload: {
                thread_key: { thread_fbid: "redacted-thread" },
                delivery_receipt: true,
                sendReadReceipt: true,
                last_read_watermark_ts: 1779530000000,
            },
        },
    ],
});

async function testMessengerTypingAndSeenProtectionsStillBlock() {
    const window = makeMessengerPage();

    assert.strictEqual(
        await fetchOutcome(window, messengerTyping),
        "MSG_TYPING",
    );
    assert.strictEqual(websocketOutcome(window, messengerTyping), "blocked");
    assert.strictEqual(
        await fetchOutcome(window, messengerReadReceipt),
        "MSG_SEEN",
    );
    assert.strictEqual(
        websocketOutcome(window, messengerReadReceipt),
        "blocked",
    );
    assert.strictEqual(
        await fetchOutcome(window, messengerReadReceiptWithDeliveryMarker),
        "MSG_SEEN",
    );
    assert.strictEqual(
        websocketOutcome(window, messengerReadReceiptWithDeliveryMarker),
        "blocked",
    );
}

function testMessengerPatchPurePrivacyTrafficStillBlocks() {
    const typingContext = makeMessengerPatchPage();
    const typingOutcome = workerOutcome(
        typingContext,
        JSON.parse(messengerTyping),
    );
    assert.strictEqual(typingOutcome.result, undefined);
    assert.strictEqual(typingOutcome.postCount, 0);
    assert.strictEqual(typingOutcome.blocked, 1);

    const seenContext = makeMessengerPatchPage();
    const seenOutcome = workerOutcome(seenContext, messengerReadReceipt);
    assert.strictEqual(seenOutcome.result, undefined);
    assert.strictEqual(seenOutcome.postCount, 0);
    assert.strictEqual(seenOutcome.blocked, 1);
}

function testMessengerPatchNormalizesPageBridgeUpdates() {
    const context = makeMessengerPatchPage();

    context.window.postMessage({
        type: "GHOSTIFY_SETTINGS_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        settings: {
            msgSeen: false,
            msgTyping: "false",
            unknownSetting: true,
        },
    });

    assert.strictEqual(
        context.window.__ghostify_shouldBlockMessengerSeen(),
        false,
    );
    assert.strictEqual(
        context.window.__ghostify_shouldBlockMessengerTyping(),
        true,
    );
    assert.strictEqual(
        Object.prototype.hasOwnProperty.call(
            context.window.__GHOSTIFY_SETTINGS__,
            "unknownSetting",
        ),
        false,
        "page bridge must discard unknown settings",
    );

    context.window.postMessage({
        type: "GHOSTIFY_CONFIG_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        config: { killSwitch: ["unknownFeature", 42] },
    });
    assert.strictEqual(
        context.window.__ghostify_shouldBlockMessengerTyping(),
        true,
    );

    context.window.postMessage({
        type: "GHOSTIFY_CONFIG_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        config: { killSwitch: ["msgTyping", "unknownFeature"] },
    });
    assert.strictEqual(
        context.window.__ghostify_shouldBlockMessengerTyping(),
        false,
    );
}

async function testMessengerTogglesDisableProtections() {
    const window = makeMessengerPage({
        msgSeen: false,
        msgTyping: false,
    });

    assert.strictEqual(
        await fetchOutcome(window, messengerSendWithWatermark),
        "allowed",
    );
    assert.strictEqual(
        await fetchOutcome(window, messengerSendWithReadReceiptFlag),
        "allowed",
    );
    assert.strictEqual(
        await fetchOutcome(window, messengerBatchedSendWithReadReceipt),
        "allowed",
    );
    assert.strictEqual(
        await fetchOutcome(window, messengerSendWithUserAuthoredPrivacyTerms),
        "allowed",
    );
    assert.strictEqual(
        await fetchOutcome(window, messengerDeliveryWithWatermark),
        "allowed",
    );
    assert.strictEqual(await fetchOutcome(window, messengerTyping), "allowed");
    assert.strictEqual(
        await fetchOutcome(window, messengerReadReceipt),
        "allowed",
    );
    assert.strictEqual(websocketOutcome(window, messengerTyping), "allowed");
    assert.strictEqual(
        websocketOutcome(window, messengerReadReceipt),
        "allowed",
    );

    const bridgeContext = makeMessengerPatchPage({
        msgSeen: false,
        msgTyping: false,
    });
    assert.strictEqual(
        workerOutcome(bridgeContext, JSON.parse(messengerTyping)).result,
        "worker-sent",
    );
    assert.strictEqual(
        workerOutcome(bridgeContext, messengerReadReceipt).result,
        "worker-sent",
    );
}

(async () => {
    await testMessengerTypingAndSeenProtectionsStillBlock();
    testMessengerPatchPurePrivacyTrafficStillBlocks();
    testMessengerPatchNormalizesPageBridgeUpdates();
    await testMessengerTogglesDisableProtections();
    console.log("privacy protection regression tests passed");
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
