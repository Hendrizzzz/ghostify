import { isFacebookDotCom, isMessenger, isInstagram, isKilled, isDebugMode, SETTINGS } from '../config.js';

export let PATTERNS = {
    igTyping: [], igSeen: [], igStory: [],
    msgTyping: [], msgSeen: [], msgStory: []
};

export function updatePatterns(newPatterns) {
    PATTERNS = newPatterns;
}

export function decode(data) {
    if (!data) return '';
    try {
        if (typeof data === 'string') return data;
        if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
            return new TextDecoder().decode(data);
        }
        if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
            try { return decodeURIComponent(data.toString()); } catch (e) { return data.toString(); }
        }
        if (typeof FormData !== 'undefined' && data instanceof FormData) {
            let text = '';
            for (const pair of data.entries()) {
                if (typeof pair[1] === 'string') text += pair[0] + '=' + pair[1] + '&';
            }
            return text;
        }
        if (typeof data === 'object') return JSON.stringify(data);
    } catch (e) { return ''; }
    return '';
}

export function matchesPattern(str, patternList) {
    if (!patternList || !Array.isArray(patternList)) return false;

    return patternList.some(pattern => {
        if (pattern.includes('|') || pattern.startsWith('^') || pattern.endsWith('$')) {
            try {
                const regex = new RegExp(pattern, 'i');
                return regex.test(str);
            } catch (e) { return false; }
        }
        return str.toLowerCase().includes(pattern.toLowerCase());
    });
}

export function shouldBlock(data, url = '') {
    if (url.match(/\.(mp4|jpg|png|webp|gif|mp3|wav)$/i)) return null;

    const isLargePayload = data && data.byteLength && data.byteLength > 5000;

    const str = isLargePayload
        ? (decode(data).substring(0, 15000) + ' ' + url).toLowerCase()
        : (decode(data) + ' ' + url).toLowerCase();

    if (isDebugMode()) {
        if (str.includes('seen') || str.includes('read') || str.includes('typing') || str.includes('presence')) {
            console.groupCollapsed('🕵️ Ghostify Inspector');
            console.log('URL:', url);
            console.log('Payload:', str.substring(0, 5000));
            console.groupEnd();
        }
    }

    if (isFacebookDotCom && !isLargePayload && str.length < 20000) {
        if (url.includes('graphql')) {
            console.log('👻 [NET-GQL] len=' + str.length + ' | TAIL: ' + str.substring(str.length - 800));
        } else if (str.includes('read') || str.includes('seen') || str.includes('mark') ||
            str.includes('thread') || str.includes('label') || str.includes('watermark')) {
            console.log('👻 [NET] ' + (url ? url.substring(0, 80) : 'WS') + ' | ' + str.substring(0, 400));
        }
    }

    if (isFacebookDotCom && SETTINGS.msgSeen && !isKilled('msgSeen') && url.includes('/api/graphql')) {
        if (
            str.includes('markthreadasread') ||
            str.includes('mark_thread_read') ||
            str.includes('markread') ||
            str.includes('markseen') ||
            str.includes('mark_read') ||
            str.includes('mark_seen') ||
            str.includes('read_watermark') ||
            str.includes('last_read_watermark') ||
            str.includes('read_receipt') ||
            str.includes('act_thread_id') ||
            str.includes('ebmessagemetadataquery')
        ) {
            console.log('🚫👻 [FB_GRAPHQL_SEEN] Blocked: ' + str.substring(str.length - 200));
            return 'FB_GRAPHQL_SEEN';
        }
    }

    if (isMessenger) {
        if (str.includes('delivery_receipt')) return null;

        if (SETTINGS.msgSeen && !isKilled('msgSeen')) {
            if (
                str.includes('messagelist_message_impression') ||
                str.includes('verify_threads_activity_status') ||
                (str.includes('armadillo_thread_id') && str.includes('impression')) ||
                str.includes('in_thread_banner_fetch_activity_banners_queue') ||
                str.includes('read_receipt')
            ) {
                return 'MSG_SEEN';
            }

            if (str.includes('last_read_watermark_ts') && !str.includes('send_type')) {
                return 'MSG_SEEN';
            }

            if (matchesPattern(str, PATTERNS.msgSeen)) {
                return 'MSG_SEEN';
            }
        }

        if (SETTINGS.msgTyping && !isKilled('msgTyping') && matchesPattern(str, PATTERNS.msgTyping)) {
            return 'MSG_TYPING';
        }
        if (SETTINGS.msgStory && !isKilled('msgStory') && matchesPattern(str, PATTERNS.msgStory)) {
            return 'MSG_STORY';
        }
        return null;
    }

    if (isInstagram) {
        if (str.includes('cursor') || url.includes('cursor')) {
            return null;
        }

        if (str.includes('query_hash') || (str.includes('doc_id') && !str.includes('mutation') && !str.includes('mark_seen') && !str.includes('mark_read') && !str.includes('thread_seen'))) {
            return null;
        }

        if (isLargePayload && !str.includes('seen') && !str.includes('mark_read')) {
            return null;
        }

        if (SETTINGS.igTyping && !isKilled('igTyping') && matchesPattern(str, PATTERNS.igTyping)) {
            return 'IG_TYPING';
        }
        if (SETTINGS.igStory && !isKilled('igStory') && matchesPattern(str, PATTERNS.igStory)) {
            return 'IG_STORY';
        }
        if (SETTINGS.igSeen && !isKilled('igSeen') && matchesPattern(str, PATTERNS.igSeen)) {
            return 'IG_SEEN';
        }
        return null;
    }

    return null;
}
