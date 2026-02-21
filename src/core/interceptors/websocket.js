import { isFacebookDotCom, SETTINGS, isKilled } from '../../config.js';
import { shouldBlock } from '../../utils/network.js';

export function hookWebSocket() {
    const OriginalWebSocket = window.WebSocket;
    const originalWSSend = OriginalWebSocket.prototype.send;

    function checkHardBlock(data) {
        if (!(isFacebookDotCom && SETTINGS.msgSeen && !isKilled('msgSeen'))) return false;
        try {
            const raw = (data instanceof ArrayBuffer || ArrayBuffer.isView(data))
                ? new TextDecoder().decode(data) : (typeof data === 'string' ? data : '');
            if (raw.includes('read_receipt')) return true;
            if (raw.includes('last_read_watermark_ts') && !raw.includes('send_type')) return true;
        } catch (e) { }
        return false;
    }

    OriginalWebSocket.prototype.send = function (data) {
        if (checkHardBlock(data)) return;
        const blockType = shouldBlock(data);
        if (blockType) {
            console.log('🚫👻 [' + blockType + '] WS Blocked');
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
                console.log('🚫👻 [' + blockType + '] WS Blocked');
                return;
            }
            return boundSend(data);
        };
        return ws;
    };
    window.WebSocket.prototype = OriginalWebSocket.prototype;
    Object.assign(window.WebSocket, OriginalWebSocket);
}
