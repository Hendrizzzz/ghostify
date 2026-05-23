import { sanitizeMessengerNetworkPayload, shouldBlock } from '../../utils/network.js';
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
        const url = this._ghostifyUrl || '';
        const method = this._ghostifyMethod || 'GET';
        const sanitized = sanitizeMessengerNetworkPayload(body, url, { method });
        const inspectBody = sanitized.changed ? sanitized.data : body;
        const blockType = shouldBlock(inspectBody, url, { method });
        traceNetwork('xhr', url, inspectBody, blockType);
        traceMessengerObservation('xhr', url, inspectBody, blockType);
        if (blockType) {
            return sendSyntheticJson(this, createBlockedPayload(blockType, url, inspectBody));
        }

        if (sanitized.changed) return originalXhrSend.call(this, sanitized.data);
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
