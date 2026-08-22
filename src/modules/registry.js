import {
    DEFAULT_MODULE_FLAGS,
    DEFAULT_PRIVACY_SETTINGS,
    FREE_PRIVACY_SETTING_KEYS,
} from "../settings/defaults.js";

export const PUBLIC_MODULE_REGISTRY_VERSION = 1;

export const GHOSTIFY_MODULES = Object.freeze([
    Object.freeze({
        id: "ghostMode",
        label: "Ghost Mode",
        plan: "free",
        platforms: Object.freeze(["instagram", "messenger", "facebook"]),
        firstReleasePlatforms: Object.freeze([
            "instagram",
            "messenger",
            "facebook",
        ]),
        plannedPlatforms: Object.freeze([]),
        storageKey: "ghostifySettings",
        settingsKeys: FREE_PRIVACY_SETTING_KEYS,
        defaultSettings: DEFAULT_PRIVACY_SETTINGS,
        risk: "core-privacy",
        releaseStage: "stable",
        defaultEnabled: DEFAULT_MODULE_FLAGS.ghostMode,
        entitlementFeature: null,
        localKillSwitchKey: "ghostMode",
        remoteFlagKey: null,
        manifestPermissionsWhenEnabled: Object.freeze([
            "storage",
            "declarativeNetRequest",
        ]),
        permissionCandidatesAfterReview: Object.freeze([]),
        dataClass: "local-settings-and-transient-page-traffic",
        uiSurface: "popup",
        requiresAccount: false,
        requiresRemoteService: false,
    }),
]);

export const GHOSTIFY_MODULE_IDS = Object.freeze(
    GHOSTIFY_MODULES.map((module) => module.id),
);

const ALLOWED_REMOTE_POLICY_KEYS = Object.freeze([
    "schemaVersion",
    "disabledModules",
    "limitOverrides",
    "copy",
]);

const FORBIDDEN_REMOTE_POLICY_KEYS = new Set([
    "selector",
    "selectors",
    "regex",
    "regexes",
    "matcher",
    "matchers",
    "action",
    "actions",
    "actionRule",
    "actionRules",
    "action_rules",
    "css",
    "script",
    "scripts",
    "template",
    "templates",
    "html",
    "markdown",
    "url",
    "urls",
    "enabledModules",
    "enableModules",
    "features",
    "featureFlags",
    "permissions",
    "hostPermissions",
]);

const EXECUTABLE_TEXT_PATTERN =
    /<[^>]+>|javascript:|data:text\/html|eval\s*\(|function\s*\(|=>|import\s*\(|new\s+Function/i;
const REMOTE_POLICY_MODULE_IDS = new Set(GHOSTIFY_MODULE_IDS);

export function getGhostifyModule(id) {
    return GHOSTIFY_MODULES.find((module) => module.id === id) || null;
}

export function validateFreeCoreRemotePolicy(policy) {
    const errors = [];
    if (!isPlainObject(policy)) {
        return ["remote policy must be an object"];
    }

    collectForbiddenRemotePolicyFields(policy, "", errors);

    for (const key of Object.keys(policy)) {
        if (!ALLOWED_REMOTE_POLICY_KEYS.includes(key)) {
            errors.push(`remote policy field is not allowed: ${key}`);
        }
    }

    if (policy.schemaVersion !== 1) {
        errors.push("remote policy schemaVersion must be 1");
    }

    if (policy.disabledModules !== undefined) {
        if (!Array.isArray(policy.disabledModules)) {
            errors.push("remote policy disabledModules must be an array");
        } else {
            for (const moduleId of policy.disabledModules) {
                if (
                    typeof moduleId !== "string" ||
                    !REMOTE_POLICY_MODULE_IDS.has(moduleId)
                ) {
                    errors.push(
                        `remote policy disabledModules contains unknown module: ${String(moduleId)}`,
                    );
                }
            }
        }
    }

    if (policy.limitOverrides !== undefined) {
        if (!isPlainObject(policy.limitOverrides)) {
            errors.push("remote policy limitOverrides must be an object");
        } else {
            for (const [key, value] of Object.entries(policy.limitOverrides)) {
                if (!/^[a-z][A-Za-z0-9]*$/.test(key)) {
                    errors.push(
                        `remote policy limitOverrides key is invalid: ${key}`,
                    );
                }
                if (
                    typeof value !== "number" ||
                    !Number.isFinite(value) ||
                    value < 0
                ) {
                    errors.push(
                        `remote policy limitOverrides.${key} must be a non-negative number`,
                    );
                }
            }
        }
    }

    if (policy.copy !== undefined) {
        if (!isPlainObject(policy.copy)) {
            errors.push("remote policy copy must be an object");
        } else {
            for (const [key, value] of Object.entries(policy.copy)) {
                if (!/^[a-z][A-Za-z0-9]*$/.test(key)) {
                    errors.push(`remote policy copy key is invalid: ${key}`);
                }
                if (typeof value !== "string") {
                    errors.push(`remote policy copy.${key} must be a string`);
                } else if (EXECUTABLE_TEXT_PATTERN.test(value)) {
                    errors.push(`remote policy copy.${key} must be plain text`);
                }
            }
        }
    }

    return errors;
}

export function assertFreeCoreRemotePolicy(policy) {
    const errors = validateFreeCoreRemotePolicy(policy);
    if (errors.length) {
        throw new Error(errors.join("; "));
    }
    return true;
}

function collectForbiddenRemotePolicyFields(value, path, errors) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
        value.forEach((item, index) =>
            collectForbiddenRemotePolicyFields(
                item,
                `${path}[${index}]`,
                errors,
            ),
        );
        return;
    }

    for (const [key, child] of Object.entries(value)) {
        const childPath = path ? `${path}.${key}` : key;
        if (FORBIDDEN_REMOTE_POLICY_KEYS.has(key)) {
            errors.push(`remote policy field is not allowed: ${childPath}`);
        }
        collectForbiddenRemotePolicyFields(child, childPath, errors);
    }
}

function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
