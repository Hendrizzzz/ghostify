const assert = require("assert");
const fs = require("fs");
const { loadSrcModule } = require("./helpers/load-src-module");

const { DEFAULT_PRIVACY_SETTINGS, FREE_PRIVACY_SETTING_KEYS } = loadSrcModule(
    "src/settings/defaults.js",
);
const {
    GHOSTIFY_MODULE_IDS,
    GHOSTIFY_MODULES,
    PUBLIC_MODULE_REGISTRY_VERSION,
    getGhostifyModule,
} = loadSrcModule("src/modules/registry.js");

const manifest = JSON.parse(fs.readFileSync("dist/manifest.json", "utf8"));
const REQUIRED_FIELDS = [
    "id",
    "label",
    "plan",
    "platforms",
    "risk",
    "releaseStage",
    "defaultEnabled",
    "entitlementFeature",
    "localKillSwitchKey",
    "remoteFlagKey",
    "manifestPermissionsWhenEnabled",
    "permissionCandidatesAfterReview",
    "dataClass",
    "uiSurface",
];

assert.strictEqual(PUBLIC_MODULE_REGISTRY_VERSION, 1);
assert.deepStrictEqual(GHOSTIFY_MODULE_IDS, ["ghostMode"]);
assert.strictEqual(
    GHOSTIFY_MODULES.length,
    1,
    "public registry should contain Free/Core modules only",
);
assert.strictEqual(getGhostifyModule("ghostMode"), GHOSTIFY_MODULES[0]);
assert.strictEqual(getGhostifyModule("unknownModule"), null);

const ids = new Set();
for (const moduleEntry of GHOSTIFY_MODULES) {
    for (const field of REQUIRED_FIELDS) {
        assert(
            Object.prototype.hasOwnProperty.call(moduleEntry, field),
            `registry entry ${moduleEntry.id || "<unknown>"} must include ${field}`,
        );
    }

    assert(!ids.has(moduleEntry.id), `duplicate module id: ${moduleEntry.id}`);
    ids.add(moduleEntry.id);
    assert.strictEqual(
        moduleEntry.plan,
        "free",
        `${moduleEntry.id} must stay Free/Core`,
    );
    assert.strictEqual(
        moduleEntry.entitlementFeature,
        null,
        `${moduleEntry.id} must not expose entitlement metadata`,
    );
    assert.strictEqual(
        moduleEntry.remoteFlagKey,
        null,
        `${moduleEntry.id} must not expose remote paid flags`,
    );
    assert.strictEqual(
        moduleEntry.requiresAccount,
        false,
        `${moduleEntry.id} must not require accounts`,
    );
    assert.strictEqual(
        moduleEntry.requiresRemoteService,
        false,
        `${moduleEntry.id} must not require remote services`,
    );
    assert.deepStrictEqual(moduleEntry.permissionCandidatesAfterReview, []);
    assert(
        Array.isArray(moduleEntry.firstReleasePlatforms),
        `${moduleEntry.id} must include firstReleasePlatforms`,
    );
    assert(
        Array.isArray(moduleEntry.plannedPlatforms),
        `${moduleEntry.id} must include plannedPlatforms`,
    );

    for (const permission of moduleEntry.manifestPermissionsWhenEnabled) {
        assert(
            manifest.permissions.includes(permission),
            `${moduleEntry.id} references manifest permission not present in dist/manifest.json: ${permission}`,
        );
    }
}

const ghostMode = getGhostifyModule("ghostMode");
assert.deepStrictEqual(ghostMode.platforms, [
    "instagram",
    "messenger",
    "facebook",
]);
assert.deepStrictEqual(ghostMode.firstReleasePlatforms, [
    "instagram",
    "messenger",
    "facebook",
]);
assert.deepStrictEqual(ghostMode.settingsKeys, FREE_PRIVACY_SETTING_KEYS);
assert.deepStrictEqual(ghostMode.defaultSettings, DEFAULT_PRIVACY_SETTINGS);
assert.strictEqual(ghostMode.storageKey, "ghostifySettings");
assert.strictEqual(ghostMode.defaultEnabled, true);
assert.strictEqual(ghostMode.localKillSwitchKey, "ghostMode");
assert.strictEqual(ghostMode.uiSurface, "popup");

const publicRegistrySource = fs.readFileSync("src/modules/registry.js", "utf8");
const generatedRuntimeSources = [
    "dist/background.js",
    "dist/js/content.js",
    "dist/js/ghost.js",
    "dist/js/messenger_patch.js",
]
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");

assert(
    !/plan:\s*['"]pro['"]/.test(publicRegistrySource),
    "public registry must not contain paid plan entries",
);
assert(
    !/entitlementFeature:\s*['"][^'"]+['"]/.test(publicRegistrySource),
    "public registry must not expose entitlement feature names",
);
assert(
    !/remoteFlagKey:\s*['"][^'"]+['"]/.test(publicRegistrySource),
    "public registry must not expose remote paid flags",
);
assert(
    !/\b(billing|checkout|subscription|locked|upgrade|paywall)\b/i.test(
        publicRegistrySource,
    ),
    "public registry must not contain paid-facing copy",
);
assert(
    !/\b(billing|checkout|subscription|paywall)\b/i.test(
        generatedRuntimeSources,
    ),
    "generated Free/Core runtime must not contain paid-service copy",
);

console.log("module registry contract tests passed");
