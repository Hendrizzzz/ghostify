import { SETTINGS, isKilled } from '../config.js';

export function getMessengerSpoofState() {
    if (SETTINGS.msgSeen && !isKilled('msgSeen')) {
        return 'unfocused';
    }

    return null;
}
