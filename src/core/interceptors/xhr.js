import { shouldBlock } from '../../utils/network.js';
import { markGhostifyHook, traceMessengerObservation, traceNetwork } from '../../utils/debug.js';
import { createBlockedPayload } from '../../utils/responses.js';

export function hookXHR() {
    if (window.__GHOSTIFY_XHR_HOOKED__) return;
    window.__GHOSTIFY_XHR_HOOKED__ = true;

    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;
    markGhostifyHook('xhr.install', {
        hasOpen: typeof originalXhrOpen === 'function',
        hasSend: typeof originalXhrSend === 'function'
    });

    XMLHttpRequest.prototype.open = function (method, url, async) {
        this._ghostifyMethod = method || 'GET';
        this._ghostifyUrl = url;
        this._ghostifyAsync = async !== false;
        return originalXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        const blockType = shouldBlock(body, this._ghostifyUrl || '', { method: this._ghostifyMethod || 'GET' });
        traceNetwork('xhr', this._ghostifyUrl || '', body, blockType);
        traceMessengerObservation('xhr', this._ghostifyUrl || '', body, blockType);
        if (blockType) {
            return sendSyntheticJson(this, createBlockedPayload(blockType, this._ghostifyUrl || '', body));
        }

        return originalXhrSend.apply(this, arguments);
    };

    function sendSyntheticJson(xhr, payload) {
        const body = JSON.stringify(payload);
        const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(body)}`;

        try {
            originalXhrOpen.call(xhr, 'GET', dataUrl, xhr._ghostifyAsync !== false);
            return originalXhrSend.call(xhr);
        } catch (e) {
            return undefined;
        }
    }

    markGhostifyHook('xhr.hooked', { ok: true });
}
