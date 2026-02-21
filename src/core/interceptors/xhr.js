import { isFacebookDotCom, SETTINGS, isKilled, isDebugMode } from '../../config.js';
import { shouldBlock } from '../../utils/network.js';

export function hookXHR() {
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        this._ghostifyUrl = url;
        return originalXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        const url = (this._ghostifyUrl || '').toLowerCase();
        const finalBody = (typeof body === 'string' ? body : JSON.stringify(body || {})).toLowerCase();

        if (isFacebookDotCom && SETTINGS.msgSeen && !isKilled('msgSeen')) {
            if (url.includes('ebmessagemetadataquery') || finalBody.includes('ebmessagemetadataquery')) {
                console.log(`🚫👻 [HARD BLOCK FB_GRAPHQL_SEEN] XHR Dropped!`);
                return;
            }
        }

        const blockType = shouldBlock(body, this._ghostifyUrl || '');
        if (blockType) {
            if (isDebugMode()) console.log(`🚫 [${blockType}] XHR Blocked`);
            return;
        }
        return originalXhrSend.apply(this, arguments);
    };
}
