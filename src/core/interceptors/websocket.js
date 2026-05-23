import { sanitizeMessengerNetworkPayload, shouldBlock } from '../../utils/network.js';
import { markGhostifyHook, traceMessengerObservation, traceNetwork } from '../../utils/debug.js';
import { isMessengerDotCom } from '../../config.js';

export function hookWebSocket() {
    if (window.__GHOSTIFY_WEBSOCKET_HOOKED__) return;
    window.__GHOSTIFY_WEBSOCKET_HOOKED__ = true;

    const OriginalWebSocket = window.WebSocket;
    const originalPrototypeSend = OriginalWebSocket?.prototype?.send;
    const socketUrls = new WeakMap();
    markGhostifyHook('websocket.install', { hasWebSocket: typeof OriginalWebSocket === 'function' });

    if (typeof OriginalWebSocket !== 'function') return;

    function inspectSend(data, url) {
        const sanitized = sanitizeMessengerNetworkPayload(data, url);
        const inspectData = sanitized.changed ? sanitized.data : data;
        const blockType = shouldBlock(inspectData, url);
        traceNetwork('websocket', url, inspectData, blockType);
        traceMessengerObservation('websocket', url, inspectData, blockType);
        return {
            data: inspectData,
            drop: isMessengerDotCom ? blockType === 'MSG_SEEN' || blockType === 'MSG_TYPING' : !!blockType
        };
    }

    if (typeof originalPrototypeSend === 'function') {
        OriginalWebSocket.prototype.send = function (data) {
            const socketUrl = socketUrls.get(this) || this.url || '';
            const inspected = inspectSend(data, socketUrl);
            if (inspected.drop) return;
            if (inspected.data !== data) return originalPrototypeSend.call(this, inspected.data);
            return originalPrototypeSend.apply(this, arguments);
        };

        try {
            Object.defineProperty(OriginalWebSocket.prototype.send, '__ghostifyWebSocketSendWrapped', {
                value: true,
                configurable: true
            });
        } catch (e) { }
    }

    if (isMessengerDotCom) {
        markGhostifyHook('websocket.hooked', {
            messengerDotCom: true,
            prototypeSend: typeof originalPrototypeSend === 'function',
            constructorProxy: false
        });
        return;
    }

    const WebSocketProxy = new Proxy(OriginalWebSocket, {
        construct(target, args, newTarget) {
            const ws = Reflect.construct(target, args, newTarget);
            socketUrls.set(ws, String(args[0] || ''));
            return ws;
        },
        apply(target, thisArg, args) {
            const ws = Reflect.apply(target, thisArg, args);
            try {
                socketUrls.set(ws, String(args[0] || ''));
            } catch (e) { }
            return ws;
        }
    });

    window.WebSocket = WebSocketProxy;
    markGhostifyHook('websocket.hooked', {
        messengerDotCom: isMessengerDotCom,
        prototypeSend: typeof originalPrototypeSend === 'function',
        constructorProxy: true
    });
}
