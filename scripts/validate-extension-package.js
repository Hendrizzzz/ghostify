const fs = require("fs");
const path = require("path");
const {
    assertFallbackConfigMatchesPatterns,
    readFallbackConfig,
} = require("./lib/validation/fallback-config");
const {
    EXPECTED_CONTENT_SCRIPTS,
    EXPECTED_WEB_ACCESSIBLE_RESOURCES,
    assertContentScripts,
    assertManifestAssets,
    assertManifestPermissions,
    assertManifestVersion,
    assertWebAccessibleResources,
} = require("./lib/validation/manifest");
const {
    assertPopupHasNoLabsOrSurvey,
    assertPopupPlatformLinks,
    assertPopupPublicStatusLink,
} = require("./lib/validation/popup");
const {
    assertPrivacyPolicyCoversPermissions,
    assertPrivacyPolicyRequiredDisclosures,
} = require("./lib/validation/privacy-policy");
const {
    assertChangelogCoversPackageVersion,
    assertPackageVersions,
} = require("./lib/validation/release-metadata");
const {
    assertSiteSecurityHeaders,
    assertStatusFeedDisablesCaching,
} = require("./lib/validation/site-config");
const {
    assertNoDuplicateStatusSource,
    assertStatusJsonContract,
} = require("./lib/validation/status-feed");

// Resolve inputs from this script's location, not the working directory.
const repoRoot = path.resolve(__dirname, "..");

function repoPath(...segments) {
    return path.join(repoRoot, ...segments);
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

const pkg = readJson(repoPath("package.json"));
const lock = readJson(repoPath("package-lock.json"));
const manifest = readJson(repoPath("dist", "manifest.json"));
const patterns = readJson(repoPath("dist", "config", "patterns.json"));
const privacyPolicy = fs.readFileSync(repoPath("PRIVACY.md"), "utf8");
const contentSource = fs.readFileSync(repoPath("src", "content.js"), "utf8");
const popupHtml = fs.readFileSync(repoPath("dist", "popup.html"), "utf8");
const popupJs = fs.readFileSync(repoPath("dist", "js", "popup.js"), "utf8");
const changelog = fs.readFileSync(repoPath("CHANGELOG.md"), "utf8");
const statusJson = readJson(repoPath("site", "src", "app", "statusData.json"));
const siteHeaders = readJson(repoPath("site", "vercel.json"));
const siteViteConfig = fs.readFileSync(
    repoPath("site", "vite.config.ts"),
    "utf8",
);
assertNoDuplicateStatusSource(repoPath("site", "public", "status.json"));
const fallbackConfig = readFallbackConfig(contentSource);

// The checks run in a fixed order and stop at the first failure.
assertPackageVersions(pkg, lock);
assertManifestVersion(manifest, pkg.version);
assertManifestPermissions(manifest);
assertPrivacyPolicyCoversPermissions(privacyPolicy);
assertPrivacyPolicyRequiredDisclosures(privacyPolicy);
assertPopupHasNoLabsOrSurvey(popupHtml, popupJs);
assertPopupPublicStatusLink(popupHtml, popupJs);
assertStatusFeedDisablesCaching(siteHeaders, siteViteConfig);
assertSiteSecurityHeaders(siteHeaders);
assertPopupPlatformLinks(popupHtml);
assertChangelogCoversPackageVersion(changelog, pkg.version);
assertStatusJsonContract(statusJson, pkg.version);
assertContentScripts(manifest.content_scripts, EXPECTED_CONTENT_SCRIPTS);
assertWebAccessibleResources(
    manifest.web_accessible_resources,
    EXPECTED_WEB_ACCESSIBLE_RESOURCES,
);
assertFallbackConfigMatchesPatterns(fallbackConfig, patterns, pkg.version);
assertManifestAssets(manifest, repoRoot);

console.log(
    `extension package metadata and fallback config are valid for ${pkg.version}`,
);
