import { isFacebookDotCom, isMessengerDotCom, isMessenger, isInstagram, isKilled, SETTINGS } from '../config.js';

const DEFAULT_PATTERNS = {
    igTyping: [
        'indicate_activity',
        'typing_indicator',
        'activity_indicator',
        'is_typing',
        'direct_v2/threads/broadcast/typing',
        'direct_v2/threads/typing',
        'sendtypingindicator',
        'send_typing_indicator',
        'typing_on',
        'is_composing'
    ],
    igSeen: [
        'mark_read',
        'mark_seen',
        'thread_seen',
        'directmarkasseen',
        'markasseen',
        'directthreadmarkitemsseen',
        'polarisdirectmarkasseenmutation',
        'directseenmutation',
        'usepolarismarkthreadseenmutation',
        'useigdmarkthreadasreadmutation'
    ],
    igStory: [
        'storiesupdateseenmutation',
        'polarisstoriesseenmutation',
        'usepolarisstoriesv3seenmutation',
        'reelmediaseen',
        'storiesupdateseen',
        'seenstoriesupdatemutation',
        'polarisapireelseenmutation',
        'xdt_mark_story_reel_seen',
        '26997980659837802',
        'polarisapiforcestoryseenmutation',
        'xdt_api__v1__stories__reel__seen',
        '9647304595318258',
        'api/v1/stories/reel/seen',
        'stories/reel/seen',
        'mark_story_seen',
        'update_seen_for_reel',
        'reel_seen',
        'stories_update_seen',
        'mark_story_read'
    ],
    msgTyping: [
        'indicate_activity',
        'typing_indicator',
        'activity_indicator',
        'is_typing',
        'sendtypingindicator',
        'send_typing_indicator',
        'sendchatstate',
        'send_chat_state',
        'ajax/messaging/typ.php',
        'ajax/chat/typ.php',
        'ajax/mercury/typ.php',
        'thread_typing',
        'orca_typing_notifications',
        'is_composing',
        'iscomposing',
        'composing',
        'chat_state',
        'chatstate',
        'typing_status',
        'typingstate',
        'securetypingstate',
        'mawsecuretypingstate',
        'typingindicatorstoredprocedure',
        'istyping',
        'send_type'
    ],
    msgSeen: [
        'mark_read',
        'mark_seen',
        'thread_seen',
        'directmarkasseen',
        'markasseen',
        'directthreadmarkitemsseen',
        'polarisdirectmarkasseenmutation',
        'directseenmutation',
        'seenbyviewer',
        'updatelastseenat',
        'updatelastreadwatermark',
        'sendreadreceipt',
        'lssendreadreceipt',
        'readreceipt',
        'read_receipt',
        'readreceiptmutation',
        'lsupdatethreadreadwatermark',
        'lsupdatelastreadwatermark',
        'last_read_watermark',
        'lastreadwatermark',
        'read_watermark',
        'readwatermark',
        'shouldsendreadreceipt',
        'should_send_read_receipt',
        'lsmarkthreadread',
        'mwmarkthreadread',
        'markasread',
        'change_read_status'
    ],
    msgStory: [
        'storiesupdateseenmutation',
        'polarisstoriesseenmutation',
        'usepolarisstoriesv3seenmutation',
        'reelmediaseen',
        'storiesupdateseen',
        'seenstoriesupdatemutation',
        'mark_story_seen',
        'update_seen_for_reel',
        'reel_seen',
        'stories_update_seen',
        'mark_story_read'
    ]
};

const PATTERN_KEYS = Object.keys(DEFAULT_PATTERNS);
const MAX_PATTERNS_PER_FEATURE = 50;
const MAX_PATTERN_LENGTH = 96;

export let PATTERNS = clonePatterns(DEFAULT_PATTERNS);

export function updatePatterns(newPatterns) {
    PATTERNS = mergePatterns(DEFAULT_PATTERNS, newPatterns);
}

function clonePatterns(patterns) {
    return Object.fromEntries(PATTERN_KEYS.map(key => [key, [...patterns[key]]]));
}

function mergePatterns(defaults, incoming) {
    const merged = clonePatterns(defaults);
    if (!incoming || typeof incoming !== 'object') return merged;

    for (const key of PATTERN_KEYS) {
        const remotePatterns = sanitizePatternList(incoming[key]);
        if (!remotePatterns.length) continue;

        const existing = new Set(merged[key]);
        for (const pattern of remotePatterns) existing.add(pattern);
        merged[key] = [...existing].slice(0, MAX_PATTERNS_PER_FEATURE);
    }

    return merged;
}

function sanitizePatternList(patterns) {
    if (!Array.isArray(patterns)) return [];

    return patterns
        .filter(pattern => typeof pattern === 'string')
        .map(pattern => pattern.trim().toLowerCase())
        .filter(pattern => pattern && pattern.length <= MAX_PATTERN_LENGTH)
        .filter(pattern => !/[|^$()[\]{}+?\\]/.test(pattern))
        .slice(0, MAX_PATTERNS_PER_FEATURE);
}

export function decode(data, limit = 15000) {
    if (!data) return '';
    try {
        if (typeof data === 'string') return withDecodedText(data, limit);
        if (data instanceof ArrayBuffer) {
            return withDecodedText(new TextDecoder().decode(data.slice(0, limit)), limit);
        }
        if (ArrayBuffer.isView(data)) {
            const view = new Uint8Array(data.buffer, data.byteOffset, Math.min(data.byteLength, limit));
            return withDecodedText(new TextDecoder().decode(view), limit);
        }
        if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
            return withDecodedText(data.toString(), limit);
        }
        if (typeof FormData !== 'undefined' && data instanceof FormData) {
            let text = '';
            for (const pair of data.entries()) {
                if (typeof pair[1] === 'string') {
                    text += `${pair[0]}=${pair[1]}&`;
                    if (text.length >= limit) return text.slice(0, limit);
                }
            }
            return withDecodedText(text, limit);
        }
        if (typeof data === 'object') return withDecodedText(JSON.stringify(data), limit);
    } catch (e) {
        return '';
    }
    return '';
}

function withDecodedText(text, limit) {
    const raw = String(text || '').slice(0, limit);
    try {
        const decoded = decodeURIComponent(raw.replace(/\+/g, ' '));
        if (decoded && decoded !== raw) {
            return `${raw} ${decoded}`.slice(0, limit * 2);
        }
    } catch (e) { }
    return raw;
}

export function matchesPattern(str, patternList) {
    if (!patternList || !Array.isArray(patternList)) return false;
    return patternList.some(pattern => str.includes(pattern));
}

function includesAny(str, terms) {
    return terms.some(term => str.includes(term));
}

function hasExplicitStorySeenSignal(str) {
    return includesAny(str, [
        'storiesupdateseenmutation',
        'polarisstoriesseenmutation',
        'usepolarisstoriesv3seenmutation',
        'reelmediaseen',
        'storiesupdateseen',
        'seenstoriesupdatemutation',
        'mark_story_seen',
        'update_seen_for_reel',
        'reel_seen',
        'stories_update_seen',
        'mark_story_read'
    ]);
}

function isInstagramStoryViewerLookup(str) {
    if (hasExplicitStorySeenSignal(str)) return false;

    return includesAny(str, [
        'stories_viewer',
        'story_viewer',
        'story_viewers',
        'reel_media_viewers',
        'reel_viewers',
        'viewer_list',
        'viewers_list',
        'seen_by',
        'seenby'
    ]);
}

function hasFacebookMessengerContext(str) {
    return includesAny(str, [
        'messenger',
        'message',
        'messages',
        'messaging',
        'cometmessenger',
        'mwchat',
        'mailbox',
        'inbox',
        'maw',
        'lsplatform',
        'thread_key',
        'threadkey',
        'thread_fbid',
        'threadfbid',
        'thread_id',
        'threadid',
        'recipient_id',
        'message_thread',
        'act_thread_id'
    ]);
}

function hasMessengerReadReceiptSignal(str) {
    return hasMessengerReadReceiptWriteSignal(str) ||
        includesAny(str, [
            'last_read_watermark',
            'lastreadwatermark',
            'last_read_watermark_ts',
            'lastreadwatermarkts',
            'read_watermark',
            'readwatermark',
            'watermarktimestamp',
            'watermark_timestamp',
            'seenbyviewer',
            'seen_by_viewer'
        ]);
}

function hasMessengerReadReceiptWriteSignal(str) {
    return includesAny(str, [
        'markthreadasread',
        'mark_thread_read',
        'markthreadreadmutation',
        'markthreadread',
        'markread',
        'mark_read',
        'markseen',
        'mark_seen',
        'threadseen',
        'thread_seen',
        'change_read_status',
        'updatelastseenat',
        'updatelastreadwatermark',
        'sendreadreceipt',
        'lssendreadreceipt',
        'readreceiptmutation',
        'readreceipt',
        'read_receipt',
        'lsupdatethreadreadwatermark',
        'lsmarkthreadread',
        'mwmarkthreadread',
        'lsupdatelastreadwatermark',
        'markasread',
        'shouldsendreadreceipt',
        'should_send_read_receipt'
    ]);
}

function isFacebookMessageReadReceipt(str) {
    if (hasMessengerReadReceiptSignal(str)) {
        return hasFacebookMessengerContext(str) && hasReadReceiptWriteContext(str);
    }

    return hasFacebookMessengerContext(str) && hasReadReceiptWriteContext(str) && includesAny(str, [
        'mutation',
        'procedure',
        'updatelastseenat'
    ]) && includesAny(str, [
        'markread',
        'markseen',
        'mark_read',
        'mark_seen',
        'thread_seen'
    ]);
}

function hasReadReceiptWriteContext(str) {
    return hasReadReceiptOperationContext(str) &&
        (hasMessengerThreadContext(str) || hasReadReceiptWatermarkContext(str));
}

function hasReadReceiptOperationContext(str) {
    return includesAny(str, [
        'mutation',
        'procedure',
        'storedprocedure',
        'ls_req',
        '/ls_req',
        'issue_new_task',
        'issuenewtask'
    ]);
}

function hasMessengerThreadContext(str) {
    return includesAny(str, [
        'thread_key',
        'threadkey',
        'thread_fbid',
        'threadfbid',
        'thread_id',
        'threadid',
        'recipient_id',
        'message_thread',
        'act_thread_id'
    ]);
}

function hasReadReceiptWatermarkContext(str) {
    return includesAny(str, [
        'last_read_watermark',
        'lastreadwatermark',
        'last_read_watermark_ts',
        'lastreadwatermarkts',
        'read_watermark',
        'readwatermark',
        'watermarktimestamp',
        'watermark_timestamp',
        'shouldsendreadreceipt',
        'should_send_read_receipt'
    ]);
}

function isMessengerReadReceiptWrite(str, urlString) {
    if (isLegacyMessengerReadEndpoint(urlString)) return true;

    if (hasMessengerMessageSendIntent(str)) return false;

    if (isMessengerRealtimeReadBridgeWrite(str, urlString)) return true;

    if (isMessengerSendWithBundledReadWatermark(str)) return false;

    if (hasMessengerReadReceiptSignal(str)) {
        return hasReadReceiptWriteContext(str);
    }

    if (!hasReadReceiptWriteContext(str)) return false;

    const hasReceiptField = includesAny(str, [
        'last_read_watermark',
        'lastreadwatermark',
        'last_read_watermark_ts',
        'lastreadwatermarkts',
        'read_watermark',
        'readwatermark',
        'watermarktimestamp',
        'watermark_timestamp',
        'read_receipt',
        'readreceipt',
        'seenbyviewer',
        'seen_by_viewer',
        'shouldsendreadreceipt',
        'should_send_read_receipt'
    ]);

    if (!hasReceiptField) return false;

    return includesAny(str, [
        'mark_read',
        'markread',
        'mark_seen',
        'markseen',
        'thread_seen',
        'threadseen',
        'change_read_status',
        'ids['
    ]);
}

function isLegacyMessengerReadEndpoint(urlString) {
    return includesAny(urlString, [
        '/ajax/mercury/change_read_status.php',
        '/ajax/mercury/mark_read.php',
        '/ajax/mercury/mark_seen.php',
        '/ajax/mercury/mark_thread_read.php',
        '/ajax/mercury/read_receipts.php',
        '/ajax/messaging/read_receipts.php',
        '/ajax/chat/read_receipts.php'
    ]);
}

function isMessengerRealtimeReadBridgeWrite(str, urlString) {
    if (!isMessengerRealtimeTransport(urlString)) return false;
    if (str.includes('delivery_receipt') && !hasMessengerReadReceiptWriteSignal(str)) return false;
    if (!hasMessengerReadReceiptWriteSignal(str) && !hasRealtimeReadWatermarkWriteSignal(str)) return false;

    return includesAny(str, [
        'markthread',
        'markread',
        'mark_read',
        'markseen',
        'mark_seen',
        'markasread',
        'readreceipt',
        'read_receipt',
        'lastreadwatermark',
        'last_read_watermark',
        'last_read_watermark_ts',
        'lastreadwatermarkts',
        'read_watermark',
        'readwatermark',
        'watermarktimestamp',
        'watermark_timestamp',
        'shouldsendreadreceipt',
        'should_send_read_receipt',
        'sendreadreceipt',
        'lsmarkthreadread',
        'lsupdatethreadreadwatermark',
        'mwmarkthreadread',
        'change_read_status'
    ]);
}

function hasRealtimeReadWatermarkWriteSignal(str) {
    if (str.includes('send_type') && !hasMessengerReadReceiptWriteSignal(str)) return false;

    const hasWatermark = includesAny(str, [
        'last_read_watermark',
        'lastreadwatermark',
        'last_read_watermark_ts',
        'lastreadwatermarkts',
        'read_watermark',
        'readwatermark',
        'watermarktimestamp',
        'watermark_timestamp',
        'shouldsendreadreceipt',
        'should_send_read_receipt'
    ]);

    if (!hasWatermark) return false;

    return includesAny(str, [
        'markthread',
        'markread',
        'mark_read',
        'markasread',
        'sendreadreceipt',
        'readreceipt',
        'read_receipt',
        'lsupdatethreadreadwatermark',
        'lsupdatelastreadwatermark',
        'updatelastreadwatermark',
        'shouldsendreadreceipt',
        'should_send_read_receipt',
        'ls_req',
        '/ls_req',
        'issue_new_task',
        'issuenewtask',
        'storedprocedure',
        'procedure'
    ]);
}

function isMessengerSendWithBundledReadWatermark(str) {
    if (!str.includes('send_type')) return false;
    if (!hasReadReceiptWatermarkContext(str)) return false;
    if (hasMessengerReadReceiptWriteSignal(str)) return false;

    return hasReadReceiptOperationContext(str) && hasMessengerThreadContext(str);
}

function hasMessengerMessageSendIntent(str) {
    if (!hasMessengerThreadContext(str)) return false;

    const hasSendOperationName = includesAny(str, [
        'send_message',
        'sendmessage',
        'message_send',
        'messagesend',
        'messenger_send_message',
        'messengersendmessage',
        'sendmessagemutation',
        'messengersendmessagemutation'
    ]);
    const hasClientMessageId = includesAny(str, [
        'offline_threading_id',
        'offlinethreadingid',
        'client_message_id',
        'clientmessageid',
        'client_mutation_id',
        'clientmutationid',
        'otid'
    ]);
    const hasMessagePayload = includesAny(str, [
        '"message"',
        '%22message%22',
        'message:',
        'message=',
        '"text"',
        '%22text%22',
        'text:',
        'text=',
        'body',
        'attachment',
        'sticker',
        'media'
    ]);

    if (hasSendOperationName && (hasMessagePayload || hasClientMessageId || str.includes('send_type'))) return true;
    return str.includes('send_type') && hasClientMessageId && hasMessagePayload;
}

function hasMessengerDeliveryAckIntent(str) {
    if (!hasMessengerThreadContext(str)) return false;
    if (hasMessengerMessageSendIntent(str)) return true;
    if (hasMessengerReadReceiptWriteSignal(str)) return false;

    return includesAny(str, [
        'delivery_receipt',
        'deliveryreceipt',
        'delivery_receipts',
        'message_delivered',
        'messagedelivered',
        'markdelivered',
        'mark_delivered'
    ]);
}

export function sanitizeMessengerNetworkPayload(data, url = '', options = {}) {
    if (!isMessenger) return { data, changed: false };
    if (!shouldSanitizeMessengerNetworkPayload()) return { data, changed: false };
    if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
        return sanitizeMessengerUrlSearchParams(data, String(url || '').toLowerCase(), options);
    }
    if (typeof data !== 'string') return { data, changed: false };

    const trimmed = data.trim();
    if (!trimmed) {
        return { data, changed: false };
    }

    if (trimmed[0] !== '{' && trimmed[0] !== '[') {
        return sanitizeMessengerUrlEncodedPayload(data, String(url || '').toLowerCase(), options);
    }

    try {
        const parsed = JSON.parse(trimmed);
        const sanitized = sanitizeMessengerNetworkValue(parsed, String(url || '').toLowerCase(), options);
        if (!sanitized.changed || sanitized.blockedAll) return { data, changed: false };

        try {
            if (typeof window !== 'undefined') {
                window.__GHOSTIFY_SANITIZED_NETWORK_MESSAGES__ = (window.__GHOSTIFY_SANITIZED_NETWORK_MESSAGES__ || 0) + 1;
            }
        } catch (e) { }

        return { data: JSON.stringify(sanitized.value), changed: true };
    } catch (e) {
        return { data, changed: false };
    }
}

function sanitizeMessengerUrlSearchParams(params, urlString, options = {}) {
    try {
        const next = new URLSearchParams(params.toString());
        const changed = sanitizeMessengerUrlSearchParamsInPlace(next, urlString, options);
        return changed ? { data: next, changed: true } : { data: params, changed: false };
    } catch (e) {
        return { data: params, changed: false };
    }
}

function sanitizeMessengerUrlEncodedPayload(data, urlString, options = {}) {
    if (typeof URLSearchParams === 'undefined') return { data, changed: false };

    try {
        const params = new URLSearchParams(data);
        const changed = sanitizeMessengerUrlSearchParamsInPlace(params, urlString, options);

        if (!changed) return { data, changed: false };

        return { data: params.toString(), changed: true };
    } catch (e) {
        return { data, changed: false };
    }
}

function sanitizeMessengerUrlSearchParamsInPlace(params, urlString, options = {}) {
    let changed = false;
    let removedPrivacyOnlyEntry = false;
    const entries = [...params.entries()];
    const nextEntries = [];

    for (const [key, value] of entries) {
        const trimmedValue = String(value || '').trim();
        if (!trimmedValue || (trimmedValue[0] !== '{' && trimmedValue[0] !== '[')) {
            nextEntries.push([key, value]);
            continue;
        }

        try {
            const parsed = JSON.parse(trimmedValue);
            const sanitized = sanitizeMessengerNetworkValue(parsed, urlString, options);
            if (!sanitized.changed) {
                nextEntries.push([key, value]);
                continue;
            }

            if (sanitized.blockedAll) {
                removedPrivacyOnlyEntry = true;
                changed = true;
                continue;
            }

            nextEntries.push([key, JSON.stringify(sanitized.value)]);
            changed = true;
        } catch (e) {
            nextEntries.push([key, value]);
        }
    }

    if (removedPrivacyOnlyEntry) {
        const retainedText = nextEntries.map(([, value]) => decode(value)).join(' ').toLowerCase();
        if (!hasMessengerMessageSendIntent(retainedText) && !hasMessengerDeliveryAckIntent(retainedText)) {
            return false;
        }
    }

    if (changed) {
        for (const key of new Set(entries.map(([entryKey]) => entryKey))) {
            params.delete(key);
        }
        for (const [key, value] of nextEntries) {
            params.append(key, value);
        }
    }

    if (changed) recordMessengerNetworkSanitization();
    return changed;
}

function recordMessengerNetworkSanitization() {
    try {
        if (typeof window !== 'undefined') {
            window.__GHOSTIFY_SANITIZED_NETWORK_MESSAGES__ = (window.__GHOSTIFY_SANITIZED_NETWORK_MESSAGES__ || 0) + 1;
        }
    } catch (e) { }
}

function shouldSanitizeMessengerNetworkPayload() {
    return (SETTINGS.msgSeen && !isKilled('msgSeen')) ||
        (SETTINGS.msgTyping && !isKilled('msgTyping'));
}

function sanitizeMessengerNetworkValue(value, urlString, options, depth = 0) {
    if (!value || depth > 8) {
        return { value, changed: false, blockedAll: false };
    }

    if (Array.isArray(value)) {
        let changed = false;
        const next = [];

        for (const item of value) {
            const itemText = decode(item).toLowerCase();
            if (isMessengerPrivacyOnlyNetworkWrite(itemText, urlString, options)) {
                changed = true;
                continue;
            }

            const sanitizedItem = sanitizeMessengerNetworkValue(item, urlString, options, depth + 1);
            if (sanitizedItem.blockedAll) {
                changed = true;
                continue;
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

    if (typeof value === 'object') {
        const ownText = decode(value).toLowerCase();
        if (isMessengerPrivacyOnlyNetworkWrite(ownText, urlString, options)) {
            return { value: undefined, changed: true, blockedAll: true };
        }

        let changed = false;
        const clone = {};

        for (const key of Object.keys(value)) {
            const child = value[key];
            const sanitizedChild = sanitizeMessengerNetworkValue(child, urlString, options, depth + 1);
            if (sanitizedChild.blockedAll) {
                changed = true;
                continue;
            }

            changed = changed || sanitizedChild.changed;
            clone[key] = sanitizedChild.value;
        }

        return {
            value: changed ? clone : value,
            changed,
            blockedAll: changed && Object.keys(clone).length === 0
        };
    }

    return { value, changed: false, blockedAll: false };
}

function isMessengerPrivacyOnlyNetworkWrite(str, urlString, options) {
    if (!str) return false;
    if (hasMessengerMessageSendIntent(str) || hasMessengerDeliveryAckIntent(str)) return false;

    if (SETTINGS.msgSeen && !isKilled('msgSeen') && isMessengerReadReceiptNetworkTask(str, urlString, options)) {
        return true;
    }

    if (SETTINGS.msgTyping && !isKilled('msgTyping') && isMessengerTypingNetworkTask(str, urlString)) {
        return true;
    }

    return false;
}

function isMessengerReadReceiptNetworkTask(str, urlString, options) {
    if (isMessengerReadReceiptWrite(str, urlString)) return true;
    if (!hasMessengerThreadContext(str)) return false;

    const hasTaskEnvelope = includesAny(str, [
        'label',
        'queue_name',
        'queuename',
        'payload',
        'tasks'
    ]);

    if (!hasTaskEnvelope && !hasReadReceiptOperationContext(str)) return false;

    return hasMessengerReadReceiptWriteSignal(str);
}

function isMessengerTypingNetworkTask(str, urlString) {
    if (isMessengerTypingWrite(str, urlString)) return true;
    if (!hasMessengerThreadContext(str)) return false;

    const hasTaskEnvelope = includesAny(str, [
        'label',
        'queue_name',
        'queuename',
        'payload',
        'tasks'
    ]);

    if (!hasTaskEnvelope && !hasReadReceiptOperationContext(str)) return false;

    return includesAny(str, [
        'sendchatstate',
        'send_chat_state',
        'sendchatstatefromcomposer',
        'typingindicatorstoredprocedure',
        'sendtypingindicator',
        'send_typing_indicator',
        'typing_indicator',
        'chatstate',
        'is_typing',
        'istyping'
    ]);
}

function isMessengerRealtimeTransport(urlString) {
    return urlString.includes('/ws/realtime') ||
        urlString.includes('/ws/streamcontroller') ||
        urlString.includes('/ws/rpsignaling') ||
        urlString.includes('edge-chat.messenger.com/chat') ||
        urlString.includes('edge-chat.facebook.com/chat');
}

function isMessengerTypingWrite(str, urlString) {
    if (
        urlString.includes('/ajax/messaging/typ.php') ||
        urlString.includes('/ajax/chat/typ.php') ||
        urlString.includes('/ajax/mercury/typ.php')
    ) {
        return true;
    }

    if (!matchesPattern(str, PATTERNS.msgTyping)) return false;

    if (includesAny(str, [
        'sendtypingindicator',
        'send_typing_indicator',
        'send_typing',
        'sendchatstatefromcomposer',
        'sendchatstate',
        'send_chat_state',
        'chat_state',
        'chatstate',
        'typing_status',
        'typingindicatorstoredprocedure',
        'securetypingstate',
        'mawsecuretypingstate',
        'typingstate',
        'thread_typing',
        'orca_typing_notifications',
        'indicate_activity',
        'activity_indicator'
    ])) {
        return hasMessengerTypingContext(str);
    }

    return hasMessengerTypingContext(str) && includesAny(str, [
        'is_typing',
        'istyping',
        'typing_on',
        'typing_indicator',
        'typing_status',
        'typingstate',
        'securetypingstate',
        'mawsecuretypingstate',
        'is_composing',
        'iscomposing',
        'composing',
        'chatstate',
        'send_typing',
        'send_typing_indicator',
        'send_chat_state',
        'sendchatstate'
    ]);
}

function hasMessengerTypingContext(str) {
    return hasMessengerThreadContext(str) || includesAny(str, [
        'composer',
        'ls_req',
        '/ls_req',
        'issue_new_task',
        'issuenewtask'
    ]);
}

function isInstagramStorySeenWrite(str) {
    if (includesAny(str, [
        'polarisapireelseenmutation',
        'xdt_mark_story_reel_seen',
        '26997980659837802',
        'polarisapiforcestoryseenmutation',
        'xdt_api__v1__stories__reel__seen',
        '9647304595318258',
        'api/v1/stories/reel/seen',
        'stories/reel/seen',
        'forceseenstoryid'
    ])) {
        return true;
    }

    return includesAny(str, ['viewseenat']) &&
        includesAny(str, ['reelmediaid', 'reelmediaownerid', 'reelmediatakenat', 'reelid']);
}

function isStaticAsset(url) {
    return /\.(mp4|jpg|jpeg|png|webp|gif|mp3|wav|m4a|aac|css|js|mjs|woff2?)($|\?)/i.test(url) ||
        url.includes('static.xx.fbcdn.net/') ||
        url.includes('/rsrc.php') ||
        url.includes('/ajax/bootloader-endpoint/');
}

function isFacebookExplicitMessengerSeenWrite(str, urlString) {
    if (urlString.includes('/ajax/mercury/change_read_status.php')) return true;
    if (isMessengerRealtimeReadBridgeWrite(str, urlString)) return true;
    if (isGraphQLRequest(str, urlString)) return false;

    if (!hasStrictFacebookMessengerWriteContext(str) && !isMessengerRealtimeTransport(urlString)) return false;

    const hasExplicitWrite = includesAny(str, [
        'markthreadasread',
        'mark_thread_read',
        'markthreadreadmutation',
        'lsmarkthreadread',
        'mwmarkthreadread',
        'lssendreadreceipt',
        'sendreadreceipt',
        'send_read_receipt',
        'readreceiptmutation',
        'lsupdatethreadreadwatermark',
        'lsupdatelastreadwatermark',
        'updatelastreadwatermark',
        'change_read_status'
    ]);

    if (!hasExplicitWrite) return false;

    return includesAny(str, [
        'mutation',
        'procedure',
        'storedprocedure',
        'ls_req',
        '/ls_req',
        'issue_new_task',
        'issuenewtask',
        'fb_api_req_friendly_name'
    ]) || isMessengerRealtimeTransport(urlString);
}

function isFacebookExplicitMessengerTypingWrite(str, urlString) {
    if (
        urlString.includes('/ajax/messaging/typ.php') ||
        urlString.includes('/ajax/chat/typ.php') ||
        urlString.includes('/ajax/mercury/typ.php')
    ) {
        return true;
    }

    if (isGraphQLRequest(str, urlString)) return false;

    const hasExplicitWrite = includesAny(str, [
        'sendtypingindicator',
        'lssendtypingindicator',
        'lssendtypingindicatorstoredprocedure',
        'send_typing_indicator',
        'send_typing',
        'sendchatstatefromcomposer',
        'sendchatstate',
        'send_chat_state',
        'chat_state',
        'is_composing',
        'iscomposing',
        'composing',
        'typing_status',
        'typingindicatorstoredprocedure',
        'mawsecuretypingstate',
        'securetypingstate',
        'typingstate'
    ]);

    if (!hasExplicitWrite) return false;

    return hasStrictFacebookMessengerWriteContext(str) ||
        hasMessengerThreadContext(str) ||
        isMessengerRealtimeTransport(urlString) ||
        includesAny(str, ['composer', 'ls_req', '/ls_req', 'issue_new_task', 'issuenewtask']);
}

function isGraphQLRequest(str, urlString) {
    return urlString.includes('/api/graphql') ||
        str.includes('fb_api_req_friendly_name') ||
        str.includes('doc_id');
}

function isFacebookGraphQLMessengerSeenWrite(str) {
    if (isFacebookGraphQLMessengerQuery(str)) return false;

    const hasNamedWrite = includesAny(str, [
        'markthreadasread',
        'mark_thread_read',
        'markthreadreadmutation',
        'markthreadread',
        'lsmarkthreadread',
        'mwmarkthreadread',
        'lssendreadreceipt',
        'sendreadreceipt',
        'send_read_receipt',
        'readreceiptmutation',
        'readreceipt',
        'read_receipt',
        'lsupdatethreadreadwatermark',
        'lsupdatelastreadwatermark',
        'updatelastreadwatermark',
        'shouldsendreadreceipt',
        'should_send_read_receipt'
    ]);

    const hasWatermarkWrite = includesAny(str, [
        'last_read_watermark',
        'read_watermark',
        'watermarktimestamp',
        'watermark_timestamp'
    ]) && includesAny(str, [
        'mutation',
        'ls_req',
        '/ls_req',
        'issue_new_task',
        'issuenewtask',
        'sendreadreceipt',
        'readreceipt',
        'markthread'
    ]);

    if (!hasNamedWrite && !hasWatermarkWrite) return false;

    return hasStrictFacebookMessengerWriteContext(str) ||
        hasMessengerThreadContext(str) ||
        hasReadReceiptWatermarkContext(str);
}

function isFacebookGraphQLMessengerTypingWrite(str) {
    if (isFacebookGraphQLMessengerQuery(str)) return false;

    const hasExplicitWrite = includesAny(str, [
        'sendtypingindicator',
        'lssendtypingindicator',
        'lssendtypingindicatorstoredprocedure',
        'send_typing_indicator',
        'send_typing',
        'sendchatstatefromcomposer',
        'sendchatstate',
        'send_chat_state',
        'chat_state',
        'is_composing',
        'iscomposing',
        'composing',
        'typing_status',
        'typingindicatorstoredprocedure',
        'mawsecuretypingstate',
        'securetypingstate',
        'typingstate'
    ]);

    if (!hasExplicitWrite) return false;

    return hasStrictFacebookMessengerWriteContext(str) ||
        hasMessengerThreadContext(str) ||
        includesAny(str, ['composer', 'typing_indicator', 'chatstate', 'typingstate', 'typing_status', 'maw']);
}

function isFacebookGraphQLMessengerQuery(str) {
    const friendlyName = getFacebookGraphQLFriendlyName(str);
    if (friendlyName && friendlyName.includes('query') && !friendlyName.includes('mutation')) return true;

    return includesAny(str, [
        'ebmessagemetadataquery',
        'messagehistoryquery',
        'threadlistquery',
        'messagelistquery',
        'searchmessengerquery',
        'messengerthreadquery',
        'messengerthreadlistquery',
        'messengerinboxquery'
    ]);
}

function getFacebookGraphQLFriendlyName(str) {
    const match = String(str || '').match(/fb_api_req_friendly_name=([^&\s]+)/) ||
        String(str || '').match(/"fb_api_req_friendly_name"\s*:\s*"([^"]+)/);
    return match ? String(match[1] || '').toLowerCase() : '';
}

function hasStrictFacebookMessengerWriteContext(str) {
    return includesAny(str, [
        'cometmessenger',
        'mwchat',
        'maw',
        'lsplatform',
        'thread_key',
        'threadkey',
        'thread_fbid',
        'threadfbid',
        'thread_id',
        'recipient_id',
        'message_thread',
        'act_thread_id'
    ]);
}

function stripInstagramUserAuthoredText(text) {
    return String(text || '')
        .replace(/((?:^|[&\s"{,])(?:text|message|item_text|client_context_message|reply_text|comment_text)\s*[=:]\s*)("[^"]*"|[^&\s,}]+)/gi, '$1<user_text>')
        .replace(/((?:^|[&\s"{,])(?:text|message|item_text|client_context_message|reply_text|comment_text)"\s*:\s*)("[^"]*"|[^,}]+)/gi, '$1<user_text>');
}

function hasInstagramDirectContext(str, urlString) {
    return includesAny(`${str} ${urlString}`, [
        'direct_v2',
        '/direct/',
        'directthread',
        'direct_thread',
        'polarisdirect',
        'xdt_direct',
        'instagramdirect',
        'thread_id',
        'threadid',
        'thread_pk',
        'inbox'
    ]);
}

function isInstagramDirectTypingWrite(str, urlString) {
    if (includesAny(urlString, [
        '/direct_v2/threads/broadcast/typing',
        '/direct_v2/threads/typing'
    ]) || (urlString.includes('/direct_v2/threads/') && urlString.includes('/typing'))) {
        return true;
    }

    if (!hasInstagramDirectContext(str, urlString)) return false;

    const hasWriteContext = includesAny(str, [
        'mutation',
        'fb_api_req_friendly_name',
        'direct_v2',
        'thread_id',
        'threadid',
        'thread_pk',
        'recipient_id',
        'recipientid'
    ]);

    return hasWriteContext && includesAny(str, [
        'sendtypingindicator',
        'send_typing_indicator',
        'typingindicatorstoredprocedure',
        'directsendtyping',
        'direct_send_typing',
        'igdsendtyping',
        'typing_indicator',
        'is_typing',
        'typing_on',
        'is_composing'
    ]);
}

function isInstagramDirectMessageSendEndpoint(urlString) {
    return includesAny(urlString, [
        '/direct_v2/threads/broadcast/text',
        '/direct_v2/threads/broadcast/link',
        '/direct_v2/threads/broadcast/media',
        '/direct_v2/threads/broadcast/photo',
        '/direct_v2/threads/broadcast/video',
        '/direct_v2/threads/broadcast/voice',
        '/direct_v2/threads/broadcast/reel_share',
        '/direct_v2/threads/broadcast/story_share',
        '/direct_v2/threads/broadcast/profile',
        '/direct_v2/threads/broadcast/hashtag',
        '/direct_v2/threads/broadcast/location'
    ]);
}

function isInstagramDirectSeenWrite(str, urlString) {
    if (includesAny(urlString, [
        '/direct_v2/threads/seen',
        '/direct_v2/threads/mark_seen',
        '/direct_v2/threads/mark_read'
    ]) || (urlString.includes('/direct_v2/threads/') &&
        includesAny(urlString, ['/seen', 'mark_seen', 'mark_read']))) {
        return true;
    }

    if (!hasInstagramDirectContext(str, urlString)) return false;

    const hasWriteContext = includesAny(str, [
        'mutation',
        'fb_api_req_friendly_name',
        'direct_v2',
        'thread_id',
        'threadid',
        'thread_pk',
        'item_id',
        'itemid',
        'watermark',
        'timestamp'
    ]);

    return hasWriteContext && includesAny(str, [
        'directmarkasseen',
        'directthreadmarkitemsseen',
        'polarisdirectmarkasseenmutation',
        'directseenmutation',
        'usepolarismarkthreadseenmutation',
        'useigdmarkthreadasreadmutation',
        'markthreadseenmutation',
        'markthreadasreadmutation',
        'markdirectthreadseen',
        'mark_direct_thread_seen',
        'mark_seen',
        'mark_read',
        'thread_seen',
        'markasseen'
    ]);
}

function isInstagramDirectSafeRequest(str, urlString, method) {
    if (!hasInstagramDirectContext(str, urlString)) return false;
    if (isInstagramDirectMessageSendEndpoint(urlString)) return true;

    if (isInstagramDirectTypingWrite(str, urlString) ||
        isInstagramDirectSeenWrite(str, urlString) ||
        isInstagramStorySeenWrite(str)) {
        return false;
    }

    if (includesAny(urlString, [
        '/direct_v2/inbox',
        '/direct_v2/threads/',
        '/direct_v2/threads/broadcast/'
    ])) {
        return true;
    }

    if ((method === 'GET' || method === 'HEAD') && includesAny(urlString, [
        '/api/graphql',
        '/direct_v2/'
    ])) {
        return true;
    }

    if (isGraphQLRequest(str, urlString) && includesAny(str, [
        'direct',
        'inbox',
        'thread'
    ])) {
        return true;
    }

    return (str.includes('cursor') || urlString.includes('cursor') ||
        str.includes('query_hash') ||
        str.includes('doc_id')) &&
        includesAny(str, ['direct', 'inbox', 'thread']);
}

export function shouldBlock(data, url = '', options = {}) {
    const urlString = String(url || '');
    if (isStaticAsset(urlString)) return null;

    const method = String(options.method || '').toUpperCase();
    const decodedBody = decode(data).toLowerCase();
    const str = `${decodedBody} ${urlString}`.toLowerCase();
    const isFacebookPage = isFacebookDotCom && !isMessengerDotCom;

    if (isFacebookPage) {
        if (
            SETTINGS.msgSeen &&
            !isKilled('msgSeen') &&
            isGraphQLRequest(str, urlString) &&
            isFacebookGraphQLMessengerSeenWrite(str)
        ) {
            return 'MSG_SEEN';
        }

        if (SETTINGS.msgSeen && !isKilled('msgSeen') && isFacebookExplicitMessengerSeenWrite(str, urlString)) {
            return 'MSG_SEEN';
        }

        if (
            SETTINGS.msgTyping &&
            !isKilled('msgTyping') &&
            isGraphQLRequest(str, urlString) &&
            isFacebookGraphQLMessengerTypingWrite(str)
        ) {
            return 'MSG_TYPING';
        }

        if (SETTINGS.msgTyping && !isKilled('msgTyping') && isFacebookExplicitMessengerTypingWrite(str, urlString)) {
            return 'MSG_TYPING';
        }

        if (
            SETTINGS.msgStory &&
            !isKilled('msgStory') &&
            hasExplicitStorySeenSignal(str) &&
            matchesPattern(str, PATTERNS.msgStory)
        ) {
            return 'MSG_STORY';
        }

        return null;
    }

    if (isMessenger) {
        if (hasMessengerMessageSendIntent(str)) return null;
        if (hasMessengerDeliveryAckIntent(str)) return null;

        if (SETTINGS.msgSeen && !isKilled('msgSeen')) {
            if (isMessengerReadReceiptWrite(str, urlString)) {
                return 'MSG_SEEN';
            }
        }

        if (str.includes('delivery_receipt') && !hasMessengerReadReceiptSignal(str)) return null;

        if (
            SETTINGS.msgTyping &&
            !isKilled('msgTyping') &&
            (!isFacebookPage || hasFacebookMessengerContext(str)) &&
            isMessengerTypingWrite(str, urlString)
        ) {
            return 'MSG_TYPING';
        }

        if (
            SETTINGS.msgStory &&
            !isKilled('msgStory') &&
            (!isFacebookPage || hasExplicitStorySeenSignal(str)) &&
            matchesPattern(str, PATTERNS.msgStory)
        ) {
            return 'MSG_STORY';
        }

        return null;
    }

    if (isInstagram) {
        const instagramMatchText = `${stripInstagramUserAuthoredText(decodedBody)} ${urlString}`.toLowerCase();
        const storyViewerLookup = isInstagramStoryViewerLookup(instagramMatchText);

        if (isInstagramDirectMessageSendEndpoint(urlString)) return null;

        if (SETTINGS.igTyping && !isKilled('igTyping') && isInstagramDirectTypingWrite(instagramMatchText, urlString)) {
            return 'IG_TYPING';
        }

        if (SETTINGS.igStory && !isKilled('igStory') && isInstagramStorySeenWrite(instagramMatchText)) {
            return 'IG_STORY';
        }

        if (SETTINGS.igSeen && !isKilled('igSeen') && isInstagramDirectSeenWrite(instagramMatchText, urlString)) {
            return 'IG_SEEN';
        }

        if (isInstagramDirectSafeRequest(instagramMatchText, urlString, method)) return null;

        if (SETTINGS.igStory && !isKilled('igStory') && !storyViewerLookup && matchesPattern(instagramMatchText, PATTERNS.igStory)) {
            return 'IG_STORY';
        }

        if (SETTINGS.igTyping && !isKilled('igTyping') && matchesPattern(instagramMatchText, PATTERNS.igTyping)) {
            return 'IG_TYPING';
        }

        if (SETTINGS.igSeen && !isKilled('igSeen') && matchesPattern(instagramMatchText, PATTERNS.igSeen)) {
            return 'IG_SEEN';
        }

        if (instagramMatchText.includes('cursor') || urlString.includes('cursor')) return null;
        if (instagramMatchText.includes('query_hash')) return null;
        if (instagramMatchText.includes('doc_id')) return null;

        return null;
    }

    return null;
}
