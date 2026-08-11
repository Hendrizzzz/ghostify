const fs = require('fs');
const path = require('path');

const { collectManifestFiles, createFirefoxManifest } = require('./prepare-firefox-extension');

const repoRoot = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const chromiumManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'dist', 'manifest.json'), 'utf8'));
const firefoxManifest = createFirefoxManifest();
const popupJs = fs.readFileSync(path.join(repoRoot, 'dist', 'js', 'popup.js'), 'utf8');
const firefoxReleaseChecklist = fs.readFileSync(path.join(repoRoot, 'docs', 'FIREFOX_RELEASE_CHECKLIST.md'), 'utf8');
const firefoxSubmissionPacket = fs.readFileSync(path.join(repoRoot, 'docs', 'FIREFOX_AMO_SUBMISSION.md'), 'utf8');
const browserDistribution = fs.readFileSync(path.join(repoRoot, 'docs', 'BROWSER_DISTRIBUTION.md'), 'utf8');
const changelog = fs.readFileSync(path.join(repoRoot, 'CHANGELOG.md'), 'utf8');
const statusHost = 'https://ghostify-extension.vercel.app/*';
const expectedId = 'ghostify@ghostify-extension.vercel.app';

function fail(message) {
    throw new Error(message);
}

if (firefoxManifest.manifest_version !== 3) fail('Firefox manifest must use Manifest V3');
if (firefoxManifest.version !== pkg.version) fail('Firefox manifest version must match package.json');
if (firefoxManifest.background?.service_worker) fail('Firefox manifest must not declare background.service_worker');
if (JSON.stringify(firefoxManifest.background?.scripts) !== JSON.stringify(['background.js'])) {
    fail('Firefox manifest must load background.js through background.scripts');
}
if (firefoxManifest.browser_specific_settings?.gecko?.id !== expectedId) {
    fail(`Firefox manifest must preserve the permanent add-on ID ${expectedId}`);
}
if (firefoxManifest.browser_specific_settings.gecko.strict_min_version !== '140.0') {
    fail('Firefox strict_min_version must remain 140.0 or be reviewed with the compatibility contract');
}
if (firefoxManifest.browser_specific_settings.gecko_android?.strict_min_version !== '142.0') {
    fail('Firefox for Android parser compatibility must remain at 142.0 or later');
}
if (JSON.stringify(firefoxManifest.browser_specific_settings.gecko.data_collection_permissions) !== JSON.stringify({ required: ['none'] })) {
    fail('Firefox package must declare no collection or transmission of user data');
}
if (!firefoxManifest.host_permissions.includes(statusHost)) {
    fail('Firefox package must request the public status-feed host permission');
}
if (!chromiumManifest.host_permissions.includes(statusHost)) {
    fail('Chromium package must retain the Ghostify status-feed host permission');
}
if (JSON.stringify(firefoxManifest.host_permissions) !== JSON.stringify(chromiumManifest.host_permissions)) {
    fail('Firefox and Chromium host permissions must stay aligned');
}
if (popupJs.includes('isFirefoxPackage')) {
    fail('Popup must not bypass the public status feed in Firefox');
}
if (!popupJs.includes('new XMLHttpRequest()') || popupJs.includes('fetch(PUBLIC_STATUS_FEED_URL')) {
    fail('Popup public-status request must use privileged XMLHttpRequest rather than Fetch');
}
if (!popupJs.includes('request.withCredentials = false')) {
    fail('Popup public-status request must omit credentials');
}

const androidPublicationDocs = [
    ['docs/FIREFOX_RELEASE_CHECKLIST.md', firefoxReleaseChecklist],
    ['docs/FIREFOX_AMO_SUBMISSION.md', firefoxSubmissionPacket],
    ['docs/BROWSER_DISTRIBUTION.md', browserDistribution],
    ['CHANGELOG.md', changelog]
];
const obsoleteDesktopOnlyPhrases = [
    /desktop-only AMO submission/i,
    /Firefox desktop only/i,
    /Select desktop only/i,
    /do not claim Android support/i,
    /before Android publication/i
];
for (const [file, contents] of androidPublicationDocs) {
    for (const phrase of obsoleteDesktopOnlyPhrases) {
        if (phrase.test(contents)) fail(`${file} contradicts the Firefox Android manifest declaration`);
    }
}
if (!firefoxReleaseChecklist.includes('Firefox for Android minimum version: `142.0`')) {
    fail('Firefox release checklist must record the Firefox for Android 142.0 minimum');
}
if (!firefoxSubmissionPacket.includes('Firefox desktop and Firefox for Android')) {
    fail('Firefox AMO submission packet must select desktop and Android compatibility');
}

const comparableKeys = [
    'name',
    'description',
    'permissions',
    'action',
    'content_scripts',
    'web_accessible_resources'
];
for (const key of comparableKeys) {
    if (JSON.stringify(firefoxManifest[key]) !== JSON.stringify(chromiumManifest[key])) {
        fail(`Firefox manifest unexpectedly diverges from Chromium field: ${key}`);
    }
}
if (JSON.stringify(firefoxManifest.icons) !== JSON.stringify({
    16: 'icons/icon16.png',
    128: 'icons/icon128.png'
})) {
    fail('Firefox manifest must package only icons whose declared dimensions match their files');
}

for (const relativePath of collectManifestFiles(firefoxManifest)) {
    if (relativePath === 'manifest.json') continue;
    if (!fs.existsSync(path.join(repoRoot, 'dist', relativePath))) {
        fail(`Firefox manifest references missing asset: ${relativePath}`);
    }
}

console.log(`Firefox extension metadata is valid for ${pkg.version}`);
