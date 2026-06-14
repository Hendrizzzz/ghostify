const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');

function repoPath(...segments) {
    return path.join(repoRoot, ...segments);
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fail(message) {
    throw new Error(message);
}

function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value)
            .sort()
            .map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`)
            .join(',')}}`;
    }
    return JSON.stringify(value);
}

function readFallbackConfig(source) {
    const match = source.match(/const FALLBACK_CONFIG\s*=\s*({[\s\S]*?});\s*const DEFAULT_SETTINGS/);
    if (!match) fail('src/content.js must declare FALLBACK_CONFIG before DEFAULT_SETTINGS');
    return vm.runInNewContext(`(${match[1]})`, Object.create(null));
}

const pkg = readJson(repoPath('package.json'));
const lock = readJson(repoPath('package-lock.json'));
const manifest = readJson(repoPath('dist', 'manifest.json'));
const patterns = readJson(repoPath('dist', 'config', 'patterns.json'));
const privacyPolicy = fs.readFileSync(repoPath('PRIVACY.md'), 'utf8');
const contentSource = fs.readFileSync(repoPath('src', 'content.js'), 'utf8');
const fallbackConfig = readFallbackConfig(contentSource);

const ALLOWED_PERMISSIONS = [
    'storage',
    'declarativeNetRequest'
];

const ALLOWED_HOST_PERMISSIONS = [
    'https://*.instagram.com/*',
    'https://*.messenger.com/*',
    'https://*.facebook.com/*',
    'https://www.fbsbx.com/*'
];

const ALL_PLATFORM_MATCHES = [
    'https://*.instagram.com/*',
    'https://*.messenger.com/*',
    'https://*.facebook.com/*',
    'https://www.fbsbx.com/*'
];

const REQUIRED_PRIVACY_DISCLOSURES = [
    {
        label: 'local transient inspection disclosure',
        phrases: [
            'Ghostify transiently inspects request URLs, request payloads, and supported page or worker messages inside your browser',
            'does not send this inspected data to a Ghostify server'
        ]
    },
    {
        label: 'fbsbx proxy narrowing disclosure',
        phrases: [
            'https://www.fbsbx.com/*',
            'Ghostify limits Messenger-specific runtime behavior to supported Messenger proxy pages'
        ]
    },
    {
        label: 'Chrome Web Store Limited Use disclosure',
        phrases: [
            'Chrome Web Store User Data Policy',
            'Limited Use requirements'
        ]
    },
    {
        label: 'voluntary feedback disclosure',
        phrases: [
            'GitHub issue forms or Google Forms',
            'Do not submit private messages, credentials, or account-sensitive details'
        ]
    }
];

const MESSENGER_FACEBOOK_MATCHES = [
    'https://*.messenger.com/*',
    'https://*.facebook.com/*',
    'https://www.fbsbx.com/*'
];

const EXPECTED_CONTENT_SCRIPTS = [
    {
        js: ['js/content.js'],
        matches: ALL_PLATFORM_MATCHES,
        run_at: 'document_start',
        world: 'ISOLATED',
        all_frames: true,
        match_origin_as_fallback: true
    },
    {
        js: ['js/messenger_patch.js'],
        matches: MESSENGER_FACEBOOK_MATCHES,
        run_at: 'document_start',
        world: 'MAIN',
        all_frames: true,
        match_origin_as_fallback: true
    },
    {
        js: ['js/ghost.js'],
        matches: ALL_PLATFORM_MATCHES,
        run_at: 'document_start',
        world: 'MAIN',
        all_frames: true,
        match_origin_as_fallback: true
    }
];

const EXPECTED_WEB_ACCESSIBLE_RESOURCES = [
    {
        resources: ['config/patterns.json'],
        matches: ALL_PLATFORM_MATCHES
    }
];

function assertStringArray(value, label) {
    if (!Array.isArray(value)) fail(`${label} must be an array`);
    for (const [index, item] of value.entries()) {
        if (!item || typeof item !== 'string') fail(`${label}[${index}] must be a non-empty string`);
    }
}

function duplicateStrings(values) {
    const seen = new Set();
    const duplicates = new Set();
    for (const value of values) {
        if (seen.has(value)) duplicates.add(value);
        seen.add(value);
    }
    return [...duplicates];
}

function assertExactStringSet(actual, expected, label) {
    assertStringArray(actual, label);
    const duplicates = duplicateStrings(actual);
    if (duplicates.length) fail(`Duplicate ${label}: ${duplicates.join(', ')}`);

    const actualSet = new Set(actual);
    const expectedSet = new Set(expected);
    const unexpected = actual.filter(value => !expectedSet.has(value));
    const missing = expected.filter(value => !actualSet.has(value));

    if (unexpected.length) fail(`Unexpected ${label}: ${unexpected.join(', ')}`);
    if (missing.length) fail(`Missing ${label}: ${missing.join(', ')}`);
}

function assertEqual(actual, expected, label) {
    if (actual !== expected) fail(`${label} must be ${JSON.stringify(expected)}`);
}

function assertOnlyKeys(value, allowedKeys, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
    for (const key of Object.keys(value)) {
        if (!allowedKeys.includes(key)) fail(`Unexpected ${label} field: ${key}`);
    }
}

function assertNoOptionalPermissionFields(manifestValue) {
    for (const field of ['optional_permissions', 'optional_host_permissions']) {
        if (Object.prototype.hasOwnProperty.call(manifestValue, field)) {
            fail(`dist/manifest.json ${field} must not be declared`);
        }
    }
}

function assertPrivacyPolicyCoversPermissions() {
    const match = privacyPolicy.match(/### 2\.1\. Permissions Justification([\s\S]*?)(?:\n##\s|\n#\s|$)/);
    if (!match) fail('PRIVACY.md must include a Permissions Justification section');

    const section = match[1];
    const justified = [];
    for (const line of section.split(/\r?\n/)) {
        const bulletMatch = line.match(/^\*\s+\*\*[^`]*\(`([^`]+)`\):/);
        if (bulletMatch) justified.push(bulletMatch[1]);
    }

    const expected = [...ALLOWED_HOST_PERMISSIONS, ...ALLOWED_PERMISSIONS];
    for (const permission of expected) {
        if (!justified.includes(permission)) {
            const label = ALLOWED_HOST_PERMISSIONS.includes(permission) ? 'host permission' : 'permission';
            fail(`PRIVACY.md must justify ${permission} ${label}`);
        }
    }

    const expectedSet = new Set(expected);
    const unexpected = justified.filter(permission => !expectedSet.has(permission));
    if (unexpected.length) fail(`Unexpected PRIVACY.md permission justification: ${unexpected.join(', ')}`);
}

function assertPrivacyPolicyRequiredDisclosures() {
    for (const disclosure of REQUIRED_PRIVACY_DISCLOSURES) {
        for (const phrase of disclosure.phrases) {
            if (!privacyPolicy.includes(phrase)) {
                fail(`PRIVACY.md must include ${disclosure.label}`);
            }
        }
    }
}

function assertContentScripts(actual, expected) {
    if (!Array.isArray(actual)) fail('dist/manifest.json content_scripts must be an array');
    if (actual.length !== expected.length) {
        fail(`dist/manifest.json content_scripts must contain ${expected.length} entries`);
    }

    const actualByJs = new Map();
    for (const script of actual) {
        assertOnlyKeys(script, ['matches', 'js', 'run_at', 'world', 'all_frames', 'match_origin_as_fallback'], `content_scripts entry for ${(script.js || []).join(', ') || '<unknown>'}`);
        assertStringArray(script.js, 'content_scripts[].js');
        const key = stableJson(script.js);
        if (actualByJs.has(key)) fail(`Duplicate content_scripts entry for ${script.js.join(', ')}`);
        actualByJs.set(key, script);
    }

    for (const expectedScript of expected) {
        const key = stableJson(expectedScript.js);
        const script = actualByJs.get(key);
        if (!script) fail(`Missing content_scripts entry for ${expectedScript.js.join(', ')}`);

        const label = `content_scripts entry for ${expectedScript.js.join(', ')}`;
        assertExactStringSet(script.matches, expectedScript.matches, `${label} matches`);
        assertEqual(script.run_at, expectedScript.run_at, `${label} run_at`);
        assertEqual(script.world, expectedScript.world, `${label} world`);
        assertEqual(script.all_frames, expectedScript.all_frames, `${label} all_frames`);
        assertEqual(script.match_origin_as_fallback, expectedScript.match_origin_as_fallback, `${label} match_origin_as_fallback`);
    }

    for (const [key, script] of actualByJs.entries()) {
        if (!expected.some(expectedScript => stableJson(expectedScript.js) === key)) {
            fail(`Unexpected content_scripts entry for ${script.js.join(', ')}`);
        }
    }
}

function assertWebAccessibleResources(actual, expected) {
    if (!Array.isArray(actual)) fail('dist/manifest.json web_accessible_resources must be an array');
    if (actual.length !== expected.length) {
        fail(`dist/manifest.json web_accessible_resources must contain ${expected.length} entries`);
    }

    for (const [index, expectedGroup] of expected.entries()) {
        const group = actual[index];
        assertOnlyKeys(group, ['resources', 'matches'], `web_accessible_resources[${index}]`);
        assertExactStringSet(group.resources, expectedGroup.resources, `web_accessible_resources[${index}].resources`);
        assertExactStringSet(group.matches, expectedGroup.matches, `web_accessible_resources[${index}].matches`);
    }
}

if (!pkg.version) fail('package.json must declare a version');
if (lock.version && lock.version !== pkg.version) {
    fail(`package-lock.json version ${lock.version} does not match package.json ${pkg.version}`);
}
if (lock.packages?.['']?.version && lock.packages[''].version !== pkg.version) {
    fail(`package-lock root package version ${lock.packages[''].version} does not match package.json ${pkg.version}`);
}
if (manifest.manifest_version !== 3) fail('dist/manifest.json manifest_version must be 3');
if (manifest.version !== pkg.version) {
    fail(`dist/manifest.json version ${manifest.version} does not match package.json ${pkg.version}`);
}
assertExactStringSet(manifest.permissions, ALLOWED_PERMISSIONS, 'dist/manifest.json permissions');
assertExactStringSet(manifest.host_permissions, ALLOWED_HOST_PERMISSIONS, 'dist/manifest.json host_permissions');
assertNoOptionalPermissionFields(manifest);
assertPrivacyPolicyCoversPermissions();
assertPrivacyPolicyRequiredDisclosures();
assertContentScripts(manifest.content_scripts, EXPECTED_CONTENT_SCRIPTS);
assertWebAccessibleResources(manifest.web_accessible_resources, EXPECTED_WEB_ACCESSIBLE_RESOURCES);
if (patterns.version !== pkg.version) {
    fail(`dist/config/patterns.json version ${patterns.version} does not match package.json ${pkg.version}`);
}
if (fallbackConfig.version !== pkg.version) {
    fail(`src/content.js fallback config version ${fallbackConfig.version || '<missing>'} does not match package.json ${pkg.version}`);
}
if (stableJson(fallbackConfig.killSwitch || []) !== stableJson(patterns.killSwitch || [])) {
    fail('src/content.js fallback killSwitch does not match dist/config/patterns.json');
}
if (stableJson(fallbackConfig.patterns || {}) !== stableJson(patterns.patterns || {})) {
    fail('src/content.js fallback patterns do not match dist/config/patterns.json');
}

const requiredFiles = new Set();

function addRequired(file, label) {
    if (!file || typeof file !== 'string') fail(`${label} must be a non-empty string`);
    requiredFiles.add(file.replace(/^\/+/, ''));
}

addRequired(manifest.background?.service_worker, 'background.service_worker');
addRequired(manifest.action?.default_popup, 'action.default_popup');
Object.entries(manifest.icons || {}).forEach(([size, file]) => addRequired(file, `icons.${size}`));

for (const [index, script] of (manifest.content_scripts || []).entries()) {
    if (!Array.isArray(script.js) || script.js.length === 0) {
        fail(`content_scripts[${index}].js must list at least one script`);
    }
    script.js.forEach(file => addRequired(file, `content_scripts[${index}].js`));
}

for (const [index, group] of (manifest.web_accessible_resources || []).entries()) {
    if (!Array.isArray(group.resources) || group.resources.length === 0) {
        fail(`web_accessible_resources[${index}].resources must list at least one resource`);
    }
    group.resources.forEach(file => addRequired(file, `web_accessible_resources[${index}].resources`));
}

for (const file of requiredFiles) {
    const fullPath = repoPath('dist', file);
    if (!fs.existsSync(fullPath)) fail(`Missing manifest asset: ${fullPath}`);
}

console.log(`extension package metadata and fallback config are valid for ${pkg.version}`);
