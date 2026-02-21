(() => {
    // src/config.js
    var SETTINGS = {
        msgSeen: true,
        igSeen: true,
        igTyping: true,
        igStory: false
    };
    var KILLED_FEATURES = /* @__PURE__ */ new Set();
    var hostname = window.location.hostname;
    var isFacebookDotCom = hostname.includes("facebook");
    var isMessengerDotCom = hostname.includes("messenger");
    var isMessenger = isFacebookDotCom || isMessengerDotCom;
    var isInstagram = hostname.includes("instagram");
    function isKilled(feature) {
        return KILLED_FEATURES.has(feature);
    }
    function isDebugMode() {
        return localStorage.getItem("GHOSTIFY_DEBUG") === "true";
    }

    // src/utils/network.js
    var PATTERNS = {
        igTyping: [],
        igSeen: [],
        igStory: [],
        msgTyping: [],
        msgSeen: [],
        msgStory: []
    };
    function updatePatterns(newPatterns) {
        PATTERNS = newPatterns;
    }
    function decode(data) {
        if (!data) return "";
        try {
            if (typeof data === "string") return data;
            if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
                return new TextDecoder().decode(data);
            }
            if (typeof URLSearchParams !== "undefined" && data instanceof URLSearchParams) {
                try {
                    return decodeURIComponent(data.toString());
                } catch (e) {
                    return data.toString();
                }
            }
            if (typeof FormData !== "undefined" && data instanceof FormData) {
                let text = "";
                for (const pair of data.entries()) {
                    if (typeof pair[1] === "string") text += pair[0] + "=" + pair[1] + "&";
                }
                return text;
            }
            if (typeof data === "object") return JSON.stringify(data);
        } catch (e) {
            return "";
        }
        return "";
    }
    function matchesPattern(str, patternList) {
        if (!patternList || !Array.isArray(patternList)) return false;
        return patternList.some((pattern) => {
            if (pattern.includes("|") || pattern.startsWith("^") || pattern.endsWith("$")) {
                try {
                    const regex = new RegExp(pattern, "i");
                    return regex.test(str);
                } catch (e) {
                    return false;
                }
            }
            return str.toLowerCase().includes(pattern.toLowerCase());
        });
    }
    function shouldBlock(data, url = "") {
        if (url.match(/\.(mp4|jpg|png|webp|gif|mp3|wav)$/i)) return null;
        const isLargePayload = data && data.byteLength && data.byteLength > 5e3;
        const str = isLargePayload ? (decode(data).substring(0, 15e3) + " " + url).toLowerCase() : (decode(data) + " " + url).toLowerCase();
        if (isDebugMode()) {
            if (str.includes("seen") || str.includes("read") || str.includes("typing") || str.includes("presence")) {
                console.groupCollapsed("\u{1F575}\uFE0F Ghostify Inspector");
                console.log("URL:", url);
                console.log("Payload:", str.substring(0, 5e3));
                console.groupEnd();
            }
        }
        if (isFacebookDotCom && !isLargePayload && str.length < 2e4) {
            if (url.includes("graphql")) {
                console.log("\u{1F47B} [NET-GQL] len=" + str.length + " | TAIL: " + str.substring(str.length - 800));
            } else if (str.includes("read") || str.includes("seen") || str.includes("mark") || str.includes("thread") || str.includes("label") || str.includes("watermark")) {
                console.log("\u{1F47B} [NET] " + (url ? url.substring(0, 80) : "WS") + " | " + str.substring(0, 400));
            }
        }
        if (isFacebookDotCom && SETTINGS.msgSeen && !isKilled("msgSeen") && url.includes("/api/graphql")) {
            if (str.includes("markthreadasread") || str.includes("mark_thread_read") || str.includes("markread") || str.includes("markseen") || str.includes("mark_read") || str.includes("mark_seen") || str.includes("read_watermark") || str.includes("last_read_watermark") || str.includes("read_receipt") || str.includes("act_thread_id") || str.includes("ebmessagemetadataquery")) {
                console.log("\u{1F6AB}\u{1F47B} [FB_GRAPHQL_SEEN] Blocked: " + str.substring(str.length - 200));
                return "FB_GRAPHQL_SEEN";
            }
        }
        if (isMessenger) {
            if (str.includes("delivery_receipt")) return null;
            if (SETTINGS.msgSeen && !isKilled("msgSeen")) {
                if (str.includes("messagelist_message_impression") || str.includes("verify_threads_activity_status") || str.includes("armadillo_thread_id") && str.includes("impression") || str.includes("in_thread_banner_fetch_activity_banners_queue") || str.includes("read_receipt")) {
                    return "MSG_SEEN";
                }
                if (str.includes("last_read_watermark_ts") && !str.includes("send_type")) {
                    return "MSG_SEEN";
                }
                if (matchesPattern(str, PATTERNS.msgSeen)) {
                    return "MSG_SEEN";
                }
            }
            if (SETTINGS.msgTyping && !isKilled("msgTyping") && matchesPattern(str, PATTERNS.msgTyping)) {
                return "MSG_TYPING";
            }
            if (SETTINGS.msgStory && !isKilled("msgStory") && matchesPattern(str, PATTERNS.msgStory)) {
                return "MSG_STORY";
            }
            return null;
        }
        if (isInstagram) {
            if (str.includes("cursor") || url.includes("cursor")) {
                return null;
            }
            if (str.includes("query_hash") || str.includes("doc_id") && !str.includes("mutation") && !str.includes("mark_seen") && !str.includes("mark_read") && !str.includes("thread_seen")) {
                return null;
            }
            if (isLargePayload && !str.includes("seen") && !str.includes("mark_read")) {
                return null;
            }
            if (SETTINGS.igTyping && !isKilled("igTyping") && matchesPattern(str, PATTERNS.igTyping)) {
                return "IG_TYPING";
            }
            if (SETTINGS.igStory && !isKilled("igStory") && matchesPattern(str, PATTERNS.igStory)) {
                return "IG_STORY";
            }
            if (SETTINGS.igSeen && !isKilled("igSeen") && matchesPattern(str, PATTERNS.igSeen)) {
                return "IG_SEEN";
            }
            return null;
        }
        return null;
    }

    // src/core/interceptors/websocket.js
    function hookWebSocket() {
        const OriginalWebSocket = window.WebSocket;
        const originalWSSend = OriginalWebSocket.prototype.send;
        function checkHardBlock(data) {
            if (!(isFacebookDotCom && SETTINGS.msgSeen && !isKilled("msgSeen"))) return false;
            try {
                const raw = data instanceof ArrayBuffer || ArrayBuffer.isView(data) ? new TextDecoder().decode(data) : typeof data === "string" ? data : "";
                if (raw.includes("read_receipt")) return true;
                if (raw.includes("last_read_watermark_ts") && !raw.includes("send_type")) return true;
            } catch (e) {
            }
            return false;
        }
        OriginalWebSocket.prototype.send = function (data) {
            if (checkHardBlock(data)) return;
            const blockType = shouldBlock(data);
            if (blockType) {
                console.log("\u{1F6AB}\u{1F47B} [" + blockType + "] WS Blocked");
                return;
            }
            return originalWSSend.apply(this, arguments);
        };
        window.WebSocket = function (url, protocols) {
            const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
            const boundSend = ws.send.bind(ws);
            ws.send = function (data) {
                if (checkHardBlock(data)) return;
                const blockType = shouldBlock(data);
                if (blockType) {
                    console.log("\u{1F6AB}\u{1F47B} [" + blockType + "] WS Blocked");
                    return;
                }
                return boundSend(data);
            };
            return ws;
        };
        window.WebSocket.prototype = OriginalWebSocket.prototype;
        Object.assign(window.WebSocket, OriginalWebSocket);
    }

    // src/core/interceptors/fetch.js
    function hookFetch() {
        const originalFetch = window.fetch;
        window.fetch = async function (input, init) {
            const url = typeof input === "string" ? input : (input == null ? void 0 : input.url) || "";
            const body = (init == null ? void 0 : init.body) || "";
            if (isFacebookDotCom && SETTINGS.msgSeen && !isKilled("msgSeen")) {
                const finalUrl = url.toLowerCase();
                const finalBody = (typeof body === "string" ? body : JSON.stringify(body || {})).toLowerCase();
                if (finalUrl.includes("ebmessagemetadataquery") || finalBody.includes("ebmessagemetadataquery")) {
                    console.log(`\u{1F6AB}\u{1F47B} [HARD BLOCK FB_GRAPHQL_SEEN] Fetch Dropped!`);
                    return new Response('{"data":{"ebmessagemetadataquery":null}}', {
                        status: 200,
                        headers: { "Content-Type": "application/json" }
                    });
                }
            }
            const blockType = shouldBlock(body, url);
            if (blockType) {
                if (isDebugMode()) console.log(`\u{1F6AB} [${blockType}] Fetch Blocked`);
                return new Response('{"status":"ok"}', {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                });
            }
            return originalFetch.apply(this, arguments);
        };
        const originalBeacon = navigator.sendBeacon;
        navigator.sendBeacon = function (url, data) {
            const blockType = shouldBlock(data, url);
            if (blockType) {
                if (isDebugMode()) console.log(`\u{1F6AB} [${blockType}] Beacon Blocked`);
                return true;
            }
            return originalBeacon.apply(this, arguments);
        };
    }

    // src/core/interceptors/xhr.js
    function hookXHR() {
        const originalXhrOpen = XMLHttpRequest.prototype.open;
        const originalXhrSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function (method, url) {
            this._ghostifyUrl = url;
            return originalXhrOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function (body) {
            const url = (this._ghostifyUrl || "").toLowerCase();
            const finalBody = (typeof body === "string" ? body : JSON.stringify(body || {})).toLowerCase();
            if (isFacebookDotCom && SETTINGS.msgSeen && !isKilled("msgSeen")) {
                if (url.includes("ebmessagemetadataquery") || finalBody.includes("ebmessagemetadataquery")) {
                    console.log(`\u{1F6AB}\u{1F47B} [HARD BLOCK FB_GRAPHQL_SEEN] XHR Dropped!`);
                    return;
                }
            }
            const blockType = shouldBlock(body, this._ghostifyUrl || "");
            if (blockType) {
                if (isDebugMode()) console.log(`\u{1F6AB} [${blockType}] XHR Blocked`);
                return;
            }
            return originalXhrSend.apply(this, arguments);
        };
    }

    // src/platforms/facebook.js
    var inVideoArea = false;
    var isAnyVideoPlaying = false;
    var inChatHover = false;
    var allowFocusUntil = 0;
    var lastSpoofLog = 0;
    function startFacebookProtection() {
        if (!isFacebookDotCom) return;
        setInterval(() => {
            if (!SETTINGS.msgSeen || isKilled("msgSeen")) return;
            let playing = false;
            const videos = document.getElementsByTagName("video");
            for (let i = 0; i < videos.length; i++) {
                if (!videos[i].paused && !videos[i].ended && videos[i].currentTime > 0) {
                    playing = true;
                    break;
                }
            }
            isAnyVideoPlaying = playing;
        }, 200);
        const originalPlay = window.HTMLMediaElement.prototype.play;
        window.HTMLMediaElement.prototype.play = function () {
            if (SETTINGS.msgSeen && !isKilled("msgSeen")) {
                isAnyVideoPlaying = true;
                allowFocusUntil = Date.now() + 1500;
            }
            return originalPlay.apply(this, arguments);
        };
        const trackInteraction = (e) => {
            if (!SETTINGS.msgSeen || isKilled("msgSeen")) return;
            let path = e.composedPath ? e.composedPath() : [];
            let hoveringVid = false;
            let hoveringChat = false;
            for (let i = 0; i < path.length; i++) {
                let el = path[i];
                if (el.nodeType === 1) {
                    if (!hoveringVid && (el.tagName === "VIDEO" || el.getAttribute("data-video-id"))) {
                        hoveringVid = true;
                    }
                    if (!hoveringChat) {
                        let style = window.getComputedStyle(el);
                        if (style.position === "fixed" && el.getBoundingClientRect().top > window.innerHeight / 2 && el.getBoundingClientRect().width < 450) {
                            hoveringChat = true;
                        }
                        let dataPagelet = el.getAttribute("data-pagelet");
                        let role = el.getAttribute("role");
                        let ariaLabel = el.getAttribute("aria-label");
                        let dataTestid = el.getAttribute("data-testid");
                        if (dataPagelet && (dataPagelet.includes("Chat") || dataPagelet.includes("MWJewel") || dataPagelet.includes("Messenger"))) {
                            hoveringChat = true;
                        }
                        if (role === "dialog" || role === "complementary" || role === "button") {
                            if (ariaLabel && (ariaLabel.includes("Messenger") || ariaLabel.includes("Chat") || ariaLabel.includes("conversation"))) {
                                hoveringChat = true;
                            }
                        }
                        if (dataTestid && dataTestid.includes("messenger")) {
                            hoveringChat = true;
                        }
                    }
                }
            }
            if (!hoveringVid && !hoveringChat) {
                const videos = document.getElementsByTagName("video");
                for (let i = 0; i < videos.length; i++) {
                    const vid = videos[i];
                    let container = vid;
                    for (let j = 0; j < 4; j++) {
                        if (container.parentElement) container = container.parentElement;
                    }
                    const rect = container.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        if (e.clientX >= rect.left - 150 && e.clientX <= rect.right + 150 && e.clientY >= rect.top - 150 && e.clientY <= rect.bottom + 150) {
                            hoveringVid = true;
                            break;
                        }
                    }
                }
            }
            inVideoArea = hoveringVid;
            inChatHover = hoveringVid ? false : hoveringChat;
            if (e.type === "mousedown") {
                if (hoveringVid || !hoveringChat) {
                    allowFocusUntil = Date.now() + 1500;
                } else {
                    allowFocusUntil = 0;
                }
            }
        };
        window.addEventListener("mouseover", trackInteraction, { capture: true, passive: true });
        window.addEventListener("mousedown", trackInteraction, { capture: true, passive: true });
    }
    function isFacebookChatFocused() {
        if (inChatHover) return true;
        if (window.location.pathname.startsWith("/messages")) return true;
        let el = document.activeElement;
        while (el) {
            if (el.nodeType === 1) {
                let style = window.getComputedStyle(el);
                if (style.position === "fixed" && el.getBoundingClientRect().top > window.innerHeight / 2 && el.getBoundingClientRect().width < 450) return true;
                let dataPagelet = el.getAttribute("data-pagelet");
                let ariaLabel = el.getAttribute("aria-label");
                if (dataPagelet && (dataPagelet.includes("Chat") || dataPagelet.includes("MWJewel") || dataPagelet.includes("Messenger"))) return true;
                let role = el.getAttribute("role");
                if (role === "dialog" || role === "complementary") {
                    if (ariaLabel && (ariaLabel.includes("Messenger") || ariaLabel.includes("Chat") || ariaLabel.includes("conversation"))) return true;
                }
            }
            el = el.parentElement;
        }
        return false;
    }
    function getFacebookSpoofState() {
        if (!SETTINGS.msgSeen || isKilled("msgSeen")) return null;
        if (isFacebookChatFocused()) {
            allowFocusUntil = 0;
            const now2 = Date.now();
            if (now2 - lastSpoofLog > 3e3) {
                lastSpoofLog = now2;
                console.log("\u{1F47B} [SPOOF] facebook.com | ACTIVE (Chat Force)");
            }
            return "unfocused";
        }
        if (isAnyVideoPlaying || inVideoArea || Date.now() < allowFocusUntil) {
            return "video";
        }
        const now = Date.now();
        if (now - lastSpoofLog > 3e3) {
            lastSpoofLog = now;
            console.log("\u{1F47B} [SPOOF] facebook.com | ALWAYS ON (Default Shield)");
        }
        return "unfocused";
    }

    // src/platforms/instagram.js
    var isScrolling = false;
    var scrollTimeout = null;
    function startInstagramProtection() {
        if (!isInstagram) return;
        window.addEventListener("scroll", () => {
            isScrolling = true;
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                isScrolling = false;
            }, 150);
        }, true);
    }
    function getInstagramSpoofState() {
        if (!SETTINGS.igSeen || isKilled("igSeen")) return null;
        if (isScrolling) {
            return false;
        }
        return "unfocused";
    }

    function getMessengerSpoofState() {
        if (isMessengerDotCom && SETTINGS.msgSeen && !isKilled("msgSeen")) {
            return "unfocused";
        }
        return null;
    }

    function shouldSpoofVisibility() {
        if (isMessengerDotCom) {
            const state = getMessengerSpoofState();
            if (state !== null) return state;
        }
        if (isFacebookDotCom) {
            const state = getFacebookSpoofState();
            if (state !== null) return state;
        }
        if (isInstagram) {
            const state = getInstagramSpoofState();
            if (state !== null) return state;
        }
        return false;
    }
    function hookVisibility() {
        const originalHasFocus = document.hasFocus.bind(document);
        Object.defineProperty(document, "hasFocus", {
            value: function () {
                const spoof = shouldSpoofVisibility();
                if (spoof === "hidden" || spoof === "unfocused") return false;
                return originalHasFocus();
            }
        });
        Object.defineProperty(document, "visibilityState", {
            get: function () {
                const spoof = shouldSpoofVisibility();
                if (spoof === "hidden") return "hidden";
                return "visible";
            }
        });
        Object.defineProperty(document, "hidden", {
            get: function () {
                const spoof = shouldSpoofVisibility();
                if (spoof === "hidden") return true;
                return false;
            }
        });
        const origAddEvt = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function (type, listener, opt) {
            if (["visibilitychange", "webkitvisibilitychange", "blur", "focus", "focusin", "focusout"].includes(type)) {
                const wrappedListener = function (e) {
                    const spoof = shouldSpoofVisibility();
                    if (spoof) {
                        if (spoof === "video") {
                            if (type === "blur" || type === "focus" || type === "focusin" || type === "focusout") {
                                if (this === window || this === document || e && (e.target === window || e.target === document)) {
                                    return;
                                }
                            }
                            return listener.call(this, e);
                        }
                        if (type === "blur" || type === "focus" || type === "focusin" || type === "focusout") {
                            if (this === window || this === document || e && (e.target === window || e.target === document)) {
                                if (isDebugMode()) console.log(`\u{1F47B} [EVENT BLOCK] ${type} on window/document swallowed.`);
                                return;
                            }
                        } else {
                            if (isDebugMode()) console.log(`\u{1F47B} [EVENT BLOCK] ${type} swallowed.`);
                            return;
                        }
                    }
                    return listener.call(this, e);
                };
                return origAddEvt.call(this, type, wrappedListener, opt);
            }
            return origAddEvt.call(this, type, listener, opt);
        };
    }

    (function () {
        "use strict";
        if (isMessenger) {
            if (navigator.serviceWorker) {
                navigator.serviceWorker.getRegistrations().then((regs) => {
                    regs.forEach((r) => r.unregister());
                });
                Object.defineProperty(navigator, "serviceWorker", {
                    value: {
                        register: () => new Promise(() => {
                        }),
                        getRegistrations: () => Promise.resolve([]),
                        ready: new Promise(() => {
                        })
                    }
                });
            }
        }
        window.addEventListener("message", (event) => {
            if (event.source !== window) return;
            if (event.data.type === "GHOSTIFY_CONFIG_UPDATE") {
                const CONFIG = event.data.config;
                updatePatterns(CONFIG.patterns);
                KILLED_FEATURES.clear();
                if (CONFIG.killSwitch) {
                    CONFIG.killSwitch.forEach((f) => KILLED_FEATURES.add(f));
                }
                if (isDebugMode()) console.log("\u{1F47B} Config Updated:", CONFIG);
            }
            if (event.data.type === "GHOSTIFY_SETTINGS_UPDATE") {
                Object.assign(SETTINGS, event.data.settings);
                if (isDebugMode()) console.log("\u{1F47B} Settings Updated:", SETTINGS);
            }
        });
        hookVisibility();
        hookWebSocket();
        hookFetch();
        hookXHR();
        startFacebookProtection();
        startInstagramProtection();
        console.log("\u{1F47B} Ghostify v2.0 Modular Core Active");
        if (isDebugMode()) {
            console.log("\u{1F47B} Ghostify Active - Debug Mode ON");
            console.log('   To disable: localStorage.removeItem("GHOSTIFY_DEBUG")');
        }
    })();
})();
