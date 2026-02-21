import { isFacebookDotCom, SETTINGS, isKilled, isDebugMode } from '../../config.js';
import { shouldBlock } from '../../utils/network.js';

export function hookFetch() {
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
        const url = typeof input === 'string' ? input : (input?.url || '');
        const body = init?.body || '';

        if (isFacebookDotCom && SETTINGS.msgSeen && !isKilled('msgSeen')) {
            const finalUrl = url.toLowerCase();
            const finalBody = (typeof body === 'string' ? body : JSON.stringify(body || {})).toLowerCase();
            if (finalUrl.includes('ebmessagemetadataquery') || finalBody.includes('ebmessagemetadataquery')) {
                return new Response('{"data":{"ebmessagemetadataquery":null}}', {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        const blockType = shouldBlock(body, url);
        if (blockType) {
            return new Response('{"status":"ok"}', {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return originalFetch.apply(this, arguments);
    };

    const originalBeacon = navigator.sendBeacon;
    navigator.sendBeacon = function (url, data) {
        const blockType = shouldBlock(data, url);
        if (blockType) {
            return true;
        }
        return originalBeacon.apply(this, arguments);
    };
}
