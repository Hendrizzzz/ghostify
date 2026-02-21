import { isMessengerDotCom, SETTINGS, isKilled } from '../config.js';

export function getMessengerSpoofState() {
    if (isMessengerDotCom && SETTINGS.msgSeen && !isKilled('msgSeen')) {
        return 'unfocused';
    }
    return null;
}
