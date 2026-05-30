(() => {
  // src/messenger_patch.js
  (function() {
    "use strict";
    const hostname = window.location.hostname.toLowerCase();
    const isInstagram = isHost(hostname, "instagram.com");
    const isFacebookDotCom = isHost(hostname, "facebook.com");
    const isMessengerDotCom = isHost(hostname, "messenger.com");
    const isFacebookMessengerProxy = hostname === "www.fbsbx.com" && String(window.location.pathname || "").toLowerCase().startsWith("/maw_proxy_page");
    const isMessenger = isMessengerDotCom || isFacebookDotCom || isFacebookMessengerProxy;
    const settingsKey = "msgTyping";
    if (!isMessenger) return;
    if (window.__GHOSTIFY_LS_TYPING_PATCH__) return;
    window.__GHOSTIFY_LS_TYPING_PATCH__ = true;
    const DIAGNOSTIC_VERSION = "2026-05-23-instagram-direct-27";
    const SAFE_READ_WATERMARK_DIGIT = "1";
    const observeSalt = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const observeStartMs = Date.now();
    markPatchStatus("messenger_patch.init", {
      isMessenger,
      isMessengerDotCom,
      isFacebookDotCom,
      isFacebookMessengerProxy,
      readyState: document.readyState
    });
    if (isFacebookDotCom && !isMessengerDotCom && window.top !== window) {
      markPatchStatus("facebook.child_frame_reduced", { reason: "bridge_hooks_only" });
    }
    function isHost(host, domain) {
      return host === domain || host.endsWith(`.${domain}`);
    }
    const DEFAULT_SETTINGS = {
      igTyping: true,
      msgTyping: true,
      msgSeen: true
    };
    const OBSERVE_TERMS = [
      "sendtypingindicator",
      "lssendtypingindicator",
      "lssendtypingindicatorstoredprocedure",
      "sendchatstate",
      "send_chat_state",
      "sendchatstatefromcomposer",
      "mawsecuretypingstate",
      "securetypingstate",
      "typingindicatorstoredprocedure",
      "is_typing",
      "istyping",
      "typing_indicator",
      "typing_on",
      "send_typing",
      "send_typing_indicator",
      "thread_typing",
      "orca_typing_notifications",
      "indicate_activity",
      "activity_indicator",
      "composer",
      "markthreadasread",
      "mark_thread_read",
      "markthreadreadmutation",
      "markthreadread",
      "markread",
      "markasread",
      "mark_read",
      "markseen",
      "mark_seen",
      "thread_seen",
      "threadseen",
      "change_read_status",
      "updatelastseenat",
      "updatelastreadwatermark",
      "sendreadreceipt",
      "lssendreadreceipt",
      "readreceiptmutation",
      "readreceipt",
      "lsupdatethreadreadwatermark",
      "lsmarkthreadread",
      "mwmarkthreadread",
      "lsupdatelastreadwatermark",
      "last_read_watermark",
      "last_read_watermark_ts",
      "last_seen_time_ms",
      "read_watermark",
      "watermarktimestamp",
      "watermark_timestamp",
      "shouldsendreadreceipt",
      "seenbyviewer",
      "seen_by_viewer",
      "read_receipt",
      "delivery_receipt",
      "deliveryreceipt",
      "delivery_receipts",
      "message_delivered",
      "markdelivered",
      "ls_req",
      "issue_new_task",
      "issuenewtask",
      "thread_key",
      "thread_fbid",
      "thread_id",
      "recipient_id",
      "act_thread_id",
      "mqtt",
      "edge-chat"
    ];
    const killedFeatures = /* @__PURE__ */ new Set();
    let settingsReady = false;
    let messengerDotComHooksScheduled = false;
    let facebookSafeHooksScheduled = false;
    window.__GHOSTIFY_SETTINGS__ = Object.assign(
      {},
      DEFAULT_SETTINGS,
      window.__GHOSTIFY_SETTINGS__ || {}
    );
    window.addEventListener("message", (event) => {
      var _a;
      if (event.source !== window) return;
      if (!event.data || event.data.source !== "GHOSTIFY_EXTENSION") return;
      if (event.data.type === "GHOSTIFY_CONFIG_UPDATE") {
        killedFeatures.clear();
        if (Array.isArray((_a = event.data.config) == null ? void 0 : _a.killSwitch)) {
          event.data.config.killSwitch.forEach((feature) => {
            if (typeof feature === "string") killedFeatures.add(feature);
          });
        }
      }
      if (event.data.type === "GHOSTIFY_SETTINGS_UPDATE") {
        window.__GHOSTIFY_SETTINGS__ = Object.assign(
          {},
          DEFAULT_SETTINGS,
          event.data.settings || {}
        );
        settingsReady = true;
        markPatchStatus("messenger_patch.settings", {
          msgTyping: window.__GHOSTIFY_SETTINGS__.msgTyping,
          msgSeen: window.__GHOSTIFY_SETTINGS__.msgSeen
        });
        scheduleMessengerDotComHooks();
        scheduleFacebookSafeHooks();
      }
    });
    window.__ghostify_shouldBlockTyping = function() {
      var _a;
      return !!((_a = window.__GHOSTIFY_SETTINGS__) == null ? void 0 : _a[settingsKey]) && !killedFeatures.has(settingsKey);
    };
    window.__ghostify_shouldBlockMessengerTyping = window.__ghostify_shouldBlockTyping;
    window.__ghostify_shouldBlockMessengerSeen = function() {
      var _a;
      return isMessenger && !!((_a = window.__GHOSTIFY_SETTINGS__) == null ? void 0 : _a.msgSeen) && !killedFeatures.has("msgSeen");
    };
    window.postMessage({
      type: "GHOSTIFY_SETTINGS_REQUEST",
      source: "GHOSTIFY_PAGE"
    }, "*");
    function noopTypingResult() {
      return void 0;
    }
    function shouldBlockTypingPayload(payload) {
      const text = stringifyForMatch(payload).toLowerCase();
      return shouldBlockTypingText(text);
    }
    function shouldBlockTypingText(text) {
      if (!window.__ghostify_shouldBlockTyping()) return false;
      if (!text) return false;
      text = stripFalseyPrivacyFields(text);
      if ((isFacebookDotCom || isFacebookMessengerProxy) && !isMessengerDotCom) {
        return shouldBlockFacebookTypingText(text);
      }
      if (isMessengerTypingBridgeText(text)) return true;
      if (text.includes("sendtypingindicator") || text.includes("send_typing_indicator") || text.includes("send_typing") || text.includes("sendchatstate") || text.includes("send_chat_state") || text.includes("sendchatstatefromcomposer") || text.includes("typingindicatorstoredprocedure") || text.includes("typing_status") || text.includes("securetypingstate") || text.includes("mawsecuretypingstate") || text.includes("indicate_activity") || text.includes("activity_indicator")) {
        return hasOutgoingMessengerEnvelope(text) && hasMessengerThreadTarget(text);
      }
      const hasTypingState = text.includes("is_typing") || text.includes('"istyping"') || text.includes("typing_on") || text.includes("typing_indicator") || text.includes("typing_status") || text.includes("typingstate") || text.includes("is_composing") || text.includes("iscomposing") || text.includes("chatstate");
      if (!hasTypingState) return false;
      return hasOutgoingMessengerEnvelope(text) && (hasMessengerThreadTarget(text) || text.includes("typing_") || text.includes("msys"));
    }
    function isMessengerTypingBridgeText(text) {
      if (!isMessenger) return false;
      if (hasReadReceiptIntent(text)) return false;
      const hasExplicitTypingIntent = text.includes("sendchatstatefromcomposer") || text.includes("sendchatstate") || text.includes("send_chat_state") || text.includes("typingindicatorstoredprocedure") || text.includes("typing_status") || text.includes("securetypingstate") || text.includes("mawsecuretypingstate") || text.includes("sendtypingindicator") || text.includes("send_typing_indicator") || text.includes("send_typing");
      if (!hasExplicitTypingIntent) return false;
      return text.includes("composer") || text.includes("typing_indicator") || text.includes("chatstate") || text.includes("send_type") || text.includes("msys");
    }
    function shouldBlockSeenPayload(payload) {
      const text = stringifyForMatch(payload).toLowerCase();
      return shouldBlockSeenText(text);
    }
    function shouldBlockSeenText(text) {
      if (!window.__ghostify_shouldBlockMessengerSeen()) return false;
      if (!text) return false;
      text = stripFalseyPrivacyFields(text);
      if (isMessageRequestHydrationText(text)) return false;
      if ((isFacebookDotCom || isFacebookMessengerProxy) && !isMessengerDotCom) {
        return shouldBlockFacebookSeenText(text);
      }
      if (isMessengerSendWithBundledReadWatermarkText(text)) return false;
      if (isMessengerSeenBridgeText(text)) return true;
      if (text.includes("delivery_receipt") && !hasReadReceiptIntent(text) && !hasReadWatermarkTarget(text)) return false;
      return hasReadReceiptIntent(text) && hasReadReceiptWriteShape(text);
    }
    function shouldBlockFacebookTypingText(text) {
      if (isFacebookTypingBridgeCommand(text)) return true;
      if (!hasExplicitTypingWriteIntent(text)) return false;
      return hasFacebookMessengerWriteContext(text) && (hasMessengerThreadTarget(text) || text.includes("composer") || text.includes("typing_indicator") || text.includes("chatstate") || text.includes("typingstate") || text.includes("msys"));
    }
    function shouldBlockFacebookSeenText(text) {
      if (isMessageRequestHydrationText(text)) return false;
      if (isFacebookMessengerReadOnlyQueryText(text)) return false;
      if (text.includes("delivery_receipt") && !hasReadReceiptWriteIntent(text)) return false;
      if (isFacebookRealtimeReadReceiptTask(text)) return true;
      if (isFacebookLocalBridgeReadReceiptCommand(text)) return true;
      const hasWatermarkWrite = hasReadWatermarkTarget(text) && (text.includes("ls_req") || text.includes("issue_new_task") || text.includes("issuenewtask") || text.includes("storedprocedure") || text.includes("procedure") || text.includes("sendreadreceipt") || text.includes("readreceipt") || text.includes("markthread"));
      if (!hasExplicitSeenWriteIntent(text) && !hasWatermarkWrite) return false;
      return hasFacebookMessengerWriteContext(text) && (hasMessengerThreadTarget(text) || hasReadWatermarkTarget(text)) || hasStrictReadReceiptWriteCommand(text) && hasReadReceiptCommandTarget(text);
    }
    function hasExplicitTypingWriteIntent(text) {
      text = stripFalseyPrivacyFields(text);
      return includesAnyText(text, [
        "sendtypingindicator",
        "lssendtypingindicator",
        "lssendtypingindicatorstoredprocedure",
        "send_typing_indicator",
        "send_typing",
        "sendchatstatefromcomposer",
        "sendchatstate",
        "send_chat_state",
        "chat_state",
        "is_composing",
        "iscomposing",
        "composing",
        "typing_status",
        "typingindicatorstoredprocedure",
        "mawsecuretypingstate",
        "securetypingstate",
        "typingstate"
      ]);
    }
    function isFacebookTypingBridgeCommand(text) {
      if (!hasExplicitTypingWriteIntent(text)) return false;
      return includesAnyText(text, [
        "sendchatstatefromcomposer",
        "sendchatstate",
        "send_chat_state",
        "sendtypingindicator",
        "send_typing_indicator",
        "typingindicatorstoredprocedure",
        "typing_status",
        "mawsecuretypingstate",
        "securetypingstate"
      ]) && includesAnyText(text, [
        "composer",
        "chatstate",
        "typing_indicator",
        "typingstate",
        "typing_status",
        "send_type"
      ]);
    }
    function hasExplicitSeenWriteIntent(text) {
      text = stripFalseyPrivacyFields(text);
      return includesAnyText(text, [
        "markthreadasread",
        "mark_thread_read",
        "markthreadreadmutation",
        "lsmarkthreadread",
        "mwmarkthreadread",
        "lssendreadreceipt",
        "sendreadreceipt",
        "send_read_receipt",
        "readreceiptmutation",
        "lsupdatethreadreadwatermark",
        "lsupdatelastreadwatermark",
        "updatelastreadwatermark",
        "shouldsendreadreceipt",
        "should_send_read_receipt",
        "change_read_status"
      ]);
    }
    function isFacebookLocalBridgeReadReceiptCommand(text) {
      text = stripFalseyPrivacyFields(text);
      if (isFacebookMessengerReadOnlyQueryText(text)) return false;
      if (hasMessengerMessageSendIntentText(text)) return false;
      return includesAnyText(text, [
        "markthreadasread",
        "mark_thread_read",
        "markthreadreadmutation",
        "markthreadread",
        "lsmarkthreadread",
        "mwmarkthreadread",
        "markasread",
        "mark_as_read"
      ]) && includesAnyText(text, [
        "readreceipt",
        "read_receipt",
        "sendreadreceipt",
        "send_read_receipt",
        "shouldsendreadreceipt",
        "should_send_read_receipt"
      ]);
    }
    function includesAnyText(text, needles) {
      return needles.some((needle) => text.includes(needle));
    }
    const FALSEY_PRIVACY_FIELDS = [
      "shouldsendreadreceipt",
      "should_send_read_receipt",
      "sendreadreceipt",
      "send_read_receipt",
      "readreceipt",
      "read_receipt",
      "markread",
      "mark_read",
      "markseen",
      "mark_seen",
      "markasread",
      "mark_as_read",
      "threadseen",
      "thread_seen",
      "seenbyviewer",
      "seen_by_viewer",
      "istyping",
      "is_typing",
      "iscomposing",
      "is_composing",
      "typingindicator",
      "typing_indicator"
    ];
    function stripFalseyPrivacyFields(text) {
      const raw = String(text || "");
      const decoded = decodeMaybe(raw);
      return `${stripFalseyPrivacyFieldsOnce(raw)} ${decoded ? stripFalseyPrivacyFieldsOnce(decoded) : ""}`;
    }
    function stripFalseyPrivacyFieldsOnce(text) {
      let value = String(text || "");
      for (const field of FALSEY_PRIVACY_FIELDS) {
        const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        value = value.replace(
          new RegExp(`(^|[\\s"{,&?])${escaped}"?\\s*(?::|=)?\\s*(?:"?(?:false|0|null)"?)(?=$|[\\s,}&])`, "g"),
          " "
        );
        value = value.replace(
          new RegExp(`(?:%22|")?${escaped}(?:%22|")?\\s*(?:%3a|%3A|%3d|%3D|:|=)\\s*(?:%22|")?(?:false|0|null)(?:%22|")?`, "gi"),
          " "
        );
      }
      return value;
    }
    function isCurrentMessageRequestSurface() {
      var _a, _b, _c;
      let pathname = "";
      let search = "";
      let hash = "";
      try {
        pathname = String(((_a = window.location) == null ? void 0 : _a.pathname) || "").toLowerCase();
        search = String(((_b = window.location) == null ? void 0 : _b.search) || "").toLowerCase();
        hash = String(((_c = window.location) == null ? void 0 : _c.hash) || "").toLowerCase();
      } catch (e) {
        return false;
      }
      const route = `${pathname} ${search} ${hash}`;
      const hasRequestAlias = route.includes("folder=message_requests") || route.includes("message_requests") || route.includes("message-requests") || route.includes("pending_threads") || route.includes("filtered_threads") || route.includes("spam_threads");
      if (isMessengerDotCom) {
        return pathname.startsWith("/requests") || pathname.startsWith("/message-requests") || pathname.startsWith("/message_requests") || hasRequestAlias;
      }
      if (isFacebookDotCom) {
        return pathname.startsWith("/messages/requests") || pathname.startsWith("/messages/message-requests") || pathname.startsWith("/messages/message_requests") || hasRequestAlias;
      }
      return false;
    }
    function hasNativeMessageRequestBypass() {
      try {
        return Number(window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ || 0) > Date.now();
      } catch (e) {
        return false;
      }
    }
    function hasFacebookMessengerWriteContext(text) {
      return text.includes("/ls_req") || text.includes("ls_req") || text.includes("issue_new_task") || text.includes("issuenewtask") || text.includes("storedprocedure") || text.includes("procedure") || text.includes("mutation") || text.includes("payload") || text.includes("queue_name") || text.includes("messenger") || text.includes("mwchat") || text.includes("maw");
    }
    function isFacebookMessengerReadOnlyQueryText(text) {
      const friendlyName = getFacebookGraphQLFriendlyName(text);
      if (friendlyName && friendlyName.includes("query") && !friendlyName.includes("mutation")) return true;
      return text.includes("messagehistoryquery") || text.includes("threadlistquery") || text.includes("messagelistquery") || text.includes("searchmessengerquery") || text.includes("messagemetadataquery") || text.includes("messengerthreadquery") || text.includes("messengerthreadlistquery") || text.includes("messengerinboxquery");
    }
    function getFacebookGraphQLFriendlyName(text) {
      const match = String(text || "").match(/fb_api_req_friendly_name=([^&\s]+)/) || String(text || "").match(/"fb_api_req_friendly_name"\s*:\s*"([^"]+)/);
      return match ? String(match[1] || "").toLowerCase() : "";
    }
    function isMessengerSeenBridgeText(text) {
      if (!isMessenger) return false;
      if (text.includes("delivery_receipt") && !hasReadReceiptIntent(text) && !hasReadWatermarkTarget(text)) return false;
      const hasExplicitSeenIntent = hasReadReceiptWriteIntent(text);
      if (!hasExplicitSeenIntent) return false;
      return text.includes("markthread") || text.includes("markread") || text.includes("mark_read") || text.includes("markseen") || text.includes("mark_seen") || text.includes("markasread") || text.includes("readreceipt") || text.includes("read_receipt") || text.includes("readwatermark") || text.includes("read_watermark") || text.includes("lastreadwatermark") || text.includes("last_read_watermark") || text.includes("watermark") || text.includes("sendreadreceipt") || text.includes("lsmarkthreadread") || text.includes("lsupdatethreadreadwatermark") || text.includes("mwmarkthreadread") || text.includes("change_read_status");
    }
    function hasOutgoingMessengerEnvelope(text) {
      return text.includes("/ls_req") || text.includes("ls_req") || text.includes("issue_new_task") || text.includes("issuenewtask") || text.includes("storedprocedure") || text.includes("queue_name") || text.includes("payload");
    }
    function hasMessengerThreadTarget(text) {
      return text.includes("thread_key") || text.includes("threadkey") || text.includes("thread_fbid") || text.includes("threadfbid") || text.includes("thread_id") || text.includes("threadid") || text.includes("recipient_id") || text.includes("message_thread") || text.includes("act_thread_id");
    }
    function hasReadWatermarkTarget(text) {
      return text.includes("last_read_watermark") || text.includes("lastreadwatermark") || text.includes("last_read_watermark_ts") || text.includes("lastreadwatermarkts") || text.includes("read_watermark") || text.includes("readwatermark") || text.includes("last_seen_time_ms") || text.includes("lastseentimems") || text.includes("watermarktimestamp") || text.includes("watermark_timestamp") || text.includes("shouldsendreadreceipt") || text.includes("should_send_read_receipt");
    }
    function hasReadReceiptIntent(text) {
      return hasReadReceiptWriteIntent(text) || text.includes("last_read_watermark") || text.includes("lastreadwatermark") || text.includes("last_read_watermark_ts") || text.includes("lastreadwatermarkts") || text.includes("read_watermark") || text.includes("readwatermark") || text.includes("last_seen_time_ms") || text.includes("lastseentimems") || text.includes("watermarktimestamp") || text.includes("watermark_timestamp") || text.includes("seenbyviewer") || text.includes("seen_by_viewer");
    }
    function hasReadReceiptWriteIntent(text) {
      text = stripFalseyPrivacyFields(text);
      return hasStrictReadReceiptWriteCommand(text) || text.includes("readreceipt") || text.includes("read_receipt");
    }
    function hasTruthyBridgeField(text, fields) {
      return fields.some((field) => {
        const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(?:^|[&\\s"{,])${escaped}"?\\s*[:=]\\s*(?:"?(?:true|1)"?)`).test(text);
      });
    }
    function includesStandaloneBridgeTerm(text, terms) {
      return terms.some((term) => {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(?:^|[^a-z0-9_])${escaped}(?:$|[^a-z0-9_])`).test(text);
      });
    }
    function hasExplicitBridgeReadWriteCommand(text) {
      text = stripFalseyPrivacyFields(text);
      return text.includes("markthreadasread") || text.includes("mark_thread_read") || text.includes("markthreadreadmutation") || text.includes("markthreadread") || text.includes("lsmarkthreadread") || text.includes("mwmarkthreadread") || text.includes("lssendreadreceipt") || text.includes("readreceiptmutation") || text.includes("lsupdatethreadreadwatermark") || text.includes("lsupdatelastreadwatermark") || text.includes("updatelastreadwatermark") || text.includes("update_last_read_watermark") || text.includes("change_read_status") || includesStandaloneBridgeTerm(text, [
        "sendreadreceipt",
        "send_read_receipt"
      ]) || hasTruthyBridgeField(text, [
        "shouldsendreadreceipt",
        "should_send_read_receipt",
        "sendreadreceipt",
        "send_read_receipt",
        "readreceipt",
        "read_receipt",
        "markread",
        "mark_read",
        "markseen",
        "mark_seen",
        "markasread",
        "mark_as_read",
        "threadseen",
        "thread_seen",
        "seenbyviewer",
        "seen_by_viewer"
      ]);
    }
    function isMessageRequestHydrationText(text) {
      const hasRequestContext = hasMessageRequestContextText(text);
      if (!hasRequestContext) return false;
      if (hasExplicitBridgeReadWriteCommand(text)) return false;
      return hasMessageRequestHydrationShapeText(text);
    }
    function isLocalReadMessageRequestHydrationText(text) {
      return hasMessageRequestContextText(text) && hasMessageRequestHydrationShapeText(text);
    }
    function hasMessageRequestContextText(text) {
      return text.includes("message_requests") || text.includes("message request") || text.includes("message_request") || text.includes("messagerequests") || text.includes("message-requests") || text.includes("/requests") || text.includes("pending_threads") || text.includes("pendingthreads") || text.includes("filtered_threads") || text.includes("filteredthreads") || text.includes("spam_threads") || text.includes("spamthreads");
    }
    function hasMessageRequestHydrationShapeText(text) {
      return text.includes("fb_api_req_friendly_name") || text.includes("doc_id") || text.includes("ls_req") || text.includes("/ls_req") || text.includes("issue_new_task") || text.includes("issuenewtask") || text.includes("threadlist") || text.includes("thread_list") || text.includes("messagerequestsquery") || text.includes("routepreload") || text.includes("route_preload") || text.includes("fetch_thread_list") || text.includes("mwchat_fetch_thread_list") || text.includes("folder") || text.includes("pagination") || text.includes("cursor");
    }
    function hasStrictReadReceiptWriteCommand(text) {
      text = stripFalseyPrivacyFields(text);
      return hasServerReadReceiptCommand(text) || text.includes("markthreadasread") || text.includes("mark_thread_read") || text.includes("markthreadreadmutation") || text.includes("markthreadread") || text.includes("markread") || text.includes("mark_read") || text.includes("markseen") || text.includes("mark_seen") || text.includes("threadseen") || text.includes("thread_seen") || text.includes("markasread") || text.includes("change_read_status") || text.includes("updatelastseenat") || text.includes("updatelastreadwatermark") || text.includes("lsupdatethreadreadwatermark") || text.includes("lsmarkthreadread") || text.includes("mwmarkthreadread") || text.includes("lsupdatelastreadwatermark") || text.includes("shouldsendreadreceipt") || text.includes("should_send_read_receipt");
    }
    function hasServerReadReceiptCommand(text) {
      text = stripFalseyPrivacyFields(text);
      return text.includes("sendreadreceipt") || text.includes("lssendreadreceipt") || text.includes("readreceiptmutation") || text.includes("send_read_receipt") || text.includes("change_read_status") || text.includes("shouldsendreadreceipt") || text.includes("should_send_read_receipt");
    }
    function hasReadReceiptWriteShape(text) {
      return hasOutgoingMessengerEnvelope(text) && (hasMessengerThreadTarget(text) || hasReadWatermarkTarget(text));
    }
    function isMessengerSendWithBundledReadWatermarkText(text) {
      if (!text.includes("send_type")) return false;
      if (!hasReadWatermarkTarget(text)) return false;
      if (hasReadReceiptWriteIntent(text)) return false;
      return hasOutgoingMessengerEnvelope(text) && hasMessengerThreadTarget(text);
    }
    function hasReadReceiptCommandTarget(text) {
      return hasMessengerThreadTarget(text) || hasReadWatermarkTarget(text);
    }
    function isFacebookRealtimeReadReceiptTask(text) {
      return isFacebookReadWatermarkTask(text) || isFacebookLastSeenTask(text);
    }
    function isFacebookReadWatermarkTask(text) {
      return hasSerializedFieldValue(text, "label", "21") && (text.includes("last_read_watermark_ts") || text.includes("lastreadwatermarkts")) && hasMessengerThreadTarget(text);
    }
    function isFacebookLastSeenTask(text) {
      return hasSerializedFieldValue(text, "label", "6") && (text.includes("last_seen_time_ms") || text.includes("lastseentimems")) && (text.includes("parent_thread_key") || text.includes("parentthreadkey"));
    }
    function hasSerializedFieldValue(text, field, value) {
      const unescaped = String(text || "").replace(/\\/g, "");
      return includesAnyText(text, [
        `"${field}":"${value}"`,
        `"${field}": "${value}"`,
        `\\"${field}\\":\\"${value}\\"`,
        `\\"${field}\\": \\"${value}\\"`,
        `%22${field}%22%3a%22${value}%22`,
        `%22${field}%22%3A%22${value}%22`
      ]) || includesAnyText(unescaped, [
        `"${field}":"${value}"`,
        `"${field}": "${value}"`
      ]);
    }
    function stringifyForMatch(value, depth = 0) {
      if (depth > 4) return "";
      if (value === false || value === true || value === 0 || value === null) return String(value);
      if (!value) return "";
      try {
        if (typeof value === "string") {
          return `${value} ${decodeMaybe(value)}`;
        }
        if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
          const bytes = value instanceof ArrayBuffer ? value.slice(0, 12e3) : value.buffer.slice(value.byteOffset, value.byteOffset + Math.min(value.byteLength, 12e3));
          return new TextDecoder().decode(bytes);
        }
        if (Array.isArray(value)) {
          return value.map((item) => stringifyForMatch(item, depth + 1)).join(" ");
        }
        if (typeof value === "object") {
          let text = "";
          for (const key of Object.keys(value)) {
            text += ` ${key} ${stringifyForMatch(value[key], depth + 1)}`;
            if (text.length > 12e3) break;
          }
          return text;
        }
      } catch (e) {
      }
      return "";
    }
    function decodeMaybe(value) {
      try {
        return decodeURIComponent(String(value).replace(/\+/g, " "));
      } catch (e) {
        return "";
      }
    }
    function isPostMessageObservationEnabled() {
      var _a, _b;
      try {
        return ((_a = window.localStorage) == null ? void 0 : _a.ghostifyDebug) === "1" && ((_b = window.localStorage) == null ? void 0 : _b.ghostifyMessengerObserve) === "1";
      } catch (e) {
        return false;
      }
    }
    function markPatchStatus(name, details = {}) {
      var _a, _b;
      try {
        installPatchDebugHelpers();
        const status = window.__GHOSTIFY_STATUS__ || {
          version: DIAGNOSTIC_VERSION,
          host: window.location.hostname,
          hrefPath: "<redacted>",
          hooks: {}
        };
        status.version = DIAGNOSTIC_VERSION;
        status.host = window.location.hostname;
        status.debug = {
          ghostifyDebug: ((_a = window.localStorage) == null ? void 0 : _a.ghostifyDebug) === "1",
          ghostifyMessengerObserve: ((_b = window.localStorage) == null ? void 0 : _b.ghostifyMessengerObserve) === "1"
        };
        status.hooks[name] = Object.assign({ t: Math.round((Date.now() - observeStartMs) / 1e3) }, sanitizeStatusDetails(details));
        window.__GHOSTIFY_STATUS__ = status;
        tracePatchHealth(name, details);
      } catch (e) {
      }
    }
    function installPatchDebugHelpers() {
      try {
        if (window.__GHOSTIFY_CAPTURE_HELPERS__) return;
        window.__GHOSTIFY_CAPTURE_HELPERS__ = DIAGNOSTIC_VERSION;
        window.__GHOSTIFY_OBSERVATION_COUNTS__ = window.__GHOSTIFY_OBSERVATION_COUNTS__ || {};
        window.__GHOSTIFY_RESET_CAPTURE__ = function(phase = "baseline") {
          window.__GHOSTIFY_CAPTURE_PHASE__ = String(phase || "baseline").slice(0, 40);
          window.__GHOSTIFY_MESSENGER_OBSERVATIONS__ = [];
          window.__GHOSTIFY_DEBUG_EVENTS__ = [];
          window.__GHOSTIFY_OBSERVATION_COUNTS__ = {};
          window.__GHOSTIFY_BLOCKED_WORKER_MESSAGES__ = 0;
          window.__GHOSTIFY_SANITIZED_WORKER_MESSAGES__ = 0;
          window.__GHOSTIFY_FACEBOOK_UNSAFE_BLOCKS_SKIPPED__ = 0;
          window.__GHOSTIFY_MESSENGER_UNSAFE_BLOCKS_SKIPPED__ = 0;
          window.__GHOSTIFY_UNSAFE_TRANSFER_BLOCKS_SKIPPED__ = 0;
          window.__GHOSTIFY_BLOCKED_TYPING_EXPORT_CALLS__ = 0;
          window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ = 0;
          window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ = 0;
          pushPatchObservation(createPatchMarkerEvent(`reset:${window.__GHOSTIFY_CAPTURE_PHASE__}`));
          return `Ghostify capture reset: ${window.__GHOSTIFY_CAPTURE_PHASE__}`;
        };
        window.__GHOSTIFY_MARK__ = function(phase) {
          window.__GHOSTIFY_CAPTURE_PHASE__ = String(phase || "mark").slice(0, 40);
          pushPatchObservation(createPatchMarkerEvent(window.__GHOSTIFY_CAPTURE_PHASE__));
          return `Ghostify phase: ${window.__GHOSTIFY_CAPTURE_PHASE__}`;
        };
        window.__GHOSTIFY_REPORT__ = function() {
          return JSON.stringify({
            status: window.__GHOSTIFY_STATUS__,
            phase: getPatchCapturePhase(),
            observations: window.__GHOSTIFY_MESSENGER_OBSERVATIONS__ || [],
            observationCounts: window.__GHOSTIFY_OBSERVATION_COUNTS__ || {},
            debugEvents: window.__GHOSTIFY_DEBUG_EVENTS__ || [],
            blockedWorkerMessages: window.__GHOSTIFY_BLOCKED_WORKER_MESSAGES__ || 0,
            sanitizedWorkerMessages: window.__GHOSTIFY_SANITIZED_WORKER_MESSAGES__ || 0,
            facebookUnsafeBlocksSkipped: window.__GHOSTIFY_FACEBOOK_UNSAFE_BLOCKS_SKIPPED__ || 0,
            blockedTypingExportCalls: window.__GHOSTIFY_BLOCKED_TYPING_EXPORT_CALLS__ || 0,
            blockedReadExportCalls: window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
            sanitizedReadExportCalls: window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
            settings: window.__GHOSTIFY_SETTINGS__
          }, null, 2);
        };
      } catch (e) {
      }
    }
    function createPatchMarkerEvent(label) {
      return {
        v: 1,
        t: Math.round((Date.now() - observeStartMs) / 1e3),
        phase: getPatchCapturePhase(),
        transport: "marker",
        action: "mark",
        blockType: null,
        featureGuess: "marker",
        label: String(label || "").slice(0, 80),
        redaction: {
          rawStored: false,
          idsHashed: true,
          pageSalted: true
        }
      };
    }
    function getPatchCapturePhase() {
      try {
        return String(window.__GHOSTIFY_CAPTURE_PHASE__ || "unmarked").slice(0, 40);
      } catch (e) {
        return "unmarked";
      }
    }
    function pushPatchObservation(event) {
      try {
        const events = window.__GHOSTIFY_MESSENGER_OBSERVATIONS__ || [];
        events.push(event);
        window.__GHOSTIFY_MESSENGER_OBSERVATIONS__ = events.slice(-200);
      } catch (e) {
      }
    }
    function tracePatchHealth(source, details = {}) {
      if (!isPostMessageObservationEnabled()) return;
      const event = {
        v: 1,
        t: Math.round((Date.now() - observeStartMs) / 1e3),
        phase: getPatchCapturePhase(),
        transport: "health",
        action: "hook",
        blockType: null,
        featureGuess: "health",
        source,
        details: sanitizeStatusDetails(details),
        redaction: {
          rawStored: false,
          idsHashed: true,
          pageSalted: true
        }
      };
      pushPatchObservation(event);
      try {
        console.debug("[Ghostify Messenger Observe]", event);
      } catch (e) {
      }
    }
    function sanitizeStatusDetails(details) {
      const output = {};
      if (!details || typeof details !== "object") return output;
      for (const [key, value] of Object.entries(details)) {
        if (value == null || typeof value === "boolean" || typeof value === "number") {
          output[key] = value;
        } else {
          output[key] = String(value).slice(0, 80);
        }
      }
      return output;
    }
    function tracePostMessageObservation(kind, message, blockType, text) {
      if (!isPostMessageObservationEnabled()) return;
      const haystack = String(text || "").toLowerCase();
      const terms = OBSERVE_TERMS.filter((term) => haystack.includes(term));
      if (!blockType && !terms.length && !haystack) return;
      const dataShape = describePostMessageShape(message, haystack);
      const phase = getPatchCapturePhase();
      if (shouldThrottlePostMessageNearMiss(kind, blockType, terms, dataShape, phase)) return;
      const event = {
        v: 1,
        t: Math.round((Date.now() - observeStartMs) / 1e3),
        phase,
        transport: kind,
        action: blockType ? "drop" : terms.length ? "allow" : "near_miss",
        blockType,
        featureGuess: guessObservedFeature(haystack, blockType),
        terms,
        flags: observedFlags(haystack),
        dataShape,
        callSite: getPatchCallSite(),
        redaction: {
          rawStored: false,
          idsHashed: true,
          pageSalted: true
        }
      };
      pushPatchObservation(event);
      try {
        console.debug("[Ghostify Messenger Observe]", event);
      } catch (e) {
      }
    }
    function guessObservedFeature(haystack, blockType) {
      if (blockType) return blockType;
      if (haystack.includes("delivery_receipt")) return "delivery";
      if (haystack.includes("typing") || haystack.includes("sendchatstate") || haystack.includes("indicate_activity")) {
        return "typing";
      }
      if (haystack.includes("readreceipt") || haystack.includes("read_receipt") || haystack.includes("read_watermark") || haystack.includes("markthreadasread") || haystack.includes("markasread") || haystack.includes("mark_read") || haystack.includes("mark_seen") || haystack.includes("thread_seen")) {
        return "seen";
      }
      return "unknown";
    }
    function observedFlags(haystack) {
      return {
        hasLSRequest: haystack.includes("ls_req") || haystack.includes("issue_new_task") || haystack.includes("issuenewtask"),
        hasThreadTarget: haystack.includes("thread_key") || haystack.includes("threadkey") || haystack.includes("thread_fbid") || haystack.includes("threadfbid") || haystack.includes("thread_id") || haystack.includes("threadid") || haystack.includes("recipient_id") || haystack.includes("message_thread") || haystack.includes("act_thread_id"),
        hasWatermark: haystack.includes("read_watermark") || haystack.includes("readwatermark") || haystack.includes("last_read_watermark") || haystack.includes("lastreadwatermark") || haystack.includes("watermarktimestamp"),
        hasTypingState: haystack.includes("is_typing") || haystack.includes("istyping") || haystack.includes("typing_indicator") || haystack.includes("typing_status") || haystack.includes("typing_on") || haystack.includes("sendchatstate") || haystack.includes("chatstate"),
        hasDeliveryReceipt: haystack.includes("delivery_receipt"),
        hasReadReceipt: haystack.includes("readreceipt") || haystack.includes("read_receipt") || haystack.includes("sendreadreceipt") || haystack.includes("markthreadasread")
      };
    }
    function describePostMessageValue(value) {
      var _a;
      try {
        if (value == null) return String(value);
        if (typeof value !== "object") return typeof value;
        if (value instanceof ArrayBuffer) return "arraybuffer";
        if (ArrayBuffer.isView(value)) return ((_a = value.constructor) == null ? void 0 : _a.name) || "typedarray";
        if (Array.isArray(value)) return "array";
        return Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
      } catch (e) {
        return "uninspectable";
      }
    }
    function estimatePostMessageLength(value, text) {
      try {
        if (value == null) return 0;
        if (typeof value === "string") return value.length;
        if (value instanceof ArrayBuffer) return value.byteLength;
        if (ArrayBuffer.isView(value)) return value.byteLength;
        return String(text || "").length;
      } catch (e) {
        return 0;
      }
    }
    function describePostMessageShape(value, hashSource) {
      const shape = {
        kind: describePostMessageValue(value),
        approxBytes: estimatePostMessageLength(value, hashSource),
        hash: hashObservedText(hashSource)
      };
      try {
        if (value instanceof ArrayBuffer) {
          addPostMessageBinaryShape(shape, new Uint8Array(value));
        } else if (ArrayBuffer.isView(value)) {
          addPostMessageBinaryShape(shape, new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
        } else if (Array.isArray(value)) {
          shape.arrayLength = value.length;
          shape.itemKinds = value.slice(0, 8).map(describePostMessageValue);
        } else if (value && typeof value === "object") {
          let keyCount = 0;
          const keyHashes = [];
          for (const key of Object.keys(value)) {
            keyCount += 1;
            if (keyHashes.length < 8) keyHashes.push(hashObservedText(key));
          }
          shape.keyCount = keyCount;
          shape.keyHashes = keyHashes;
        }
      } catch (e) {
      }
      return shape;
    }
    function addPostMessageBinaryShape(shape, bytes) {
      shape.byteLength = bytes.byteLength;
      shape.prefix8Hash = hashObservedBytes(bytes, 8);
      shape.prefix32Hash = hashObservedBytes(bytes, 32);
    }
    function hashObservedBytes(bytes, limit) {
      let text = "";
      const length = Math.min(bytes.byteLength, limit);
      for (let i = 0; i < length; i++) {
        text += String.fromCharCode(bytes[i]);
      }
      return hashObservedText(text);
    }
    function shouldThrottlePostMessageNearMiss(kind, blockType, terms, dataShape, phase) {
      if (blockType || terms.length) return false;
      const key = [
        phase || "unmarked",
        kind,
        dataShape.kind,
        dataShape.approxBytes
      ].join("|");
      const counts = window.__GHOSTIFY_OBSERVATION_COUNTS__ || {};
      counts[key] = (counts[key] || 0) + 1;
      window.__GHOSTIFY_OBSERVATION_COUNTS__ = counts;
      return counts[key] > 5;
    }
    function getPatchCallSite() {
      try {
        const stack = new Error().stack;
        if (!stack) return [];
        return stack.split("\n").slice(3, 8).map(sanitizePatchStackLine).filter(Boolean);
      } catch (e) {
        return [];
      }
    }
    function sanitizePatchStackLine(line) {
      const value = String(line || "").trim();
      if (!value) return "";
      return value.replace(/https?:\/\/[^\s)]+/g, (match) => {
        try {
          const url = new URL(match);
          const file = url.pathname.split("/").filter(Boolean).pop() || url.hostname;
          return `${url.hostname}/${file}`;
        } catch (e) {
          return `url:${hashObservedText(match)}`;
        }
      }).slice(0, 180);
    }
    function hashObservedText(text) {
      const input = `${observeSalt}:${String(text || "")}`;
      let hash = 2166136261;
      for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16).padStart(8, "0");
    }
    function installPostMessageTypingBlockers() {
      markPatchStatus("postmessage.install", {
        hasWorker: typeof Worker !== "undefined",
        hasMessagePort: typeof MessagePort !== "undefined"
      });
      if (typeof Worker !== "undefined") wrapPostMessage(Worker.prototype, "worker.postMessage");
      if (typeof MessagePort !== "undefined") wrapPostMessage(MessagePort.prototype, "messageport.postMessage");
    }
    function scheduleMessengerDotComHooks() {
      if (!isMessengerDotCom || messengerDotComHooksScheduled || !settingsReady) return;
      messengerDotComHooksScheduled = true;
      installPostMessageTypingBlockers();
      window.__GHOSTIFY_MESSENGER_SAFE_HOOKS__ = true;
      markPatchStatus("messenger_dot_com.safe_hooks", {
        installed: true,
        bridgeOnly: true,
        moduleInterceptor: false
      });
    }
    function scheduleFacebookSafeHooks() {
      if (!isFacebookDotCom || isMessengerDotCom || facebookSafeHooksScheduled || !settingsReady) return;
      facebookSafeHooksScheduled = true;
      installPostMessageTypingBlockers();
      window.__GHOSTIFY_FACEBOOK_SAFE_HOOKS__ = true;
      markPatchStatus("facebook.safe_hooks", {
        installed: true,
        bridgeOnly: true,
        moduleInterceptor: false
      });
    }
    function wrapPostMessage(proto, kind) {
      if (!proto || typeof proto.postMessage !== "function" || proto.postMessage.__ghostifyTypingWrapped) return;
      const originalPostMessage = proto.postMessage;
      const wrapped = function(message, transfer) {
        const needsInspection = isPostMessageObservationEnabled() || window.__ghostify_shouldBlockTyping() || window.__ghostify_shouldBlockMessengerSeen();
        const text = needsInspection ? stringifyForMatch(message).toLowerCase() : "";
        if (hasNativeMessageRequestBypass() && isMessageRequestHydrationText(text)) {
          return originalPostMessage.apply(this, arguments);
        }
        const blockType = shouldBlockTypingText(text) ? "MSG_TYPING" : shouldBlockSeenText(text) ? "MSG_SEEN" : null;
        tracePostMessageObservation(kind, message, blockType, text);
        if (blockType) {
          if (blockType === "MSG_SEEN" && (isMessengerDotCom || isFacebookDotCom || isFacebookMessengerProxy)) {
            const sanitizedRealtimeSeen = sanitizeFacebookRealtimeReadReceiptBridgeMessage(message, text);
            if (sanitizedRealtimeSeen.changed) {
              const transferSafe = filterPostMessageTransfer(transfer, sanitizedRealtimeSeen.value);
              window.__GHOSTIFY_SANITIZED_SEEN_BRIDGE_MESSAGES__ = (window.__GHOSTIFY_SANITIZED_SEEN_BRIDGE_MESSAGES__ || 0) + 1;
              tracePostMessageOutcome(kind, blockType, "sanitize_realtime_seen", message, text);
              return forwardSanitizedPostMessage(originalPostMessage, this, sanitizedRealtimeSeen.value, transferSafe);
            }
            const sanitizedSeen = sanitizeSeenBridgeMessage(message);
            if (sanitizedSeen.changed) {
              if (sanitizedSeen.blockedAll) {
                window.__GHOSTIFY_BLOCKED_WORKER_MESSAGES__ = (window.__GHOSTIFY_BLOCKED_WORKER_MESSAGES__ || 0) + 1;
                tracePostMessageOutcome(kind, blockType, "drop_seen_command", message, text);
                return void 0;
              }
              if (!hasPostMessageTransfer(transfer)) {
                window.__GHOSTIFY_SANITIZED_SEEN_BRIDGE_MESSAGES__ = (window.__GHOSTIFY_SANITIZED_SEEN_BRIDGE_MESSAGES__ || 0) + 1;
                tracePostMessageOutcome(kind, blockType, "sanitize_seen", message, text);
                return originalPostMessage.call(this, sanitizedSeen.value);
              }
              const transferSafe = filterPostMessageTransfer(transfer, sanitizedSeen.value);
              window.__GHOSTIFY_SANITIZED_SEEN_BRIDGE_MESSAGES__ = (window.__GHOSTIFY_SANITIZED_SEEN_BRIDGE_MESSAGES__ || 0) + 1;
              tracePostMessageOutcome(kind, blockType, "sanitize_seen_transfer", message, text);
              return forwardSanitizedPostMessage(originalPostMessage, this, sanitizedSeen.value, transferSafe);
            }
          }
          if ((isFacebookDotCom || isFacebookMessengerProxy) && !isMessengerDotCom) {
            if (isSafeFacebookBridgeBlock(blockType, text)) {
              window.__GHOSTIFY_BLOCKED_WORKER_MESSAGES__ = (window.__GHOSTIFY_BLOCKED_WORKER_MESSAGES__ || 0) + 1;
              tracePostMessageOutcome(kind, blockType, "drop", message, text);
              return void 0;
            }
            window.__GHOSTIFY_FACEBOOK_UNSAFE_BLOCKS_SKIPPED__ = (window.__GHOSTIFY_FACEBOOK_UNSAFE_BLOCKS_SKIPPED__ || 0) + 1;
            tracePostMessageOutcome(kind, blockType, "unsafe_forward", message, text);
            return originalPostMessage.apply(this, arguments);
          }
          if (isMessengerDotCom) {
            if (blockType === "MSG_TYPING") {
              const sanitizedTyping = sanitizeBridgeMessage(message);
              if (sanitizedTyping.changed && !sanitizedTyping.blockedAll) {
                const transferSafe = filterPostMessageTransfer(transfer, sanitizedTyping.value);
                window.__GHOSTIFY_SANITIZED_WORKER_MESSAGES__ = (window.__GHOSTIFY_SANITIZED_WORKER_MESSAGES__ || 0) + 1;
                tracePostMessageOutcome(kind, blockType, "sanitize_typing", message, text);
                return forwardSanitizedPostMessage(originalPostMessage, this, sanitizedTyping.value, transferSafe);
              }
            }
            if (isSafeMessengerBridgeBlock(blockType, text)) {
              window.__GHOSTIFY_BLOCKED_WORKER_MESSAGES__ = (window.__GHOSTIFY_BLOCKED_WORKER_MESSAGES__ || 0) + 1;
              tracePostMessageOutcome(kind, blockType, "drop", message, text);
              return void 0;
            }
            window.__GHOSTIFY_MESSENGER_UNSAFE_BLOCKS_SKIPPED__ = (window.__GHOSTIFY_MESSENGER_UNSAFE_BLOCKS_SKIPPED__ || 0) + 1;
            tracePostMessageOutcome(kind, blockType, "unsafe_forward", message, text);
            return originalPostMessage.apply(this, arguments);
          }
          const sanitized = sanitizeBridgeMessage(message);
          if (sanitized.changed && !hasPostMessageTransfer(transfer)) {
            window.__GHOSTIFY_SANITIZED_WORKER_MESSAGES__ = (window.__GHOSTIFY_SANITIZED_WORKER_MESSAGES__ || 0) + 1;
            tracePostMessageOutcome(kind, blockType, "sanitize", message, text);
            return originalPostMessage.call(this, sanitized.value);
          }
          window.__GHOSTIFY_BLOCKED_WORKER_MESSAGES__ = (window.__GHOSTIFY_BLOCKED_WORKER_MESSAGES__ || 0) + 1;
          tracePostMessageOutcome(kind, blockType, "drop", message, text);
          return void 0;
        }
        return originalPostMessage.apply(this, arguments);
      };
      try {
        Object.defineProperty(wrapped, "__ghostifyTypingWrapped", {
          value: true,
          configurable: true
        });
      } catch (e) {
      }
      try {
        proto.postMessage = wrapped;
        markPatchStatus(`${kind}.hooked`, { ok: true });
      } catch (e) {
      }
    }
    function isSafeMessengerBridgeBlock(blockType, text) {
      if (blockType === "MSG_TYPING") {
        if (hasMessengerMessageSendIntentText(text)) return false;
        return isMessengerTypingBridgeText(text) || hasOutgoingMessengerEnvelope(text) && includesAnyText(text, ["sendchatstate", "send_chat_state", "sendtypingindicator", "typingindicatorstoredprocedure"]);
      }
      if (blockType === "MSG_SEEN") {
        if (hasMessengerMessageSendIntentText(text)) return false;
        return hasServerReadReceiptCommand(text) && (hasReadReceiptCommandTarget(text) || hasOutgoingMessengerEnvelope(text));
      }
      return false;
    }
    function isSafeFacebookBridgeBlock(blockType, text) {
      if (blockType === "MSG_TYPING") {
        return isFacebookTypingBridgeCommand(text) || hasExplicitTypingWriteIntent(text) && hasFacebookMessengerWriteContext(text) && (hasMessengerThreadTarget(text) || text.includes("composer") || text.includes("typing_indicator") || text.includes("chatstate") || text.includes("typingstate"));
      }
      if (blockType === "MSG_SEEN") {
        if (isFacebookRealtimeReadReceiptTask(text)) return true;
        return hasStrictReadReceiptWriteCommand(text) && !isFacebookMessengerReadOnlyQueryText(text) && (hasFacebookMessengerWriteContext(text) || hasReadReceiptCommandTarget(text) || hasOutgoingMessengerEnvelope(text));
      }
      return false;
    }
    function sanitizeFacebookRealtimeReadReceiptBridgeMessage(value, text) {
      if (!isFacebookDotCom || isMessengerDotCom || !isBinaryPayload(value)) {
        return { value, changed: false };
      }
      if (!isFacebookRealtimeReadReceiptTask(text)) {
        return { value, changed: false };
      }
      return sanitizeRealtimeReadReceiptBytes(value);
    }
    function sanitizeRealtimeReadReceiptBytes(value) {
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      const text = bytesToSingleByteString(bytes);
      const sanitizedText = text.replace(
        /(last_(?:read_watermark_ts|seen_time_ms)(?:\\*"?\s*[:=]\s*\\*"?))(\d{10,})/gi,
        (_match, prefix, digits) => `${prefix}${safeReadWatermarkDigits(digits.length)}`
      );
      if (sanitizedText === text) {
        return { value, changed: false };
      }
      const sanitizedBytes = singleByteStringToBytes(sanitizedText);
      if (value instanceof ArrayBuffer) {
        return { value: sanitizedBytes.buffer, changed: true };
      }
      return { value: sanitizedBytes, changed: true };
    }
    function safeReadWatermarkDigits(length) {
      return SAFE_READ_WATERMARK_DIGIT + "0".repeat(Math.max(0, Number(length || 1) - 1));
    }
    function bytesToSingleByteString(bytes) {
      let text = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        text += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      return text;
    }
    function singleByteStringToBytes(text) {
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i += 1) {
        bytes[i] = text.charCodeAt(i) & 255;
      }
      return bytes;
    }
    function sanitizeSeenBridgeMessage(value, depth = 0) {
      if (!value || depth > 8 || isBinaryPayload(value)) {
        return { value, changed: false, blockedAll: false };
      }
      if (typeof value === "string") {
        const text = `${value} ${decodeMaybe(value)}`.toLowerCase();
        const parsed = sanitizeStringifiedBridgeMessage(value, sanitizeSeenBridgeMessage);
        if (parsed.changed) return parsed;
        if (isDedicatedServerReadReceiptCommand(text)) {
          return { value: void 0, changed: true, blockedAll: true };
        }
        return { value, changed: false, blockedAll: false };
      }
      if (Array.isArray(value)) {
        let changed = false;
        const next = [];
        for (const item of value) {
          const itemText = stringifyForMatch(item).toLowerCase();
          if (depth > 0 && isDedicatedServerReadReceiptCommand(itemText)) {
            changed = true;
            continue;
          }
          const sanitizedItem = sanitizeSeenBridgeMessage(item, depth + 1);
          if (sanitizedItem.blockedAll) {
            changed = true;
            continue;
          }
          if (sanitizedItem.changed) {
            changed = true;
            next.push(sanitizedItem.value);
            continue;
          }
          if (isDedicatedServerReadReceiptCommand(itemText)) {
            changed = true;
            continue;
          }
          next.push(item);
        }
        return {
          value: changed ? next : value,
          changed,
          blockedAll: changed && next.length === 0
        };
      }
      if (typeof value === "object") {
        const ownText = stringifyForMatch(value).toLowerCase();
        if (isBridgeSendItemObject(value, ownText)) {
          return { value, changed: false, blockedAll: false };
        }
        let changed = false;
        const clone = {};
        for (const key of Object.keys(value)) {
          const child = value[key];
          const normalizedKey = normalizeBridgeKey(key);
          if (isReadReceiptSendFlagKey(normalizedKey)) {
            const truthy = isTruthyPrivacyValue(child);
            clone[key] = truthy ? false : child;
            changed = changed || truthy;
            continue;
          }
          if (isReadReceiptMutationKey(normalizedKey)) {
            const truthy = isTruthyPrivacyValue(child);
            clone[key] = truthy ? null : child;
            changed = changed || truthy;
            continue;
          }
          if (child && typeof child === "object" && !isBinaryPayload(child)) {
            const childText = stringifyForMatch(child).toLowerCase();
            if (isDedicatedServerReadReceiptCommand(childText)) {
              changed = true;
              continue;
            }
            const sanitizedChild = sanitizeSeenBridgeMessage(child, depth + 1);
            if (sanitizedChild.blockedAll) {
              changed = true;
              continue;
            }
            clone[key] = sanitizedChild.value;
            changed = changed || sanitizedChild.changed;
          } else {
            clone[key] = child;
          }
        }
        if (changed) {
          return {
            value: clone,
            changed: true,
            blockedAll: isBridgeEnvelopeMetadataOnly(clone)
          };
        }
        if (isDedicatedServerReadReceiptCommand(ownText)) {
          return { value: void 0, changed: true, blockedAll: true };
        }
      }
      return { value, changed: false, blockedAll: false };
    }
    function normalizeBridgeKey(key) {
      return String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    }
    function isReadReceiptSendFlagKey(key) {
      return key === "shouldsendreadreceipt" || key === "sendreadreceipt" || key === "sendreadreceipts" || key === "sendreadreceiptflag" || key === "readreceiptenabled";
    }
    function isReadReceiptMutationKey(key) {
      return key === "lssendreadreceipt" || key === "readreceiptmutation" || key === "sendreadreceiptmutation";
    }
    function isTruthyPrivacyValue(value) {
      if (value === true || value === 1) return true;
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return normalized === "true" || normalized === "1";
      }
      return !!(value && typeof value === "object");
    }
    function isDedicatedServerReadReceiptCommand(text) {
      if (!text || isFacebookMessengerReadOnlyQueryText(text)) return false;
      if (text.includes("delivery_receipt") && !hasDedicatedServerReadReceiptIntent(text)) return false;
      if (hasMessengerMessageSendIntentText(text)) return false;
      if (!hasDedicatedServerReadReceiptIntent(text)) return false;
      return hasReadReceiptCommandTarget(text) || hasOutgoingMessengerEnvelope(text) || hasFacebookMessengerWriteContext(text) || text.includes("thread") || text.includes("ls_req") || text.includes("issue_new_task") || text.includes("issuenewtask");
    }
    function hasDedicatedServerReadReceiptIntent(text) {
      text = stripFalseyPrivacyFields(text);
      return hasStrictReadReceiptWriteCommand(text) || hasExplicitBridgeReadWriteCommand(text) || text.includes("sendreadreceipt") || text.includes("lssendreadreceipt") || text.includes("readreceiptmutation") || text.includes("send_read_receipt") || text.includes("change_read_status");
    }
    function hasMessengerMessageSendIntentText(text) {
      if (!hasMessengerThreadTarget(text)) return false;
      const hasSendOperationName = includesAnyText(text, [
        "send_message",
        "sendmessage",
        "message_send",
        "messagesend",
        "messenger_send_message",
        "messengersendmessage",
        "sendmessagemutation",
        "messengersendmessagemutation"
      ]);
      const hasClientMessageId = includesAnyText(text, [
        "offline_threading_id",
        "offlinethreadingid",
        "client_message_id",
        "clientmessageid",
        "client_mutation_id",
        "clientmutationid",
        "otid"
      ]);
      const hasMessagePayload = includesAnyText(text, [
        '"message"',
        "%22message%22",
        "message:",
        "message=",
        '"text"',
        "%22text%22",
        "text:",
        "text=",
        "body",
        "attachment",
        "sticker",
        "media"
      ]);
      if (hasSendOperationName && (hasMessagePayload || hasClientMessageId || text.includes("send_type"))) return true;
      return text.includes("send_type") && hasClientMessageId && hasMessagePayload;
    }
    function tracePostMessageOutcome(kind, blockType, outcome, message, text) {
      if (!isPostMessageObservationEnabled() && !String(outcome || "").startsWith("drop")) return;
      const haystack = String(text || "").toLowerCase();
      const event = {
        v: 1,
        t: Math.round((Date.now() - observeStartMs) / 1e3),
        phase: getPatchCapturePhase(),
        transport: kind,
        action: outcome,
        blockType,
        featureGuess: blockType,
        redaction: {
          rawStored: false,
          idsHashed: true,
          pageSalted: true
        }
      };
      if (message !== void 0 || haystack) {
        event.terms = OBSERVE_TERMS.filter((term) => haystack.includes(term));
        event.flags = observedFlags(haystack);
        event.dataShape = describePostMessageShape(message, haystack);
        event.callSite = getPatchCallSite();
      }
      pushPatchObservation(event);
    }
    function sanitizeBridgeMessage(value, depth = 0) {
      if (!value || depth > 6 || isBinaryPayload(value)) {
        return { value, changed: false, blockedAll: false };
      }
      if (typeof value === "string") {
        const parsed = sanitizeStringifiedBridgeMessage(value, sanitizeBridgeMessage);
        if (parsed.changed) return parsed;
        const text = `${value} ${decodeMaybe(value)}`.toLowerCase();
        if (!hasMessengerMessageSendIntentText(text) && (shouldBlockTypingText(text) || shouldBlockSeenText(text))) {
          return { value: void 0, changed: true, blockedAll: true };
        }
        return { value, changed: false, blockedAll: false };
      }
      if (Array.isArray(value)) {
        let changed = false;
        const next = [];
        for (const item of value) {
          const itemText = stringifyForMatch(item).toLowerCase();
          if (!hasMessengerMessageSendIntentText(itemText) && (shouldBlockTypingText(itemText) || shouldBlockSeenText(itemText))) {
            changed = true;
            continue;
          }
          const sanitizedItem = sanitizeBridgeMessage(item, depth + 1);
          if (sanitizedItem.blockedAll) {
            changed = true;
            continue;
          }
          if (!sanitizedItem.changed) {
            if (!hasMessengerMessageSendIntentText(itemText) && (shouldBlockTypingText(itemText) || shouldBlockSeenText(itemText))) {
              changed = true;
              continue;
            }
          }
          changed = changed || sanitizedItem.changed;
          next.push(sanitizedItem.value);
        }
        return {
          value: changed ? next : value,
          changed,
          blockedAll: changed && next.length === 0
        };
      }
      if (typeof value === "object") {
        const ownText = stringifyForMatch(value).toLowerCase();
        if (isBridgeSendItemObject(value, ownText)) {
          return { value, changed: false, blockedAll: false };
        }
        let changed = false;
        let sawNestedContainer = false;
        const clone = Array.isArray(value) ? [] : {};
        for (const key of Object.keys(value)) {
          const child = value[key];
          if (child && typeof child === "object" && !isBinaryPayload(child)) {
            const childText = stringifyForMatch(child).toLowerCase();
            if (!hasMessengerMessageSendIntentText(childText) && (shouldBlockTypingText(childText) || shouldBlockSeenText(childText))) {
              changed = true;
              continue;
            }
            sawNestedContainer = true;
            const sanitizedChild = sanitizeBridgeMessage(child, depth + 1);
            if (sanitizedChild.blockedAll) {
              changed = true;
              continue;
            }
            clone[key] = sanitizedChild.value;
            changed = changed || sanitizedChild.changed;
          } else {
            clone[key] = child;
          }
        }
        if (changed) {
          return {
            value: clone,
            changed: true,
            blockedAll: isBridgeEnvelopeMetadataOnly(clone)
          };
        }
        if (!sawNestedContainer) {
          if (!hasMessengerMessageSendIntentText(ownText) && (shouldBlockTypingText(ownText) || shouldBlockSeenText(ownText))) {
            return { value: void 0, changed: true, blockedAll: true };
          }
        }
      }
      return { value, changed: false, blockedAll: false };
    }
    function isBridgeSendItemObject(value, text) {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      if (!hasMessengerMessageSendIntentText(text)) return false;
      const keys = Object.keys(value).map(normalizeBridgeKey);
      if (keys.includes("tasks") || keys.includes("tasklist") || keys.includes("batch")) return false;
      return keys.some((key) => [
        "label",
        "queuename",
        "queue",
        "payload",
        "sendtype",
        "offlinethreadingid",
        "clientmessageid",
        "clientmutationid",
        "otid",
        "message",
        "text",
        "body",
        "attachment",
        "sticker",
        "media",
        "threadkey",
        "threadfbid",
        "threadid",
        "recipientid"
      ].includes(key));
    }
    function isBridgeEnvelopeMetadataOnly(value) {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const keys = Object.keys(value);
      if (!keys.length) return true;
      return keys.every((key) => {
        const normalizedKey = normalizeBridgeKey(key);
        return normalizedKey === "issuenewtask" || normalizedKey === "requestid" || normalizedKey === "epochid" || normalizedKey === "source" || normalizedKey === "type";
      });
    }
    function sanitizeStringifiedBridgeMessage(value, sanitizer) {
      const trimmed = String(value || "").trim();
      if (!trimmed || trimmed[0] !== "{" && trimmed[0] !== "[") {
        return { value, changed: false, blockedAll: false };
      }
      try {
        const parsed = JSON.parse(trimmed);
        const sanitized = sanitizer(parsed, 0);
        if (!sanitized.changed) return { value, changed: false, blockedAll: false };
        return {
          value: sanitized.blockedAll ? void 0 : JSON.stringify(sanitized.value),
          changed: true,
          blockedAll: sanitized.blockedAll
        };
      } catch (e) {
        return { value, changed: false, blockedAll: false };
      }
    }
    function isBinaryPayload(value) {
      return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
    }
    function hasPostMessageTransfer(transfer) {
      if (!transfer) return false;
      if (Array.isArray(transfer)) return transfer.length > 0;
      if (typeof transfer === "object" && Array.isArray(transfer.transfer)) return transfer.transfer.length > 0;
      return false;
    }
    function filterPostMessageTransfer(transfer, value) {
      if (!hasPostMessageTransfer(transfer)) {
        return { hasTransfer: false, transfer: void 0 };
      }
      const originalList = Array.isArray(transfer) ? transfer : transfer.transfer;
      const filtered = originalList.filter((item) => containsTransferReference(value, item));
      if (!filtered.length) {
        return { hasTransfer: false, transfer: void 0 };
      }
      return {
        hasTransfer: true,
        transfer: Array.isArray(transfer) ? filtered : Object.assign({}, transfer, { transfer: filtered })
      };
    }
    function containsTransferReference(value, target, depth = 0, seen = /* @__PURE__ */ new Set()) {
      if (value === target) return true;
      if (!value || typeof value !== "object" || !target || depth > 8) return false;
      if (ArrayBuffer.isView(value) && value.buffer === target) return true;
      if (seen.has(value)) return false;
      seen.add(value);
      if (Array.isArray(value)) {
        return value.some((item) => containsTransferReference(item, target, depth + 1, seen));
      }
      try {
        return Object.keys(value).some((key) => containsTransferReference(value[key], target, depth + 1, seen));
      } catch (e) {
        return false;
      }
    }
    function forwardSanitizedPostMessage(originalPostMessage, target, value, transferSafe) {
      if (transferSafe && transferSafe.hasTransfer) {
        return originalPostMessage.call(target, value, transferSafe.transfer);
      }
      return originalPostMessage.call(target, value);
    }
    function wrapTypingFunction(fn) {
      if (typeof fn !== "function") return fn;
      if (fn.__ghostifyTypingWrapped) return fn;
      const wrapped = function(...args) {
        if (window.__ghostify_shouldBlockTyping()) {
          window.__GHOSTIFY_BLOCKED_TYPING_EXPORT_CALLS__ = (window.__GHOSTIFY_BLOCKED_TYPING_EXPORT_CALLS__ || 0) + 1;
          return noopTypingResult();
        }
        return fn.apply(this, args);
      };
      try {
        Object.defineProperty(wrapped, "__ghostifyTypingWrapped", {
          value: true,
          configurable: true
        });
      } catch (e) {
      }
      return wrapped;
    }
    function wrapTypingExport(value, allowDefault = false) {
      if (typeof value === "function") return wrapTypingFunction(value);
      if (!value || typeof value !== "object") return value;
      for (const key of Object.getOwnPropertyNames(value)) {
        if (typeof value[key] === "function" && (isTypingExportName(key, allowDefault) || isTypingExportName(value[key].name, allowDefault))) {
          try {
            value[key] = wrapTypingFunction(value[key]);
          } catch (e) {
          }
        }
      }
      return value;
    }
    function hasTypingExport(value) {
      if (typeof value === "function") return isTypingExportName(value.name);
      if (!value || typeof value !== "object") return false;
      return Object.getOwnPropertyNames(value).some((key) => {
        try {
          const candidate = value[key];
          return typeof candidate === "function" && (isTypingExportName(key) || isTypingExportName(candidate.name));
        } catch (e) {
          return false;
        }
      });
    }
    function wrapReadReceiptFunction(fn, mode = "block") {
      if (typeof fn !== "function") return fn;
      if (fn.__ghostifySeenWrapped) return fn;
      const wrapped = new Proxy(fn, {
        get(target, prop, receiver) {
          if (prop === "__ghostifySeenWrapped") return true;
          return Reflect.get(target, prop, receiver);
        },
        apply(target, thisArg, args) {
          if (window.__ghostify_shouldBlockMessengerSeen()) {
            if (mode === "sanitize") {
              const argsText = stringifyForMatch(args).toLowerCase();
              if (hasNativeMessageRequestBypass() || isCurrentMessageRequestSurface() || isLocalReadMessageRequestHydrationText(argsText)) {
                return Reflect.apply(target, thisArg, args);
              }
              const sanitizedArgs = sanitizeSeenBridgeMessage(args);
              if (sanitizedArgs.changed && Array.isArray(sanitizedArgs.value)) {
                window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ = (window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0) + 1;
                return Reflect.apply(target, thisArg, sanitizedArgs.value);
              }
            } else {
              window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ = (window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0) + 1;
              return noopTypingResult();
            }
          }
          return Reflect.apply(target, thisArg, args);
        }
      });
      return wrapped;
    }
    function wrapReadReceiptExport(value, allowDefault = false, mode = "block") {
      if (typeof value === "function") return wrapReadReceiptFunction(value, mode);
      if (!value || typeof value !== "object") return value;
      for (const key of Object.getOwnPropertyNames(value)) {
        if (typeof value[key] === "function" && (isReadReceiptExportName(key, allowDefault) || isReadReceiptExportName(value[key].name, allowDefault) || isLocalReadReceiptExportName(key, allowDefault) || isLocalReadReceiptExportName(value[key].name, allowDefault))) {
          try {
            const exportMode = isLocalReadReceiptExportName(key, allowDefault) || isLocalReadReceiptExportName(value[key].name, allowDefault) ? "sanitize" : mode;
            value[key] = wrapReadReceiptFunction(value[key], exportMode);
          } catch (e) {
          }
        }
      }
      return value;
    }
    function hasReadReceiptExport(value) {
      if (typeof value === "function") return isReadReceiptExportName(value.name);
      if (!value || typeof value !== "object") return false;
      return Object.getOwnPropertyNames(value).some((key) => {
        try {
          const candidate = value[key];
          return typeof candidate === "function" && (isReadReceiptExportName(key) || isReadReceiptExportName(candidate.name) || isLocalReadReceiptExportName(key) || isLocalReadReceiptExportName(candidate.name));
        } catch (e) {
          return false;
        }
      });
    }
    function hasLocalReadReceiptExport(value) {
      if (typeof value === "function") return isLocalReadReceiptExportName(value.name);
      if (!value || typeof value !== "object") return false;
      return Object.getOwnPropertyNames(value).some((key) => {
        try {
          const candidate = value[key];
          return typeof candidate === "function" && (isLocalReadReceiptExportName(key) || isLocalReadReceiptExportName(candidate.name));
        } catch (e) {
          return false;
        }
      });
    }
    function isTypingExportName(exportName, allowDefault = false) {
      const name = String(exportName || "").toLowerCase();
      return allowDefault && name === "default" || name.includes("sendtyping") || name.includes("send_typing") || name.includes("sendchatstate") || name.includes("send_chat_state") || name.includes("typingindicator");
    }
    function isTypingDependency(moduleName) {
      const name = String(moduleName || "").toLowerCase();
      return name.includes("sendchatstatefromcomposer") || name.includes("sendtypingindicator") || name.includes("send_typing_indicator") || name.includes("typingindicatorstoredprocedure") || name.includes("securetypingstate") || name.includes("sendchatstate") || name.includes("send_chat_state") || name.includes("typing") && name.includes("send");
    }
    function isReadReceiptExportName(exportName, allowDefault = false) {
      const name = String(exportName || "").toLowerCase();
      return allowDefault && name === "default" || name.includes("sendreadreceipt") || name.includes("send_read_receipt") || name.includes("lssendreadreceipt") || name.includes("readreceiptmutation");
    }
    function isLocalReadReceiptExportName(exportName, allowDefault = false) {
      const name = String(exportName || "").toLowerCase();
      return allowDefault && name === "default" || name.includes("markthreadread") || name.includes("markread") || name.includes("mark_read") || name.includes("markseen") || name.includes("mark_seen") || name.includes("markasread") || name.includes("readwatermark") || name.includes("read_watermark") || name.includes("lastreadwatermark") || name.includes("updatelastseenat") || name.includes("lsupdatethreadreadwatermark") || name.includes("lsmarkthreadread") || name.includes("mwmarkthreadread") || name.includes("lsupdatelastreadwatermark");
    }
    function isReadReceiptDependency(moduleName) {
      if (!isMessenger) return false;
      const name = String(moduleName || "").toLowerCase();
      return name.includes("sendreadreceipt") || name.includes("lssendreadreceipt") || name.includes("readreceiptmutation") || name.includes("send_read_receipt");
    }
    function isLocalReadReceiptDependency(moduleName) {
      if (!isMessenger) return false;
      const name = String(moduleName || "").toLowerCase();
      return name.includes("markthreadread") || name.includes("markread") || name.includes("mark_read") || name.includes("markseen") || name.includes("mark_seen") || name.includes("markasread") || name.includes("readwatermark") || name.includes("read_watermark") || name.includes("lastreadwatermark") || name.includes("updatelastseenat") || name.includes("lsupdatethreadreadwatermark") || name.includes("lsmarkthreadread") || name.includes("mwmarkthreadread") || name.includes("lsupdatelastreadwatermark");
    }
    function moduleNameMatches(moduleName, pattern) {
      return String(moduleName || "").toLowerCase().includes(String(pattern || "").toLowerCase());
    }
    const exportCallbacks = {};
    const factoryCallbacks = {};
    const processedModules = /* @__PURE__ */ new Set();
    function registerExportCallback(moduleName, callback) {
      exportCallbacks[moduleName] = exportCallbacks[moduleName] || [];
      exportCallbacks[moduleName].push(callback);
    }
    function registerFactoryCallback(moduleName, callback) {
      factoryCallbacks[moduleName] = factoryCallbacks[moduleName] || [];
      factoryCallbacks[moduleName].push(callback);
    }
    registerFactoryCallback("MAWSecureTypingState", (factoryArgs) => {
      wrapTypingRequire(factoryArgs, { inspectExports: true });
    });
    function wrapTypingRequire(factoryArgs, options = {}) {
      [1, 2, 3].forEach((index) => {
        const originalRequire = factoryArgs[index];
        if (typeof originalRequire !== "function") return;
        if (originalRequire.__ghostifyTypingRequireWrapped) return;
        factoryArgs[index] = function(moduleName) {
          const required = originalRequire.apply(this, arguments);
          let protectedExport = required;
          if (isTypingDependency(moduleName) || options.inspectExports && hasTypingExport(protectedExport)) {
            protectedExport = wrapTypingExport(protectedExport, isTypingDependency(moduleName));
          }
          const localReadReceiptRequire = isLocalReadReceiptDependency(moduleName) || options.inspectExports && hasLocalReadReceiptExport(protectedExport);
          if (shouldPatchReadReceiptModules() && (shouldPatchLocalReadReceiptModules() || !localReadReceiptRequire) && !shouldLeaveLocalReadReceiptModuleUnpatched(localReadReceiptRequire) && (isReadReceiptDependency(moduleName) || isLocalReadReceiptDependency(moduleName) || options.inspectExports && hasReadReceiptExport(protectedExport))) {
            protectedExport = wrapReadReceiptExport(
              protectedExport,
              isReadReceiptDependency(moduleName) || isLocalReadReceiptDependency(moduleName),
              isLocalReadReceiptDependency(moduleName) ? "sanitize" : "block"
            );
          }
          return protectedExport;
        };
        try {
          Object.defineProperty(factoryArgs[index], "__ghostifyTypingRequireWrapped", {
            value: true,
            configurable: true
          });
        } catch (e) {
        }
      });
    }
    function blockTypingExports(factoryArgs) {
      for (const candidate of factoryArgs) {
        if (!isPatchableExportContainer(candidate)) continue;
        if ("exports" in candidate) {
          try {
            candidate.exports = wrapTypingExport(candidate.exports, true);
          } catch (e) {
          }
        }
        wrapTypingExport(candidate, true);
      }
    }
    registerExportCallback("LSSendTypingIndicator", blockTypingExports);
    registerExportCallback("LSSendTypingIndicatorStoredProcedure", blockTypingExports);
    function blockReadReceiptExports(factoryArgs) {
      patchReadReceiptExports(factoryArgs, "block");
    }
    function sanitizeReadReceiptExports(factoryArgs) {
      patchReadReceiptExports(factoryArgs, "sanitize");
    }
    function patchReadReceiptExports(factoryArgs, mode) {
      for (const candidate of factoryArgs) {
        if (!isPatchableExportContainer(candidate)) continue;
        if ("exports" in candidate) {
          try {
            candidate.exports = wrapReadReceiptExport(candidate.exports, true, mode);
          } catch (e) {
          }
        }
        wrapReadReceiptExport(candidate, true, mode);
      }
    }
    function isPatchableExportContainer(candidate) {
      if (!candidate || typeof candidate !== "object") return false;
      if (candidate === window || candidate === document || candidate === globalThis) return false;
      try {
        return "exports" in candidate || Object.getOwnPropertyNames(candidate).length <= 100;
      } catch (e) {
        return false;
      }
    }
    [
      "LSSendReadReceipt",
      "SendReadReceipt",
      "ReadReceiptMutation"
    ].forEach((name) => registerExportCallback(name, blockReadReceiptExports));
    [
      "LSUpdateThreadReadWatermark",
      "LSMarkThreadRead",
      "MWMarkThreadRead",
      "LSUpdateLastReadWatermark",
      "MarkThreadRead",
      "UpdateLastReadWatermark",
      "UpdateThreadReadWatermark"
    ].forEach((name) => registerExportCallback(name, sanitizeReadReceiptExports));
    function applyExportCallbacks(factoryArgs, moduleName) {
      for (const [pattern, callbacks] of Object.entries(exportCallbacks)) {
        if (moduleNameMatches(moduleName, pattern)) {
          for (const callback of callbacks) {
            try {
              callback(factoryArgs);
            } catch (e) {
            }
          }
        }
      }
    }
    function applyFactoryCallbacks(factoryArgs, moduleName) {
      for (const [pattern, callbacks] of Object.entries(factoryCallbacks)) {
        if (moduleNameMatches(moduleName, pattern)) {
          for (const callback of callbacks) {
            try {
              callback(factoryArgs);
            } catch (e) {
            }
          }
        }
      }
    }
    function hasExportCallback(moduleName) {
      return Object.keys(exportCallbacks).some((pattern) => moduleNameMatches(moduleName, pattern));
    }
    function hasFactoryCallback(moduleName) {
      return Object.keys(factoryCallbacks).some((pattern) => moduleNameMatches(moduleName, pattern));
    }
    function hasTypingExportCallback(moduleName) {
      return ["LSSendTypingIndicator", "LSSendTypingIndicatorStoredProcedure"].some((pattern) => moduleNameMatches(moduleName, pattern));
    }
    function hasLocalReadReceiptExportCallback(moduleName) {
      return [
        "LSUpdateThreadReadWatermark",
        "LSMarkThreadRead",
        "MWMarkThreadRead",
        "LSUpdateLastReadWatermark",
        "MarkThreadRead",
        "UpdateLastReadWatermark",
        "UpdateThreadReadWatermark"
      ].some((pattern) => moduleNameMatches(moduleName, pattern));
    }
    function hasBlockingReadReceiptExportCallback(moduleName) {
      return [
        "LSSendReadReceipt",
        "SendReadReceipt",
        "ReadReceiptMutation"
      ].some((pattern) => moduleNameMatches(moduleName, pattern));
    }
    function shouldPatchReadReceiptModules() {
      return isMessenger;
    }
    function shouldPatchLocalReadReceiptModules() {
      return isInstagram || (isFacebookDotCom || isFacebookMessengerProxy) && !isMessengerDotCom;
    }
    function shouldLeaveLocalReadReceiptModuleUnpatched(isLocalReadReceiptModule) {
      return isLocalReadReceiptModule && (!shouldPatchLocalReadReceiptModules() || hasNativeMessageRequestBypass() || isCurrentMessageRequestSurface());
    }
    function isFacebookFeedMessengerSurface() {
      var _a, _b, _c;
      if (!isFacebookDotCom || isMessengerDotCom) return false;
      const path = String(((_a = window.location) == null ? void 0 : _a.pathname) || "").toLowerCase();
      const search = String(((_b = window.location) == null ? void 0 : _b.search) || "").toLowerCase();
      const hash = String(((_c = window.location) == null ? void 0 : _c.hash) || "").toLowerCase();
      if (path.startsWith("/messages") || path.startsWith("/messenger")) return false;
      if (search.includes("sk=messages") || hash.includes("messages")) return false;
      const hasMessengerPopover = hasDomElement('[role="dialog"][aria-label="Messenger"]') && hasDomElement('[role="grid"][aria-label="Chats"]');
      if (hasMessengerPopover) return true;
      const hasMiniChatChrome = hasDomElement('[aria-label="Minimize chat"]') || hasDomElement('[aria-label="Close chat"]');
      if (!hasMiniChatChrome) return false;
      return hasDomElement('[role="textbox"][contenteditable="true"]') || hasDomElement('[aria-label^="Write to"]') || hasDomElement('[aria-label^="Messages in conversation"]') || hasDomElement('[aria-label^="Conversation titled"]');
    }
    function hasDomElement(selector) {
      try {
        return typeof (document == null ? void 0 : document.querySelector) === "function" && !!document.querySelector(selector);
      } catch (e) {
        return false;
      }
    }
    function shouldProcessModule(moduleName, dependencies) {
      const hasTypingModule = isTypingDependency(moduleName) || Array.isArray(dependencies) && dependencies.some(isTypingDependency) || hasFactoryCallback(moduleName) || hasTypingExportCallback(moduleName);
      const hasLocalReadReceiptModule = isLocalReadReceiptDependency(moduleName) || hasLocalReadReceiptExportCallback(moduleName) || Array.isArray(dependencies) && dependencies.some(isLocalReadReceiptDependency);
      if (shouldLeaveLocalReadReceiptModuleUnpatched(hasLocalReadReceiptModule)) {
        return hasTypingModule || isReadReceiptDependency(moduleName) || hasBlockingReadReceiptExportCallback(moduleName) || Array.isArray(dependencies) && dependencies.some(isReadReceiptDependency);
      }
      const hasBlockingReadReceiptModule = isReadReceiptDependency(moduleName) || hasBlockingReadReceiptExportCallback(moduleName) || Array.isArray(dependencies) && dependencies.some(isReadReceiptDependency);
      if (!shouldPatchReadReceiptModules()) return hasTypingModule;
      if (!shouldPatchLocalReadReceiptModules()) {
        return hasTypingModule || hasBlockingReadReceiptModule;
      }
      return hasTypingModule || isReadReceiptDependency(moduleName) || isLocalReadReceiptDependency(moduleName) || Array.isArray(dependencies) && (dependencies.some(isReadReceiptDependency) || dependencies.some(isLocalReadReceiptDependency)) || hasExportCallback(moduleName);
    }
    function setupModuleInterceptor() {
      let originalDefine = window.__d;
      markPatchStatus("module_interceptor.install", { hasDefine: typeof window.__d === "function" });
      const createProxy = (target) => {
        if (typeof target !== "function") return target;
        return new Proxy(target, {
          apply: (fn, thisArg, args) => {
            const moduleName = args[0];
            const dependencies = Array.isArray(args[1]) ? args[1] : [];
            if (typeof moduleName === "string" && !processedModules.has(moduleName)) {
              if (shouldProcessModule(moduleName, dependencies)) {
                const originalFactory = args[2];
                if (typeof originalFactory !== "function") {
                  return fn.apply(thisArg, args);
                }
                const localReadReceiptModule = isLocalReadReceiptDependency(moduleName) || hasLocalReadReceiptExportCallback(moduleName) || Array.isArray(dependencies) && dependencies.some(isLocalReadReceiptDependency);
                const avoidFactoryMutation = shouldLeaveLocalReadReceiptModuleUnpatched(localReadReceiptModule);
                const needsTypingExportWrap = isTypingDependency(moduleName);
                const readReceiptMode = isLocalReadReceiptDependency(moduleName) ? "sanitize" : "block";
                const needsReadReceiptExportWrap = shouldPatchReadReceiptModules() && (isReadReceiptDependency(moduleName) || shouldPatchLocalReadReceiptModules() && isLocalReadReceiptDependency(moduleName));
                const patchedFactory = originalFactory;
                const factory = function(...factoryArgs) {
                  if (!avoidFactoryMutation) {
                    wrapTypingRequire(factoryArgs);
                    applyFactoryCallbacks(factoryArgs, moduleName);
                  }
                  const result = patchedFactory.apply(this, factoryArgs);
                  if (needsTypingExportWrap) blockTypingExports(factoryArgs);
                  if (needsReadReceiptExportWrap) patchReadReceiptExports(factoryArgs, readReceiptMode);
                  applyExportCallbacks(factoryArgs, moduleName);
                  return result;
                };
                args[2] = factory;
                processedModules.add(moduleName);
              }
            }
            return fn.apply(thisArg, args);
          }
        });
      };
      if (window.__d) originalDefine = createProxy(window.__d);
      Object.defineProperty(window, "__d", {
        get: function() {
          return originalDefine;
        },
        set: function(newValue) {
          originalDefine = createProxy(newValue);
        },
        configurable: true
      });
      markPatchStatus("module_interceptor.hooked", { ok: true });
    }
    if (isInstagram || isMessenger) {
      setupModuleInterceptor();
    }
    if (isInstagram || isMessenger) {
      installPostMessageTypingBlockers();
    }
  })();
})();
