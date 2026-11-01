// Expectations for dist/manifest.json: version, permission surface, content
// scripts, web-accessible resources, and the packaged files it references.

const fs = require("fs");
const path = require("path");
const {
    assertEqual,
    assertExactStringSet,
    assertOnlyKeys,
    assertStringArray,
    fail,
    stableJson,
} = require("./assertions");

const ALLOWED_PERMISSIONS = ["storage", "declarativeNetRequest"];

const ALLOWED_HOST_PERMISSIONS = [
    "https://*.instagram.com/*",
    "https://*.messenger.com/*",
    "https://*.facebook.com/*",
    "https://www.fbsbx.com/*",
    "https://ghostify-extension.vercel.app/*",
];

const ALL_PLATFORM_MATCHES = [
    "https://*.instagram.com/*",
    "https://*.messenger.com/*",
    "https://*.facebook.com/*",
    "https://www.fbsbx.com/*",
];

const MESSENGER_FACEBOOK_MATCHES = [
    "https://*.messenger.com/*",
    "https://*.facebook.com/*",
    "https://www.fbsbx.com/*",
];

const EXPECTED_CONTENT_SCRIPTS = [
    {
        js: ["js/content.js"],
        matches: ALL_PLATFORM_MATCHES,
        run_at: "document_start",
        world: "ISOLATED",
        all_frames: true,
        match_origin_as_fallback: true,
    },
    {
        js: ["js/messenger_patch.js"],
        matches: MESSENGER_FACEBOOK_MATCHES,
        run_at: "document_start",
        world: "MAIN",
        all_frames: true,
        match_origin_as_fallback: true,
    },
    {
        js: ["js/ghost.js"],
        matches: ALL_PLATFORM_MATCHES,
        run_at: "document_start",
        world: "MAIN",
        all_frames: true,
        match_origin_as_fallback: true,
    },
];

const EXPECTED_WEB_ACCESSIBLE_RESOURCES = [
    {
        resources: ["config/patterns.json"],
        matches: ALL_PLATFORM_MATCHES,
    },
];

function assertManifestVersion(manifest, version) {
    if (manifest.manifest_version !== 3)
        fail("dist/manifest.json manifest_version must be 3");
    if (manifest.version !== version) {
        fail(
            `dist/manifest.json version ${manifest.version} does not match package.json ${version}`,
        );
    }
}

function assertNoOptionalPermissionFields(manifestValue) {
    for (const field of ["optional_permissions", "optional_host_permissions"]) {
        if (Object.prototype.hasOwnProperty.call(manifestValue, field)) {
            fail(`dist/manifest.json ${field} must not be declared`);
        }
    }
}

function assertManifestPermissions(manifest) {
    assertExactStringSet(
        manifest.permissions,
        ALLOWED_PERMISSIONS,
        "dist/manifest.json permissions",
    );
    assertExactStringSet(
        manifest.host_permissions,
        ALLOWED_HOST_PERMISSIONS,
        "dist/manifest.json host_permissions",
    );
    assertNoOptionalPermissionFields(manifest);
}

function assertContentScripts(actual, expected) {
    if (!Array.isArray(actual))
        fail("dist/manifest.json content_scripts must be an array");
    if (actual.length !== expected.length) {
        fail(
            `dist/manifest.json content_scripts must contain ${expected.length} entries`,
        );
    }

    const actualByJs = new Map();
    for (const script of actual) {
        assertOnlyKeys(
            script,
            [
                "matches",
                "js",
                "run_at",
                "world",
                "all_frames",
                "match_origin_as_fallback",
            ],
            `content_scripts entry for ${(script.js || []).join(", ") || "<unknown>"}`,
        );
        assertStringArray(script.js, "content_scripts[].js");
        const key = stableJson(script.js);
        if (actualByJs.has(key))
            fail(`Duplicate content_scripts entry for ${script.js.join(", ")}`);
        actualByJs.set(key, script);
    }

    for (const expectedScript of expected) {
        const key = stableJson(expectedScript.js);
        const script = actualByJs.get(key);
        if (!script)
            fail(
                `Missing content_scripts entry for ${expectedScript.js.join(", ")}`,
            );

        const label = `content_scripts entry for ${expectedScript.js.join(", ")}`;
        assertExactStringSet(
            script.matches,
            expectedScript.matches,
            `${label} matches`,
        );
        assertEqual(script.run_at, expectedScript.run_at, `${label} run_at`);
        assertEqual(script.world, expectedScript.world, `${label} world`);
        assertEqual(
            script.all_frames,
            expectedScript.all_frames,
            `${label} all_frames`,
        );
        assertEqual(
            script.match_origin_as_fallback,
            expectedScript.match_origin_as_fallback,
            `${label} match_origin_as_fallback`,
        );
    }

    for (const [key, script] of actualByJs.entries()) {
        if (
            !expected.some(
                (expectedScript) => stableJson(expectedScript.js) === key,
            )
        ) {
            fail(
                `Unexpected content_scripts entry for ${script.js.join(", ")}`,
            );
        }
    }
}

function assertWebAccessibleResources(actual, expected) {
    if (!Array.isArray(actual))
        fail("dist/manifest.json web_accessible_resources must be an array");
    if (actual.length !== expected.length) {
        fail(
            `dist/manifest.json web_accessible_resources must contain ${expected.length} entries`,
        );
    }

    for (const [index, expectedGroup] of expected.entries()) {
        const group = actual[index];
        assertOnlyKeys(
            group,
            ["resources", "matches"],
            `web_accessible_resources[${index}]`,
        );
        assertExactStringSet(
            group.resources,
            expectedGroup.resources,
            `web_accessible_resources[${index}].resources`,
        );
        assertExactStringSet(
            group.matches,
            expectedGroup.matches,
            `web_accessible_resources[${index}].matches`,
        );
    }
}

function readPngDimensions(file) {
    const data = fs.readFileSync(file);
    const pngSignature = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    if (
        data.length < 24 ||
        !data.subarray(0, 8).equals(pngSignature) ||
        data.toString("ascii", 12, 16) !== "IHDR"
    ) {
        fail(`${file} must be a valid PNG with an IHDR header`);
    }
    return {
        width: data.readUInt32BE(16),
        height: data.readUInt32BE(20),
    };
}

// Every file the manifest references must exist under dist/, and each icon
// must be a PNG whose pixel size matches its declared size.
function assertManifestAssets(manifest, repoRoot) {
    const requiredFiles = new Set();

    function addRequired(file, label) {
        if (!file || typeof file !== "string")
            fail(`${label} must be a non-empty string`);
        requiredFiles.add(file.replace(/^\/+/, ""));
    }

    addRequired(
        manifest.background?.service_worker,
        "background.service_worker",
    );
    addRequired(manifest.action?.default_popup, "action.default_popup");
    Object.entries(manifest.icons || {}).forEach(([size, file]) =>
        addRequired(file, `icons.${size}`),
    );

    for (const [index, script] of (manifest.content_scripts || []).entries()) {
        if (!Array.isArray(script.js) || script.js.length === 0) {
            fail(`content_scripts[${index}].js must list at least one script`);
        }
        script.js.forEach((file) =>
            addRequired(file, `content_scripts[${index}].js`),
        );
    }

    for (const [index, group] of (
        manifest.web_accessible_resources || []
    ).entries()) {
        if (!Array.isArray(group.resources) || group.resources.length === 0) {
            fail(
                `web_accessible_resources[${index}].resources must list at least one resource`,
            );
        }
        group.resources.forEach((file) =>
            addRequired(file, `web_accessible_resources[${index}].resources`),
        );
    }

    for (const file of requiredFiles) {
        const fullPath = path.join(repoRoot, "dist", file);
        if (!fs.existsSync(fullPath))
            fail(`Missing manifest asset: ${fullPath}`);
    }

    for (const [declaredSize, file] of Object.entries(manifest.icons || {})) {
        const size = Number(declaredSize);
        if (!Number.isInteger(size) || size <= 0)
            fail(`Invalid manifest icon size: ${declaredSize}`);
        const fullPath = path.join(repoRoot, "dist", file);
        const dimensions = readPngDimensions(fullPath);
        if (dimensions.width !== size || dimensions.height !== size) {
            fail(
                `Manifest icon ${file} is declared as ${size}x${size} but is ${dimensions.width}x${dimensions.height}`,
            );
        }
    }
}

module.exports = {
    ALLOWED_HOST_PERMISSIONS,
    ALLOWED_PERMISSIONS,
    EXPECTED_CONTENT_SCRIPTS,
    EXPECTED_WEB_ACCESSIBLE_RESOURCES,
    assertContentScripts,
    assertManifestAssets,
    assertManifestPermissions,
    assertManifestVersion,
    assertWebAccessibleResources,
};
