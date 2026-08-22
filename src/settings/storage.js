import {
    DEFAULT_PRIVACY_SETTINGS,
    FREE_PRIVACY_SETTING_KEYS,
} from "./defaults.js";

export const GHOSTIFY_SETTINGS_STORAGE_KEY = "ghostifySettings";

export function normalizePrivacySettings(settings) {
    const normalized = { ...DEFAULT_PRIVACY_SETTINGS };
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        return normalized;
    }

    for (const key of FREE_PRIVACY_SETTING_KEYS) {
        if (typeof settings[key] === "boolean") {
            normalized[key] = settings[key];
        }
    }

    return normalized;
}

export function sanitizePrivacySettingsForPage(settings) {
    return normalizePrivacySettings(settings);
}
