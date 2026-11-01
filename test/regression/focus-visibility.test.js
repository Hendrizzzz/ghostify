const assert = require("assert");

const {
    makeGhostPage,
    createRequestClickTarget,
} = require("../helpers/regression-harness");

function testFacebookWatchDoesNotSpoofFocus() {
    const cases = [
        [
            "www.facebook.com",
            "/watch",
            true,
            "Facebook Watch/video surfaces must keep native focus so ads and players can progress",
        ],
        [
            "www.facebook.com",
            "/",
            true,
            "General Facebook feed startup keeps a short native-focus loader grace",
        ],
        [
            "www.facebook.com",
            "/messages/t/redacted-thread",
            false,
            "Facebook messaging surfaces should still spoof focus for read privacy",
        ],
        [
            "www.facebook.com",
            "/messages/requests",
            true,
            "Facebook message-request inbox must keep native focus so requests hydrate",
        ],
        [
            "www.facebook.com",
            "/messages/requests/t/redacted-thread",
            true,
            "Facebook message-request threads must keep native focus so chats load",
        ],
        [
            "www.facebook.com",
            "/messages/message-requests",
            true,
            "Facebook message-request alias routes must keep native focus",
        ],
        [
            "www.facebook.com",
            "/messages/message_requests",
            true,
            "Facebook underscored message-request alias routes must keep native focus",
        ],
        [
            "www.fbsbx.com",
            "/maw_proxy_page/",
            false,
            "Facebook MAW proxy frames should spoof focus for read privacy",
        ],
        [
            "www.messenger.com",
            "/t/redacted-thread",
            false,
            "Messenger.com conversation routes should still spoof focus for read privacy",
        ],
        [
            "www.messenger.com",
            "/requests",
            true,
            "Messenger.com request inbox must keep native focus so requests hydrate",
        ],
        [
            "www.messenger.com",
            "/requests/t/redacted-thread",
            true,
            "Messenger.com message-request conversation routes must keep native focus so chats load",
        ],
        [
            "www.messenger.com",
            "/message-requests/t/redacted-thread",
            true,
            "Messenger.com message-request alias routes must keep native focus",
        ],
        [
            "www.messenger.com",
            "/message_requests/t/redacted-thread",
            true,
            "Messenger.com underscored message-request alias routes must keep native focus",
        ],
        [
            "www.messenger.com",
            "/t/redacted-thread?folder=message_requests",
            true,
            "Messenger.com query-routed message requests must keep native focus",
        ],
        [
            "www.messenger.com",
            "/t/redacted-thread#/message_requests",
            true,
            "Messenger.com hash-routed message requests must keep native focus",
        ],
    ];

    for (const [hostname, route, expectedFocus, message] of cases) {
        const [pathnameAndSearch, hash = ""] = route.split("#");
        const [pathname, search = ""] = pathnameAndSearch.split("?");
        const formattedSearch = search ? `?${search}` : "";
        const formattedHash = hash ? `#${hash}` : "";
        const window = makeGhostPage({
            hostname,
            pathname,
            search: formattedSearch,
            hash: formattedHash,
            href: `https://${hostname}${pathname}${formattedSearch}${formattedHash}`,
        });

        assert.strictEqual(window.document.hasFocus(), expectedFocus, message);
        assert.strictEqual(
            window.document.visibilityState,
            "visible",
            `${message}: visibilityState should remain visible`,
        );
        assert.strictEqual(
            window.document.hidden,
            false,
            `${message}: document.hidden should remain false`,
        );
    }
}

function testFacebookFeedMessengerSurfacesSpoofFocusPassivelyForReadPrivacyAndLoaders() {
    const popoverWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMessengerPopoverOpen: true,
    });
    assert.strictEqual(
        popoverWindow.document.hasFocus(),
        false,
        "Facebook feed Messenger popover must report unfocused so an already-open chat does not send seen receipts",
    );
    assert.strictEqual(
        popoverWindow.document.visibilityState,
        "visible",
        "Facebook feed Messenger popover should keep native visibility so feed media and chat loaders can run",
    );
    assert.strictEqual(
        popoverWindow.document.hidden,
        false,
        "Facebook feed Messenger popover should not mark the whole feed hidden",
    );
    assert.strictEqual(
        countDeliveredFocusEvents(popoverWindow),
        4,
        "Facebook feed Messenger popover must not suppress focus events needed by mini-chat loaders",
    );

    const miniChatWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatOpen: true,
    });
    assert.strictEqual(
        miniChatWindow.document.hasFocus(),
        false,
        "Facebook feed floating mini-chat must report unfocused while the purple header is open",
    );
    assert.strictEqual(
        miniChatWindow.document.visibilityState,
        "visible",
        "Facebook feed floating mini-chat should keep native visibility for chat history loaders",
    );
    assert.strictEqual(
        miniChatWindow.document.hidden,
        false,
        "Facebook feed floating mini-chat should not set document.hidden",
    );
    assert.strictEqual(
        countDeliveredFocusEvents(miniChatWindow),
        4,
        "Facebook feed floating mini-chat must still deliver focus events so old messages continue loading",
    );
}

function testFacebookFeedStartupKeepsNativeFocusBrieflyBeforePreloadedMiniChatDomExists() {
    const window = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });

    assert.strictEqual(
        window.document.hasFocus(),
        true,
        "Facebook feed startup must keep native focus briefly so the popover and restored chat can hydrate",
    );
    assert.strictEqual(
        window.document.visibilityState,
        "visible",
        "Facebook feed startup should keep native visibility so videos and chat history can load",
    );
    assert.strictEqual(window.document.hidden, false);
    assert.strictEqual(
        countDeliveredFocusEvents(window),
        4,
        "Facebook feed startup must still deliver focus events; only document.hasFocus is spoofed",
    );

    window.__GHOSTIFY_FACEBOOK_ROOT_NATIVE_UNTIL__ = Date.now() - 1;
    assert.strictEqual(
        window.document.hasFocus(),
        false,
        "Facebook feed startup grace must expire back to passive-unfocused privacy mode",
    );
}

function testFacebookRestoredMiniChatLoadingKeepsNativeFocusUntilHydrated() {
    const loadingWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatLoading: true,
    });

    assert.strictEqual(
        loadingWindow.document.hasFocus(),
        false,
        "Facebook restored mini-chat loading must stay passive-unfocused after conversation selection",
    );
    assert.strictEqual(
        loadingWindow.document.visibilityState,
        "visible",
        "Restored mini-chat loading should keep native visibility so the history loader can finish",
    );
    assert.strictEqual(loadingWindow.document.hidden, false);
    assert.strictEqual(
        countDeliveredFocusEvents(loadingWindow),
        4,
        "Restored mini-chat loading must still deliver focus events to Facebook loaders",
    );

    const hydratedWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatOpen: true,
    });
    assert.strictEqual(
        hydratedWindow.document.hasFocus(),
        false,
        "Facebook restored mini-chat must return to unfocused privacy mode after hydration",
    );
}

function testFacebookUnreadFeedMessageClicksKeepDocumentVisibleForThreadLoading() {
    const window = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMessengerPopoverOpen: true,
    });
    window.__GHOSTIFY_FACEBOOK_ROOT_NATIVE_UNTIL__ = Date.now() - 1;
    assert.strictEqual(
        window.document.visibilityState,
        "visible",
        "Facebook feed Messenger popover should stay visible before selecting an unread conversation",
    );
    assert.strictEqual(
        window.document.hasFocus(),
        false,
        "Idle Facebook feed Messenger popover should stay unfocused for read privacy",
    );

    window.document.dispatchEvent({
        type: "pointerdown",
        target: createRequestClickTarget({
            label: "Synthetic Contact Unread message: fixture 17 · 1m",
        }),
    });

    assert.strictEqual(
        window.document.visibilityState,
        "visible",
        "Opening an unread Facebook feed Messenger row must keep document visibility visible so history loads",
    );
    assert.strictEqual(window.document.hidden, false);
    assert.strictEqual(
        window.document.hasFocus(),
        false,
        "Opening a Facebook feed Messenger row must never report native focus",
    );
    assert.strictEqual(
        countDeliveredFocusEvents(window),
        4,
        "Opening a Facebook feed Messenger row must keep loader focus events flowing even while hasFocus is spoofed",
    );
    window.__GHOSTIFY_FACEBOOK_CHAT_OPEN_FOCUS_UNTIL__ = Date.now() + 4000;
    assert.strictEqual(
        window.document.hasFocus(),
        false,
        "legacy chat-open grace markers must no longer bypass unread protection",
    );
}

function testFacebookUnreadFeedMessageChildClicksKeepDocumentVisibleForThreadLoading() {
    const window = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMessengerPopoverOpen: true,
    });
    window.__GHOSTIFY_FACEBOOK_ROOT_NATIVE_UNTIL__ = Date.now() - 1;
    const row = {
        parentElement: null,
        innerText: "Synthetic Contact Unread message: fixture 18 · 1m",
        textContent: "Synthetic Contact Unread message: fixture 18 · 1m",
        getAttribute() {
            return "";
        },
        closest() {
            return this;
        },
    };
    const child = {
        parentElement: row,
        innerText: "",
        textContent: "",
        getAttribute() {
            return "";
        },
        closest() {
            return this;
        },
    };

    window.document.dispatchEvent({
        type: "pointerdown",
        target: child,
    });

    assert.strictEqual(
        window.document.visibilityState,
        "visible",
        "Unread child clicks must not hide the page because hidden visibility stalls old-message loading",
    );
    assert.strictEqual(window.document.hidden, false);
    assert.strictEqual(
        window.document.hasFocus(),
        false,
        "Unread child clicks must remain passive-unfocused while restored mini-chat hydration continues",
    );
    assert.strictEqual(
        countDeliveredFocusEvents(window),
        4,
        "Unread child clicks must not suppress focus events needed by history hydration",
    );
}

function testFacebookUnreadConversationClicksNeverGrantNativeFocusAfterLoaderGrace() {
    const startupWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
    });
    assert.strictEqual(
        startupWindow.document.hasFocus(),
        true,
        "startup may use native focus only during the bounded popover/restore loader grace",
    );

    const loadingWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatLoading: true,
    });
    assert.strictEqual(
        loadingWindow.document.hasFocus(),
        false,
        "restored mini-chat loading must not reopen native focus after a conversation click",
    );
    assert.strictEqual(loadingWindow.document.visibilityState, "visible");
    assert.strictEqual(countDeliveredFocusEvents(loadingWindow), 4);

    const clickWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMessengerPopoverOpen: true,
    });
    clickWindow.document.dispatchEvent({
        type: "pointerdown",
        target: createRequestClickTarget({ label: "Unread message: redacted" }),
    });
    assert.strictEqual(
        clickWindow.document.hasFocus(),
        false,
        "clicking a personal or group unread row must not open a native-focus read window",
    );
    assert.strictEqual(clickWindow.document.visibilityState, "visible");
    assert.strictEqual(countDeliveredFocusEvents(clickWindow), 4);
}

function testFacebookMessengerPopoverGetsLoaderOnlyFocusGrace() {
    const page = {
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatOpen: true,
        facebookMessengerPopoverOpen: false,
    };
    const window = makeGhostPage(page);
    window.__GHOSTIFY_FACEBOOK_ROOT_NATIVE_UNTIL__ = Date.now() - 1;
    assert.strictEqual(window.document.hasFocus(), false);

    window.document.dispatchEvent({
        type: "pointerdown",
        target: createRequestClickTarget({ label: "Messenger, 1 unread" }),
    });
    assert.strictEqual(
        window.document.hasFocus(),
        true,
        "the top Messenger button may report native focus only while its chat grid is absent",
    );
    assert.strictEqual(window.document.visibilityState, "visible");

    page.facebookMessengerPopoverOpen = true;
    assert.strictEqual(
        window.document.hasFocus(),
        false,
        "popover focus grace must end immediately when the Messenger grid hydrates",
    );

    window.document.dispatchEvent({
        type: "pointerdown",
        target: createRequestClickTarget({
            href: "/messages/t/redacted-thread/",
            label: "Unread message: redacted",
        }),
    });
    page.facebookMessengerPopoverOpen = false;
    assert.strictEqual(
        window.document.hasFocus(),
        false,
        "a conversation-row interaction must consume popover loader grace before the grid closes",
    );
}

function testInstagramMediaSurfacesDoNotSpoofFocus() {
    const cases = [
        [
            "/",
            "Instagram feed must keep native focus so in-feed videos and ads can play",
        ],
        [
            "/reels",
            "Instagram reels index must keep native focus so reels and ads can play",
        ],
        [
            "/reels/redacted/",
            "Instagram reels must keep native focus so reels and ads can play",
        ],
        [
            "/reel/redacted",
            "Instagram reel aliases without trailing slash must keep native focus so reels and ads can play",
        ],
        [
            "/reel/redacted/",
            "Instagram reel aliases must keep native focus so reels and ads can play",
        ],
        [
            "/p/redacted",
            "Instagram post media pages without trailing slash must keep native focus so videos can play",
        ],
        [
            "/p/redacted/",
            "Instagram post media pages must keep native focus so videos can play",
        ],
        ["/tv", "Instagram TV index must keep native focus so videos can play"],
        [
            "/tv/redacted",
            "Instagram TV media pages must keep native focus so videos can play",
        ],
        [
            "/explore",
            "Instagram explore index without trailing slash must keep native focus so videos can play",
        ],
        [
            "/explore/",
            "Instagram explore media pages must keep native focus so videos can play",
        ],
    ];

    for (const [pathname, message] of cases) {
        const window = makeGhostPage({
            hostname: "www.instagram.com",
            pathname,
            href: `https://www.instagram.com${pathname}`,
        });

        assert.strictEqual(window.document.hasFocus(), true, message);
        assert.strictEqual(
            window.document.visibilityState,
            "visible",
            `${message}: visibilityState should remain visible`,
        );
        assert.strictEqual(
            window.document.hidden,
            false,
            `${message}: document.hidden should remain false`,
        );
    }

    const spaWindow = makeGhostPage({
        hostname: "www.instagram.com",
        pathname: "/stories/redacted/",
        href: "https://www.instagram.com/stories/redacted/",
    });
    assert.strictEqual(
        spaWindow.document.hasFocus(),
        false,
        "Instagram stories should still spoof focus for story-view privacy",
    );
    spaWindow.location.pathname = "/reels/redacted/";
    spaWindow.location.href = "https://www.instagram.com/reels/redacted/";
    assert.strictEqual(
        spaWindow.document.hasFocus(),
        true,
        "Instagram SPA transition from stories into reels must restore native focus for video playback",
    );
}

function countDeliveredFocusEvents(window) {
    let delivered = 0;
    const listener = () => {
        delivered += 1;
    };

    window.addEventListener("focus", listener);
    window.addEventListener("blur", listener);
    window.document.addEventListener("focusin", listener);
    window.document.addEventListener("focusout", listener);

    window.dispatchEvent({ type: "focus", target: window });
    window.dispatchEvent({ type: "blur", target: window });
    window.document.dispatchEvent({ type: "focusin", target: window.document });
    window.document.dispatchEvent({
        type: "focusout",
        target: window.document,
    });

    return delivered;
}

function testMessageRequestRoutesDoNotSuppressFocusEvents() {
    const messengerThreadWindow = makeGhostPage({
        hostname: "www.messenger.com",
        pathname: "/t/redacted-thread",
        href: "https://www.messenger.com/t/redacted-thread",
    });
    assert.strictEqual(
        countDeliveredFocusEvents(messengerThreadWindow),
        0,
        "Messenger.com normal thread routes should suppress focus events for read privacy",
    );

    const messengerRequestWindow = makeGhostPage({
        hostname: "www.messenger.com",
        pathname: "/t/redacted-thread",
        search: "?folder=message_requests",
        href: "https://www.messenger.com/t/redacted-thread?folder=message_requests",
    });
    assert.strictEqual(
        countDeliveredFocusEvents(messengerRequestWindow),
        4,
        "Messenger.com query-routed request routes must not suppress focus events needed by the request loader",
    );

    const facebookThreadWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/messages/t/redacted-thread",
        href: "https://www.facebook.com/messages/t/redacted-thread",
    });
    assert.strictEqual(
        countDeliveredFocusEvents(facebookThreadWindow),
        0,
        "Facebook normal message routes should suppress focus events for read privacy",
    );

    const facebookRequestWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/messages/requests/t/redacted-thread",
        href: "https://www.facebook.com/messages/requests/t/redacted-thread",
    });
    assert.strictEqual(
        countDeliveredFocusEvents(facebookRequestWindow),
        4,
        "Facebook request routes must not suppress focus events needed by the request loader",
    );

    for (const folder of [
        "pending_threads",
        "filtered_threads",
        "spam_threads",
    ]) {
        const facebookRequestAliasWindow = makeGhostPage({
            hostname: "www.facebook.com",
            pathname: "/messages/t/redacted-thread",
            search: `?folder=${folder}`,
            href: `https://www.facebook.com/messages/t/redacted-thread?folder=${folder}`,
        });
        assert.strictEqual(
            countDeliveredFocusEvents(facebookRequestAliasWindow),
            4,
            `Facebook ${folder} request alias routes must not suppress focus events needed by the request loader`,
        );
    }

    const facebookProxyWindow = makeGhostPage({
        hostname: "www.fbsbx.com",
        pathname: "/maw_proxy_page/",
        search: "?__cci=redacted",
        href: "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted",
    });
    assert.strictEqual(
        facebookProxyWindow.document.hasFocus(),
        false,
        "Facebook MAW proxy frames should still report unfocused for read privacy",
    );
    assert.strictEqual(
        facebookProxyWindow.document.visibilityState,
        "visible",
        "Facebook MAW proxy frames should keep native visibility so chat history can hydrate",
    );
    assert.strictEqual(facebookProxyWindow.document.hidden, false);
    assert.strictEqual(
        countDeliveredFocusEvents(facebookProxyWindow),
        4,
        "Facebook MAW proxy frames must pass focus events through so restored mini-chat history can hydrate",
    );
}

function testMawProxyRejectsUntrustedMessageRequestGrace() {
    const facebookProxyWindow = makeGhostPage({
        hostname: "www.fbsbx.com",
        pathname: "/maw_proxy_page/",
        search: "?__cci=redacted",
        href: "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted",
    });
    assert.strictEqual(
        facebookProxyWindow.document.hasFocus(),
        false,
        "Facebook MAW proxy frames should start spoofed on normal message surfaces",
    );

    let focusSignals = 0;
    facebookProxyWindow.addEventListener("focus", () => {
        focusSignals += 1;
    });
    facebookProxyWindow.document.addEventListener("visibilitychange", () => {
        focusSignals += 1;
    });
    facebookProxyWindow.document.addEventListener("focusin", () => {
        focusSignals += 1;
    });

    facebookProxyWindow.dispatchEvent({
        type: "message",
        data: {
            source: "GHOSTIFY_PAGE",
            type: "GHOSTIFY_MESSAGE_REQUEST_NATIVE_GRACE",
            until: Date.now() + 15000,
        },
    });

    assert.strictEqual(
        facebookProxyWindow.document.hasFocus(),
        false,
        "Facebook MAW proxy must ignore message-request grace without the extension nonce",
    );
    assert.strictEqual(
        focusSignals,
        0,
        "Facebook MAW proxy must not emit native focus signals for untrusted grace messages",
    );
}

function testMessageRequestSpaRouteChangesRestoreNativeFocus() {
    const messengerWindow = makeGhostPage({
        hostname: "www.messenger.com",
        pathname: "/t/redacted-thread",
        href: "https://www.messenger.com/t/redacted-thread",
    });
    assert.strictEqual(messengerWindow.document.hasFocus(), false);
    const deliveredBeforeRouteChange =
        countDeliveredFocusEvents(messengerWindow);
    assert.strictEqual(
        deliveredBeforeRouteChange,
        0,
        "Messenger listeners registered before a request route change should start suppressed on normal threads",
    );
    messengerWindow.location.pathname = "/requests/t/redacted-thread";
    messengerWindow.location.href =
        "https://www.messenger.com/requests/t/redacted-thread";
    assert.strictEqual(
        messengerWindow.document.hasFocus(),
        true,
        "Messenger SPA transition into request routes must restore native focus",
    );
    assert.strictEqual(
        countDeliveredFocusEvents(messengerWindow),
        4,
        "Messenger SPA transition into request routes must stop suppressing focus events",
    );

    const facebookWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/messages/t/redacted-thread",
        href: "https://www.facebook.com/messages/t/redacted-thread",
    });
    assert.strictEqual(facebookWindow.document.hasFocus(), false);
    const facebookDeliveredBeforeRouteChange =
        countDeliveredFocusEvents(facebookWindow);
    assert.strictEqual(
        facebookDeliveredBeforeRouteChange,
        0,
        "Facebook listeners registered before a request route change should start suppressed on normal threads",
    );
    facebookWindow.location.pathname = "/messages/requests/t/redacted-thread";
    facebookWindow.location.href =
        "https://www.facebook.com/messages/requests/t/redacted-thread";
    assert.strictEqual(
        facebookWindow.document.hasFocus(),
        true,
        "Facebook SPA transition into request routes must restore native focus",
    );
    assert.strictEqual(
        countDeliveredFocusEvents(facebookWindow),
        4,
        "Facebook SPA transition into request routes must stop suppressing focus events",
    );
}

function createNestedRequestClickTarget({
    parentHref = "",
    parentLabel = "",
    childLabel = "",
}) {
    const parent = createRequestClickTarget({
        href: parentHref,
        label: parentLabel,
    });
    const child = createRequestClickTarget({
        href: "",
        label: childLabel,
    });
    child.parentElement = parent;
    child.closest = function () {
        return this;
    };
    return child;
}

function createNestedConversationClickTargetWithRequestSibling({
    rowLabel = "",
    containerLabel = "",
}) {
    const container = createRequestClickTarget({
        href: "",
        label: containerLabel,
    });
    const row = createRequestClickTarget({
        href: "/messages/t/redacted-thread",
        label: rowLabel,
    });
    const child = createRequestClickTarget({
        href: "",
        label: "",
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
        hostname: "www.messenger.com",
        pathname: "/t/redacted-thread",
        href: "https://www.messenger.com/t/redacted-thread",
    });
    assert.strictEqual(messengerWindow.document.hasFocus(), false);
    let messengerFocusSignals = 0;
    messengerWindow.addEventListener("focus", () => {
        messengerFocusSignals += 1;
    });
    messengerWindow.document.addEventListener("visibilitychange", () => {
        messengerFocusSignals += 1;
    });
    messengerWindow.document.addEventListener("focusin", () => {
        messengerFocusSignals += 1;
    });
    messengerWindow.document.dispatchEvent({
        type: "pointerdown",
        target: createRequestClickTarget({
            href: "/requests/t/redacted-thread",
            label: "Requests · 3 unread",
        }),
    });
    assert.strictEqual(
        messengerWindow.document.hasFocus(),
        true,
        "Messenger request-link clicks must restore native focus before the SPA URL changes",
    );
    assert(
        messengerFocusSignals > 0,
        "Messenger request-link clicks must deliver native focus/visibility signals for the request loader",
    );
    assert(
        Number(messengerWindow.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ || 0) >
            Date.now(),
        "Messenger request-link clicks must open a short native transport grace window",
    );

    const facebookWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/messages/t/redacted-thread",
        href: "https://www.facebook.com/messages/t/redacted-thread",
    });
    assert.strictEqual(facebookWindow.document.hasFocus(), false);
    let facebookFocusSignals = 0;
    facebookWindow.addEventListener("focus", () => {
        facebookFocusSignals += 1;
    });
    facebookWindow.document.addEventListener("visibilitychange", () => {
        facebookFocusSignals += 1;
    });
    facebookWindow.document.addEventListener("focusin", () => {
        facebookFocusSignals += 1;
    });
    facebookWindow.document.dispatchEvent({
        type: "click",
        target: createRequestClickTarget({
            href: "",
            label: "Message requests",
        }),
    });
    assert.strictEqual(
        facebookWindow.document.hasFocus(),
        true,
        "Facebook message-request menu clicks must restore native focus before the SPA URL changes",
    );
    assert(
        facebookFocusSignals > 0,
        "Facebook message-request menu clicks must deliver native focus/visibility signals for the request loader",
    );
    assert(
        Number(facebookWindow.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ || 0) >
            Date.now(),
        "Facebook message-request menu clicks must open a short native transport grace window",
    );
}

function testFacebookNestedMessageRequestClicksTemporarilyRestoreNativeFocus() {
    const facebookWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/messages/t/redacted-thread",
        href: "https://www.facebook.com/messages/t/redacted-thread",
    });
    assert.strictEqual(facebookWindow.document.hasFocus(), false);
    let facebookFocusSignals = 0;
    facebookWindow.addEventListener("focus", () => {
        facebookFocusSignals += 1;
    });
    facebookWindow.document.addEventListener("visibilitychange", () => {
        facebookFocusSignals += 1;
    });
    facebookWindow.document.addEventListener("focusin", () => {
        facebookFocusSignals += 1;
    });

    facebookWindow.document.dispatchEvent({
        type: "click",
        target: createNestedRequestClickTarget({
            parentLabel:
                "New message requests From Synthetic Contact and others",
            childLabel: "",
        }),
    });

    assert.strictEqual(
        facebookWindow.document.hasFocus(),
        true,
        "Facebook nested New message requests clicks must restore native focus before the SPA URL changes",
    );
    assert(
        facebookFocusSignals > 0,
        "Facebook nested New message requests clicks must deliver native focus/visibility signals for the request loader",
    );
    assert(
        Number(facebookWindow.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ || 0) >
            Date.now(),
        "Facebook nested New message requests clicks must open a short native transport grace window",
    );
}

function testFacebookNormalConversationClicksDoNotInheritSiblingMessageRequestText() {
    const facebookWindow = makeGhostPage({
        hostname: "www.facebook.com",
        pathname: "/messages/t/redacted-thread",
        href: "https://www.facebook.com/messages/t/redacted-thread",
    });
    assert.strictEqual(facebookWindow.document.hasFocus(), false);
    let facebookFocusSignals = 0;
    facebookWindow.addEventListener("focus", () => {
        facebookFocusSignals += 1;
    });
    facebookWindow.document.addEventListener("visibilitychange", () => {
        facebookFocusSignals += 1;
    });
    facebookWindow.document.addEventListener("focusin", () => {
        facebookFocusSignals += 1;
    });

    facebookWindow.document.dispatchEvent({
        type: "click",
        target: createNestedConversationClickTargetWithRequestSibling({
            rowLabel: "Synthetic Contact You: thumbs up 2d",
            containerLabel:
                "New message requests From Synthetic Contact Synthetic Contact You: thumbs up 2d",
        }),
    });

    assert.strictEqual(
        facebookWindow.document.hasFocus(),
        false,
        "Normal Facebook conversation clicks must not inherit sibling Message requests text from a broad container",
    );
    assert.strictEqual(
        facebookFocusSignals,
        0,
        "Normal Facebook conversation clicks must not open request-loader focus grace from sibling request text",
    );
    assert.strictEqual(
        Number(facebookWindow.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ || 0) >
            Date.now(),
        false,
        "Normal Facebook conversation clicks must not activate message-request native grace",
    );
}

(async () => {
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
    console.log("focus and visibility regression tests passed");
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
