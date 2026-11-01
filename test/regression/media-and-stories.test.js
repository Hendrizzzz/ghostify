const assert = require("assert");

const {
    makeGhostPage,
    makeMessengerPatchPage,
    fetchOutcomeAt,
    websocketSend,
    xhrSendAt,
    workerOutcome,
} = require("../helpers/regression-harness");

const facebookVideoAdGraphQL = `fb_api_req_friendly_name=CometVideoPlayerAdBreakQuery&doc_id=redacted-doc&variables=${encodeURIComponent(
    JSON.stringify({
        video_id: "redacted-video",
        player_state: "ad_break",
        ad_break: true,
        watch_time: 0,
        composer: { is_composing: false },
        maw: "player_surface",
    }),
)}`;

const facebookVideoAdGraphQLWithFalsePrivacyFields = `fb_api_req_friendly_name=CometVideoPlayerAdBreakQuery&doc_id=redacted-doc&variables=${encodeURIComponent(
    JSON.stringify({
        video_id: "redacted-video",
        player_state: "ad_break",
        ad_break: true,
        watch_time: 0,
        mark_seen: false,
        read_receipt: false,
        should_send_read_receipt: false,
        composer: { is_composing: false },
        maw: "player_surface",
    }),
)}`;

const facebookVideoAdWorkerMessageWithFalsePrivacyFields = {
    type: "player_payload",
    payload: {
        video_id: "redacted-video",
        player_state: "ad_break",
        ad_break: true,
        current_time: 12,
        mark_seen: false,
        read_receipt: false,
        should_send_read_receipt: false,
        composer: { is_composing: false },
        maw: "player_surface",
    },
};

const instagramReelsMediaGraphQL = `fb_api_req_friendly_name=PolarisClipsTabDesktopQuery&doc_id=redacted-doc&variables=${encodeURIComponent(
    JSON.stringify({
        reel_media_id: "redacted-reel",
        video_versions: [{ type: 101 }],
        dash_info: { is_dash_eligible: true },
        playable_url: "https://scontent.cdninstagram.com/redacted.mp4",
        reel_seen: false,
    }),
)}`;

const messageRequestReadWatermarkMutation = `fb_api_req_friendly_name=MWMessageRequestsUpdateLastReadWatermarkMutation&doc_id=redacted-doc&variables=${encodeURIComponent(
    JSON.stringify({
        message_requests: true,
        thread_id: "redacted-thread",
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
    }),
)}`;

const messageRequestReadWatermarkOperationMutation = JSON.stringify({
    operationName: "MWMessageRequestsUpdateLastReadWatermarkMutation",
    doc_id: "redacted-doc",
    variables: {
        message_requests: true,
        thread_id: "redacted-thread",
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
    },
});

const messageRequestReadWatermarkDocIdWrite = JSON.stringify({
    doc_id: "redacted-doc",
    variables: {
        message_requests: true,
        thread_id: "redacted-thread",
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
    },
});

const messageRequestReadReceiptDocIdWrite = JSON.stringify({
    doc_id: "redacted-doc",
    variables: {
        message_requests: true,
        thread_id: "redacted-thread",
        read_receipt: true,
    },
});

const messageRequestMarkReadDocIdWrite = JSON.stringify({
    doc_id: "redacted-doc",
    variables: {
        message_requests: true,
        thread_id: "redacted-thread",
        mark_read: true,
    },
});

const facebookVideoReadWatermarkMutation = `fb_api_req_friendly_name=MWUpdateLastReadWatermarkMutation&doc_id=redacted-doc&variables=${encodeURIComponent(
    JSON.stringify({
        thread_id: "redacted-thread",
        last_read_watermark: 1779530000000,
        video_id: "redacted-video",
        player_state: "playing",
    }),
)}`;

const instagramStorySeenGraphQLWithDocId = JSON.stringify({
    operationName: "PolarisStorySurfaceMutation",
    doc_id: "redacted-doc",
    variables: {
        reel_seen: true,
        mark_story_seen: true,
        reel_id: "redacted-reel",
        timestamp: 1779530000000,
    },
});

const instagramStorySeenMediaGraphQLWithDocId = JSON.stringify({
    operationName: "PolarisStorySurfaceMutation",
    doc_id: "redacted-doc",
    variables: {
        reel_seen: true,
        mark_story_seen: true,
        reel_media_id: "redacted-reel",
        playable_url: "https://scontent.cdninstagram.com/redacted.mp4",
        timestamp: 1779530000000,
    },
});

function makeFacebookWebLiteFrame({ byteLength, opcode, actionFlags = 0 }) {
    const bytes = new Uint8Array(byteLength);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, byteLength - 2);
    bytes[2] = opcode;

    // Redacted WebLite session/message header captured from Firefox Android.
    bytes.set([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08], 3);
    view.setUint32(11, 1);

    if (opcode === 83 && byteLength >= 32) {
        view.setUint32(15, 66000);
        view.setUint32(19, 66001);
        view.setUint32(23, 0);
        view.setUint16(27, 0);
        view.setUint16(29, 0);

        let offset = 31;
        let value = actionFlags;
        do {
            let digit = value & 0x7f;
            value >>>= 7;
            if (value) digit |= 0x80;
            bytes[offset++] = digit;
        } while (value && offset < byteLength);

        if (byteLength === 54 && actionFlags === 66) {
            bytes.fill(0xff, 36, 40);
            bytes[48] = 12;
        }
    }

    return bytes;
}

const facebookMobileStorySeenWebLiteFrame = makeFacebookWebLiteFrame({
    byteLength: 54,
    opcode: 83,
    actionFlags: 66,
});

const facebookMobileStoryNavigationWebLiteFrame = makeFacebookWebLiteFrame({
    byteLength: 58,
    opcode: 83,
    actionFlags: 64,
});

const facebookMobileStoryNavigationWithPayloadWebLiteFrame =
    makeFacebookWebLiteFrame({
        byteLength: 74,
        opcode: 83,
        actionFlags: 194,
    });

const facebookMobileStoryMediaTelemetryWebLiteFrame = makeFacebookWebLiteFrame({
    byteLength: 669,
    opcode: 4,
});

const facebookMobileStoryVisibilityWebLiteFrame = makeFacebookWebLiteFrame({
    byteLength: 36,
    opcode: 111,
});

async function fetchRequestOutcomeAt(window, url, body, method = "GET") {
    const request = new window.Request(url, {
        method,
        body,
    });
    const response = await window.fetch(request);
    if (!response.ghostifyResponse) return "allowed";
    const payload = JSON.parse(response.body);
    return payload.blocked || "blocked";
}

async function testFacebookMobileStoryWebLiteSeenFramesAreExactScoped() {
    const endpoint = "wss://kaios-d.facebook.com/ws/redacted-channel";
    const storyPage = {
        hostname: "m.facebook.com",
        pathname: "/stories/redacted-owner/redacted-story/",
        href: "https://m.facebook.com/stories/redacted-owner/redacted-story/",
    };
    const protectedStoryWindow = makeGhostPage(storyPage);
    const expectSocketSendCount = (
        pageWindow,
        body,
        url,
        expected,
        message,
    ) => {
        const { socket } = websocketSend(pageWindow, body, url);
        assert.strictEqual(socket.sent.length, expected, message);
    };

    expectSocketSendCount(
        protectedStoryWindow,
        facebookMobileStorySeenWebLiteFrame,
        endpoint,
        0,
        "Firefox Android Facebook story-view receipts must be swallowed on the captured WebLite transport",
    );
    expectSocketSendCount(
        protectedStoryWindow,
        facebookMobileStorySeenWebLiteFrame.slice().buffer,
        endpoint,
        0,
        "Direct ArrayBuffer story-view receipts must use the same protection",
    );
    expectSocketSendCount(
        protectedStoryWindow,
        facebookMobileStorySeenWebLiteFrame,
        "wss://kaios-z.facebook.com/ws/redacted-channel",
        1,
        "Unevidenced WebLite endpoints must fail open",
    );
    assert.strictEqual(
        await fetchOutcomeAt(
            protectedStoryWindow,
            "https://kaios-d.facebook.com/ws/redacted-channel",
            facebookMobileStorySeenWebLiteFrame,
        ),
        "allowed",
        "The WebLite signature must not block HTTPS requests",
    );
    const httpsXhr = xhrSendAt(
        protectedStoryWindow,
        "https://kaios-d.facebook.com/ws/redacted-channel",
        facebookMobileStorySeenWebLiteFrame,
        "POST",
    );
    assert.strictEqual(
        httpsXhr.xhr.sent,
        facebookMobileStorySeenWebLiteFrame,
        "The WebLite signature must stay native on XHR",
    );

    expectSocketSendCount(
        protectedStoryWindow,
        facebookMobileStoryNavigationWebLiteFrame,
        endpoint,
        1,
        "Facebook mobile story navigation frames must stay native",
    );
    expectSocketSendCount(
        protectedStoryWindow,
        facebookMobileStoryNavigationWithPayloadWebLiteFrame,
        endpoint,
        1,
        "Facebook mobile story navigation frames with an action payload must stay native",
    );
    expectSocketSendCount(
        protectedStoryWindow,
        facebookMobileStoryMediaTelemetryWebLiteFrame,
        endpoint,
        1,
        "Facebook mobile story media telemetry must not be mistaken for a view receipt",
    );
    expectSocketSendCount(
        protectedStoryWindow,
        facebookMobileStoryVisibilityWebLiteFrame,
        endpoint,
        1,
        "Facebook mobile story visibility-duration frames must stay native",
    );

    const offsetBacking = new Uint8Array(
        facebookMobileStorySeenWebLiteFrame.byteLength + 8,
    );
    offsetBacking.set(facebookMobileStorySeenWebLiteFrame, 4);
    expectSocketSendCount(
        protectedStoryWindow,
        new Uint8Array(
            offsetBacking.buffer,
            4,
            facebookMobileStorySeenWebLiteFrame.byteLength,
        ),
        endpoint,
        0,
        "Captured story-view matching must honor typed-array byte offsets",
    );

    const nearMissMutations = [
        ["declared length", 1, 51],
        ["message opcode", 2, 82],
        ["zero action field", 23, 1],
        ["action flag", 31, 64],
        ["sentinel", 36, 254],
        ["QPL flag", 48, 0],
    ];
    for (const [label, index, value] of nearMissMutations) {
        const nearMiss = facebookMobileStorySeenWebLiteFrame.slice();
        nearMiss[index] = value;
        expectSocketSendCount(
            protectedStoryWindow,
            nearMiss,
            endpoint,
            1,
            `A 54-byte WebLite frame with a different ${label} must fail open`,
        );
    }
    expectSocketSendCount(
        protectedStoryWindow,
        facebookMobileStorySeenWebLiteFrame,
        "wss://edge-chat.facebook.com/chat?region=redacted",
        1,
        "The mobile story signature must not affect Messenger realtime transports",
    );

    const feedWindow = makeGhostPage({
        hostname: "m.facebook.com",
        pathname: "/",
        href: "https://m.facebook.com/",
    });
    expectSocketSendCount(
        feedWindow,
        facebookMobileStorySeenWebLiteFrame,
        endpoint,
        1,
        "The captured action signature must remain native outside the Facebook story viewer",
    );

    const desktopStoryWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/stories/redacted-owner/redacted-story/",
        href: "https://www.facebook.com/stories/redacted-owner/redacted-story/",
    });
    expectSocketSendCount(
        desktopStoryWindow,
        facebookMobileStorySeenWebLiteFrame,
        endpoint,
        1,
        "The WebLite signature must not alter Facebook desktop story traffic",
    );

    const disabledStoryWindow = makeGhostPage(storyPage, { msgStory: false });
    expectSocketSendCount(
        disabledStoryWindow,
        facebookMobileStorySeenWebLiteFrame,
        endpoint,
        1,
        "Turning Facebook Story Hider off must restore the native WebLite view receipt",
    );

    const killedStoryWindow = makeGhostPage(storyPage);
    killedStoryWindow.postMessage({
        type: "GHOSTIFY_CONFIG_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        config: { killSwitch: ["msgStory"], patterns: {} },
    });
    expectSocketSendCount(
        killedStoryWindow,
        facebookMobileStorySeenWebLiteFrame,
        endpoint,
        1,
        "The msgStory kill switch must restore the native WebLite view receipt",
    );
}

async function testVideoAdAndMediaTrafficIsAllowed() {
    const facebookWatchWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/watch",
        href: "https://www.facebook.com/watch",
    });

    assert.strictEqual(
        await fetchOutcomeAt(
            facebookWatchWindow,
            "/api/graphql/",
            facebookVideoAdGraphQL,
        ),
        "allowed",
        "Facebook video/ad player GraphQL must not be swallowed as typing or seen traffic",
    );

    assert.strictEqual(
        await fetchOutcomeAt(
            facebookWatchWindow,
            "/api/graphql/",
            facebookVideoAdGraphQLWithFalsePrivacyFields,
        ),
        "allowed",
        "Facebook video/ad player GraphQL with falsey privacy-looking fields must not be swallowed",
    );
    assert.strictEqual(
        facebookWatchWindow.navigator.sendBeacon(
            "/api/graphql/",
            facebookVideoAdGraphQLWithFalsePrivacyFields,
        ),
        "beacon",
        "Facebook video/ad sendBeacon telemetry with falsey privacy-looking fields must not be swallowed",
    );
    assert.strictEqual(facebookWatchWindow.beaconCalls.length, 1);

    const facebookWatchPatchContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/watch",
            href: "https://www.facebook.com/watch",
        },
    );
    const playerWorkerResult = workerOutcome(
        facebookWatchPatchContext,
        facebookVideoAdWorkerMessageWithFalsePrivacyFields,
    );
    assert.strictEqual(
        playerWorkerResult.result,
        "worker-sent",
        "Facebook video/ad worker messages with falsey privacy-looking fields must not be dropped",
    );
    assert.strictEqual(playerWorkerResult.blocked, 0);

    const encodedPlayerWorkerResult = workerOutcome(
        facebookWatchPatchContext,
        `variables=${encodeURIComponent(JSON.stringify(facebookVideoAdWorkerMessageWithFalsePrivacyFields))}`,
    );
    assert.strictEqual(
        encodedPlayerWorkerResult.result,
        "worker-sent",
        "Facebook video/ad worker strings with URL-encoded falsey privacy-looking fields must not be dropped",
    );
    assert.strictEqual(encodedPlayerWorkerResult.blocked, 0);

    assert.strictEqual(
        await fetchOutcomeAt(
            facebookWatchWindow,
            "https://video.xx.fbcdn.net/redacted/manifest.m3u8?mark_seen=1&typing_indicator=0",
            "",
            "GET",
        ),
        "allowed",
        "Facebook media manifests must bypass privacy pattern matching",
    );

    assert.strictEqual(
        await fetchRequestOutcomeAt(
            facebookWatchWindow,
            "https://video.xx.fbcdn.net/redacted/manifest.m3u8?mark_seen=1&typing_indicator=0",
        ),
        "allowed",
        "Facebook media manifest Request objects must bypass privacy pattern matching",
    );
    assert.strictEqual(
        xhrSendAt(
            facebookWatchWindow,
            "https://video.xx.fbcdn.net/redacted/manifest.m3u8?mark_seen=1&typing_indicator=0",
        ).result,
        "sent",
        "Facebook media manifest XHR loads must bypass privacy pattern matching",
    );

    assert.strictEqual(
        await fetchOutcomeAt(
            facebookWatchWindow,
            "https://video.xx.fbcdn.net/redacted/manifest.m3u8",
            facebookVideoReadWatermarkMutation,
        ),
        "blocked",
        "POST bodies to media-looking URLs must still pass through privacy-write detection",
    );
    assert.strictEqual(
        facebookWatchWindow.navigator.sendBeacon(
            "/api/graphql/",
            facebookVideoReadWatermarkMutation,
        ),
        true,
        "Beacon read-watermark writes must still be swallowed",
    );
    assert.strictEqual(
        facebookWatchWindow.beaconCalls.length,
        1,
        "Blocked beacon writes must not reach the original beacon transport",
    );

    const instagramWindow = makeGhostPage({
        hostname: "www.instagram.com",
        pathname: "/reels/redacted/",
        href: "https://www.instagram.com/reels/redacted/",
    });

    assert.strictEqual(
        await fetchOutcomeAt(
            instagramWindow,
            "/api/graphql/",
            instagramReelsMediaGraphQL,
        ),
        "allowed",
        "Instagram reels/media GraphQL must not be swallowed as story seen traffic",
    );
}

async function testPrivacyWritesStillBlockWithRequestOrMediaContext() {
    const facebookMessagesWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/messages/requests",
        href: "https://www.facebook.com/messages/requests",
    });

    assert.strictEqual(
        await fetchOutcomeAt(
            facebookMessagesWindow,
            "/api/graphql/",
            messageRequestReadWatermarkMutation,
        ),
        "blocked",
        "Message-request read-watermark mutations must still be blocked",
    );

    assert.strictEqual(
        await fetchOutcomeAt(
            facebookMessagesWindow,
            "/api/graphql/",
            messageRequestReadWatermarkOperationMutation,
        ),
        "blocked",
        "Message-request read-watermark mutations with operationName JSON must still be blocked",
    );

    assert.strictEqual(
        await fetchOutcomeAt(
            facebookMessagesWindow,
            "/api/graphql/",
            messageRequestReadWatermarkDocIdWrite,
        ),
        "blocked",
        "Doc-id-only message-request read-watermark writes must not be treated as read-only request queries",
    );

    assert.strictEqual(
        await fetchOutcomeAt(
            facebookMessagesWindow,
            "/api/graphql/",
            messageRequestReadReceiptDocIdWrite,
        ),
        "blocked",
        "Doc-id-only message-request read_receipt writes must not be treated as read-only request queries",
    );

    assert.strictEqual(
        await fetchOutcomeAt(
            facebookMessagesWindow,
            "/api/graphql/",
            messageRequestMarkReadDocIdWrite,
        ),
        "blocked",
        "Doc-id-only message-request mark_read writes must not be treated as read-only request queries",
    );

    const facebookWatchWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/watch",
        href: "https://www.facebook.com/watch",
    });

    assert.strictEqual(
        await fetchOutcomeAt(
            facebookWatchWindow,
            "/api/graphql/",
            facebookVideoReadWatermarkMutation,
        ),
        "blocked",
        "Media/player fields must not allow real Messenger read-watermark writes",
    );

    assert.strictEqual(
        await fetchOutcomeAt(
            facebookWatchWindow,
            "https://scontent.xx.fbcdn.net/graphql",
            facebookVideoReadWatermarkMutation,
        ),
        "blocked",
        "Non-GET CDN-like URLs must not bypass privacy-write detection",
    );

    const instagramWindow = makeGhostPage({
        hostname: "www.instagram.com",
        pathname: "/stories/redacted/",
        href: "https://www.instagram.com/stories/redacted/",
    });

    assert.strictEqual(
        await fetchOutcomeAt(
            instagramWindow,
            "/api/graphql/",
            instagramStorySeenGraphQLWithDocId,
        ),
        "blocked",
        "Instagram doc_id GraphQL story seen writes must not bypass fallback privacy matching",
    );

    assert.strictEqual(
        await fetchOutcomeAt(
            instagramWindow,
            "/api/graphql/",
            instagramStorySeenMediaGraphQLWithDocId,
        ),
        "blocked",
        "Instagram story seen writes with media fields must not bypass through media/player allowlisting",
    );
}

(async () => {
    await testFacebookMobileStoryWebLiteSeenFramesAreExactScoped();
    await testVideoAdAndMediaTrafficIsAllowed();
    await testPrivacyWritesStillBlockWithRequestOrMediaContext();
    console.log("media and story regression tests passed");
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
