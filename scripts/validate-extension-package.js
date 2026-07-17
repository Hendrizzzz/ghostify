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

function readConstObjectLiteral(source, constName) {
    const declaration = `const ${constName}`;
    const declarationIndex = source.indexOf(declaration);
    if (declarationIndex < 0) fail(`src/content.js must declare ${constName}`);

    const braceStart = source.indexOf('{', declarationIndex);
    if (braceStart < 0) fail(`src/content.js ${constName} must be an object literal`);

    let depth = 0;
    let quote = null;
    let escaped = false;

    for (let index = braceStart; index < source.length; index += 1) {
        const char = source[index];

        if (quote) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === quote) {
                quote = null;
            }
            continue;
        }

        if (char === '"' || char === "'" || char === '`') {
            quote = char;
            continue;
        }

        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(braceStart, index + 1);
            }
        }
    }

    fail(`src/content.js ${constName} object literal is incomplete`);
}

function readFallbackConfig(source) {
    return vm.runInNewContext(`(${readConstObjectLiteral(source, 'FALLBACK_CONFIG')})`, Object.create(null));
}

const pkg = readJson(repoPath('package.json'));
const lock = readJson(repoPath('package-lock.json'));
const manifest = readJson(repoPath('dist', 'manifest.json'));
const patterns = readJson(repoPath('dist', 'config', 'patterns.json'));
const privacyPolicy = fs.readFileSync(repoPath('PRIVACY.md'), 'utf8');
const contentSource = fs.readFileSync(repoPath('src', 'content.js'), 'utf8');
const popupHtml = fs.readFileSync(repoPath('dist', 'popup.html'), 'utf8');
const popupJs = fs.readFileSync(repoPath('dist', 'js', 'popup.js'), 'utf8');
const changelog = fs.readFileSync(repoPath('CHANGELOG.md'), 'utf8');
const statusJson = readJson(repoPath('site', 'src', 'app', 'statusData.json'));
if (fs.existsSync(repoPath('site', 'public', 'status.json'))) {
    fail('site/public/status.json must not exist; site/src/app/statusData.json is the canonical source');
}
const fallbackConfig = readFallbackConfig(contentSource);

const ALLOWED_PERMISSIONS = [
    'storage',
    'declarativeNetRequest'
];

const ALLOWED_HOST_PERMISSIONS = [
    'https://*.instagram.com/*',
    'https://*.messenger.com/*',
    'https://*.facebook.com/*',
    'https://www.fbsbx.com/*',
    'https://ghostify-extension.vercel.app/*'
];

const ALL_PLATFORM_MATCHES = [
    'https://*.instagram.com/*',
    'https://*.messenger.com/*',
    'https://*.facebook.com/*',
    'https://www.fbsbx.com/*'
];

const REQUIRED_PRIVACY_DISCLOSURES = [
    {
        label: 'runtime-scoped collection statement',
        phrases: [
            "Ghostify's extension runtime does not collect, store, share, or sell your personal data."
        ]
    },
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
        label: 'public status feed host disclosure',
        phrases: [
            'https://ghostify-extension.vercel.app/*',
            'fetch the display-only public status JSON'
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
            'GitHub issue forms',
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

const PUBLIC_STATUS_VALUES = [
    'maintainer_verified',
    'community_verified_reviewed',
    'under_review',
    'work_in_progress',
    'known_issue',
    'public_status_unavailable'
];

const VERIFIED_PUBLIC_STATUS_VALUES = new Set([
    'maintainer_verified',
    'community_verified_reviewed'
]);

const PUBLIC_STATUS_LOCAL_EVIDENCE_VALUES = [
    'manual_pending',
    'verified',
    'gap',
    'not_applicable'
];

const PUBLIC_STATUS_EVIDENCE_TYPES = [
    'sender_side_no_signal',
    'story_owner_no_view',
    'local_loaded',
    'local_probe_blocked',
    'manual_smoke_pending'
];

const PUBLIC_STATUS_SOURCE_TYPES = [
    'maintainer',
    'reviewed_community'
];

const PUBLIC_STATUS_PLATFORM_VALUES = [
    'Instagram',
    'Messenger',
    'Facebook'
];

const PUBLIC_STATUS_FEATURE_VALUES = [
    'Hide Seen',
    'Hide Typing',
    'Hide Story Views'
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

function assertBoolean(actual, expected, label) {
    if (actual !== expected) fail(`${label} must be ${expected}`);
}

function assertEnum(actual, allowed, label) {
    if (!allowed.includes(actual)) {
        fail(`${label} must be one of ${allowed.join(', ')}`);
    }
}

function assertObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        fail(`${label} must be an object`);
    }
}

function assertNullableIsoDate(value, label) {
    if (value === null) return;
    assertIsoDate(value, label);
}

function assertIsoDate(value, label) {
    if (typeof value !== 'string') fail(`${label} must be an ISO date string`);
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) {
        const [, year, month, day] = dateOnly;
        const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
        if (
            parsed.getUTCFullYear() === Number(year) &&
            parsed.getUTCMonth() === Number(month) - 1 &&
            parsed.getUTCDate() === Number(day)
        ) return;
        fail(`${label} must be an ISO date string`);
    }
    const timestamp = new Date(value);
    if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) ||
        Number.isNaN(timestamp.getTime()) ||
        timestamp.toISOString().replace('.000Z', 'Z') !== value
    ) {
        fail(`${label} must be an ISO date string`);
    }
}

function assertHttpsUrl(value, label) {
    if (typeof value !== 'string' || !value.startsWith('https://')) {
        fail(`${label} must be an HTTPS URL`);
    }
}

function assertNullableHttpsUrl(value, label) {
    if (value === null) return;
    assertHttpsUrl(value, label);
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

function assertPopupHasNoLabsOrSurvey() {
    if (/\bLabs\b/.test(popupHtml) || popupHtml.includes('tally.so') || /feature survey/i.test(popupHtml)) {
        fail('dist/popup.html must not include Labs or feature-survey UI');
    }

    if (popupJs.includes('attachViewListeners') || popupJs.includes('open-labs') || popupJs.includes('labs-view')) {
        fail('dist/js/popup.js must not include removed Labs navigation');
    }
}

function assertPopupPublicStatusLink() {
    if (!popupHtml.includes('https://ghostify-extension.vercel.app/status')) {
        fail('dist/popup.html must include the public verification status link');
    }

    if (!popupJs.includes('https://ghostify-extension.vercel.app/status.json')) {
        fail('dist/js/popup.js must fetch the display-only public status feed');
    }

    if (!popupJs.includes('latestPublicStatusRecord') || !popupJs.includes('data.history')) {
        fail('dist/js/popup.js must derive popup color and date from the latest public status record');
    }
}

function assertPopupPlatformLinks() {
    const expectedLinks = [
        ['Instagram', 'https://instagram.com/'],
        ['Messenger', 'https://messenger.com/'],
        ['Facebook', 'https://facebook.com/']
    ];

    for (const [label, href] of expectedLinks) {
        if (!popupHtml.includes(`href="${href}"`)) {
            fail(`dist/popup.html must link ${label} to ${href}`);
        }
    }
}

function assertStatusJsonContract() {
    assertObject(statusJson, 'site/src/app/statusData.json');
    assertOnlyKeys(statusJson, [
        'schemaVersion',
        'product',
        'productVersion',
        'generatedAt',
        'release',
        'statusUrl',
        'historyUrl',
        'summary',
        'policy',
        'automationPolicy',
        'communityVerification',
        'entries',
        'history'
    ], 'site/src/app/statusData.json');
    assertEqual(statusJson.schemaVersion, 1, 'site/src/app/statusData.json schemaVersion');
    assertEqual(statusJson.productVersion, pkg.version, 'site/src/app/statusData.json productVersion');
    assertHttpsUrl(statusJson.statusUrl, 'site/src/app/statusData.json statusUrl');
    assertHttpsUrl(statusJson.historyUrl, 'site/src/app/statusData.json historyUrl');
    assertNullableIsoDate(statusJson.generatedAt, 'site/src/app/statusData.json generatedAt');

    assertObject(statusJson.release, 'site/src/app/statusData.json release');
    assertOnlyKeys(statusJson.release, [
        'channel',
        'publishedAt',
        'publishedVersion',
        'verificationVersion',
        'checkedAt',
        'matchesVerificationBuild',
        'storeUrl'
    ], 'site/src/app/statusData.json release');
    assertEqual(statusJson.release.channel, 'Chrome Web Store', 'site/src/app/statusData.json release.channel');
    assertIsoDate(statusJson.release.publishedAt, 'site/src/app/statusData.json release.publishedAt');
    assertEqual(statusJson.release.publishedAt, '2026-02-06', 'site/src/app/statusData.json release.publishedAt');
    if (!statusJson.release.publishedVersion || typeof statusJson.release.publishedVersion !== 'string') {
        fail('site/src/app/statusData.json release.publishedVersion must be a non-empty string');
    }
    if (!statusJson.release.verificationVersion || typeof statusJson.release.verificationVersion !== 'string') {
        fail('site/src/app/statusData.json release.verificationVersion must be a non-empty string');
    }
    assertNullableIsoDate(statusJson.release.checkedAt, 'site/src/app/statusData.json release.checkedAt');
    assertHttpsUrl(statusJson.release.storeUrl, 'site/src/app/statusData.json release.storeUrl');
    assertEqual(
        statusJson.release.storeUrl,
        'https://chromewebstore.google.com/detail/ghostify-hide-seen-typing/flpnibonbhdmnpgflnbemgghghhblmpm',
        'site/src/app/statusData.json release.storeUrl'
    );
    assertEqual(
        statusJson.release.matchesVerificationBuild,
        statusJson.release.publishedVersion === statusJson.release.verificationVersion,
        'site/src/app/statusData.json release.matchesVerificationBuild'
    );
    if (Date.parse(statusJson.generatedAt) < Date.parse(statusJson.release.checkedAt)) {
        fail('site/src/app/statusData.json generatedAt must not predate release.checkedAt');
    }

    assertObject(statusJson.summary, 'site/src/app/statusData.json summary');
    assertOnlyKeys(statusJson.summary, ['publicStatus', 'label', 'message'], 'site/src/app/statusData.json summary');
    assertEnum(statusJson.summary.publicStatus, PUBLIC_STATUS_VALUES, 'site/src/app/statusData.json summary.publicStatus');
    if (!statusJson.summary.label || typeof statusJson.summary.label !== 'string') {
        fail('site/src/app/statusData.json summary.label must be a non-empty string');
    }
    if (!statusJson.summary.message || typeof statusJson.summary.message !== 'string') {
        fail('site/src/app/statusData.json summary.message must be a non-empty string');
    }
    if (!statusJson.release.matchesVerificationBuild && VERIFIED_PUBLIC_STATUS_VALUES.has(statusJson.summary.publicStatus)) {
        fail('site/src/app/statusData.json summary cannot be verified when the published Store version differs from the verification build');
    }
    assertObject(statusJson.policy, 'site/src/app/statusData.json policy');
    assertOnlyKeys(statusJson.policy, [
        'verificationCadence',
        'latestMergedUpdateWins',
        'ageDoesNotChangeStatus'
    ], 'site/src/app/statusData.json policy');
    assertBoolean(statusJson.policy.latestMergedUpdateWins, true, 'site/src/app/statusData.json policy.latestMergedUpdateWins');
    assertBoolean(statusJson.policy.ageDoesNotChangeStatus, true, 'site/src/app/statusData.json policy.ageDoesNotChangeStatus');

    assertObject(statusJson.automationPolicy, 'site/src/app/statusData.json automationPolicy');
    assertOnlyKeys(statusJson.automationPolicy, [
        'canFlagReports',
        'canSummarizeReports',
        'canDowngradeStatus',
        'canMarkVerified'
    ], 'site/src/app/statusData.json automationPolicy');
    assertBoolean(statusJson.automationPolicy.canFlagReports, true, 'site/src/app/statusData.json automationPolicy.canFlagReports');
    assertBoolean(statusJson.automationPolicy.canSummarizeReports, true, 'site/src/app/statusData.json automationPolicy.canSummarizeReports');
    assertBoolean(statusJson.automationPolicy.canDowngradeStatus, true, 'site/src/app/statusData.json automationPolicy.canDowngradeStatus');
    assertBoolean(statusJson.automationPolicy.canMarkVerified, false, 'site/src/app/statusData.json automationPolicy.canMarkVerified');

    assertObject(statusJson.communityVerification, 'site/src/app/statusData.json communityVerification');
    assertOnlyKeys(statusJson.communityVerification, [
        'requiresMaintainerReview',
        'publicCreditRequiresOptIn',
        'screenshotsMustBeRedacted',
        'privateMessagesAllowed',
        'rawSubmissionsShownInPopup'
    ], 'site/src/app/statusData.json communityVerification');
    assertBoolean(statusJson.communityVerification.requiresMaintainerReview, true, 'site/src/app/statusData.json communityVerification.requiresMaintainerReview');
    assertBoolean(statusJson.communityVerification.publicCreditRequiresOptIn, true, 'site/src/app/statusData.json communityVerification.publicCreditRequiresOptIn');
    assertBoolean(statusJson.communityVerification.screenshotsMustBeRedacted, true, 'site/src/app/statusData.json communityVerification.screenshotsMustBeRedacted');
    assertBoolean(statusJson.communityVerification.privateMessagesAllowed, false, 'site/src/app/statusData.json communityVerification.privateMessagesAllowed');
    assertBoolean(statusJson.communityVerification.rawSubmissionsShownInPopup, false, 'site/src/app/statusData.json communityVerification.rawSubmissionsShownInPopup');

    if (!Array.isArray(statusJson.entries) || !statusJson.entries.length) {
        fail('site/src/app/statusData.json entries must be a non-empty array');
    }
    if (statusJson.entries.length > 32) {
        fail('site/src/app/statusData.json entries must stay compact for popup use');
    }

    const expectedFeatureKeys = new Set();
    for (const platform of PUBLIC_STATUS_PLATFORM_VALUES) {
        for (const feature of PUBLIC_STATUS_FEATURE_VALUES) {
            expectedFeatureKeys.add(`${platform}:${feature}`);
        }
    }
    const actualFeatureKeys = new Set();

    for (const [index, entry] of statusJson.entries.entries()) {
        const label = `site/src/app/statusData.json entries[${index}]`;
        assertObject(entry, label);
        assertOnlyKeys(entry, [
            'id',
            'platform',
            'feature',
            'publicStatus',
            'localEvidenceStatus',
            'publicEvidenceType',
            'sourceType',
            'reviewer',
            'reviewRecord',
            'verifiedAt',
            'relatedIssueUrl',
            'notes'
        ], label);
        if (!entry.id || typeof entry.id !== 'string') fail(`${label}.id must be a non-empty string`);
        assertEnum(entry.platform, PUBLIC_STATUS_PLATFORM_VALUES, `${label}.platform`);
        assertEnum(entry.feature, PUBLIC_STATUS_FEATURE_VALUES, `${label}.feature`);
        assertEnum(entry.publicStatus, PUBLIC_STATUS_VALUES, `${label}.publicStatus`);
        if (!statusJson.release.matchesVerificationBuild && VERIFIED_PUBLIC_STATUS_VALUES.has(entry.publicStatus)) {
            fail(`${label}.publicStatus cannot be verified when the published Store version differs from the verification build`);
        }
        assertEnum(entry.localEvidenceStatus, PUBLIC_STATUS_LOCAL_EVIDENCE_VALUES, `${label}.localEvidenceStatus`);
        assertEnum(entry.publicEvidenceType, PUBLIC_STATUS_EVIDENCE_TYPES, `${label}.publicEvidenceType`);
        assertEnum(entry.sourceType, PUBLIC_STATUS_SOURCE_TYPES, `${label}.sourceType`);
        assertNullableIsoDate(entry.verifiedAt, `${label}.verifiedAt`);
        assertNullableHttpsUrl(entry.relatedIssueUrl, `${label}.relatedIssueUrl`);
        if (!entry.reviewer || typeof entry.reviewer !== 'string') fail(`${label}.reviewer must be a non-empty string`);
        if (!entry.reviewRecord || typeof entry.reviewRecord !== 'string') fail(`${label}.reviewRecord must be a non-empty string`);
        if (!entry.notes || typeof entry.notes !== 'string') fail(`${label}.notes must be a non-empty string`);

        if (VERIFIED_PUBLIC_STATUS_VALUES.has(entry.publicStatus)) {
            if (!entry.verifiedAt) fail(`${label}.verifiedAt is required for verified public status`);
            if (entry.localEvidenceStatus !== 'verified') {
                fail(`${label}.localEvidenceStatus must be verified for verified public status`);
            }
        }

        if (entry.publicStatus === 'maintainer_verified' && entry.sourceType !== 'maintainer') {
            fail(`${label}.sourceType must be maintainer for maintainer_verified`);
        }
        if (entry.publicStatus === 'community_verified_reviewed' && entry.sourceType !== 'reviewed_community') {
            fail(`${label}.sourceType must be reviewed_community for community_verified_reviewed`);
        }

        const featureKey = `${entry.platform}:${entry.feature}`;
        if (actualFeatureKeys.has(featureKey)) {
            fail(`site/src/app/statusData.json has duplicate public verification entry for ${featureKey}`);
        }
        actualFeatureKeys.add(featureKey);
    }

    for (const key of expectedFeatureKeys) {
        if (!actualFeatureKeys.has(key)) {
            fail(`site/src/app/statusData.json is missing public verification entry for ${key}`);
        }
    }

    if (statusJson.summary.publicStatus === 'maintainer_verified') {
        for (const [index, entry] of statusJson.entries.entries()) {
            if (entry.publicStatus !== 'maintainer_verified') {
                fail(`site/src/app/statusData.json entries[${index}].publicStatus must be maintainer_verified when summary is maintainer_verified`);
            }
        }
    }

    if (!Array.isArray(statusJson.history) || !statusJson.history.length) {
        fail('site/src/app/statusData.json history must be a non-empty array');
    }
    for (const [index, item] of statusJson.history.entries()) {
        const label = `site/src/app/statusData.json history[${index}]`;
        assertObject(item, label);
        assertOnlyKeys(item, ['date', 'publicStatus', 'eventType', 'title', 'summary'], label);
        assertNullableIsoDate(item.date, `${label}.date`);
        assertEnum(item.publicStatus, PUBLIC_STATUS_VALUES, `${label}.publicStatus`);
        assertEnum(item.eventType, ['release', 'fix', 'verification', 'incident', 'investigation'], `${label}.eventType`);
        if (!item.title || typeof item.title !== 'string') fail(`${label}.title must be a non-empty string`);
        if (!item.summary || typeof item.summary !== 'string') fail(`${label}.summary must be a non-empty string`);
        if (Date.parse(`${item.date}T00:00:00Z`) > Date.parse(statusJson.generatedAt)) {
            fail(`${label}.date must not be after generatedAt`);
        }
        if (index > 0 && Date.parse(item.date) > Date.parse(statusJson.history[index - 1].date)) {
            fail('site/src/app/statusData.json history must be newest-first; same-day records keep array order');
        }
    }
    const latestStatusRecord = statusJson.history.find(item =>
        item.eventType !== 'release' && item.eventType !== 'fix'
    ) || statusJson.history[0];
    if (latestStatusRecord.publicStatus !== statusJson.summary.publicStatus) {
        fail('site/src/app/statusData.json summary.publicStatus must match the latest verification status record');
    }
    if (statusJson.summary.publicStatus === 'maintainer_verified') {
        for (const [index, entry] of statusJson.entries.entries()) {
            if (String(entry.verifiedAt).slice(0, 10) !== latestStatusRecord.date) {
                fail(`site/src/app/statusData.json entries[${index}].verifiedAt must match the latest verification status date`);
            }
        }
    }

    const publicCopy = [
        statusJson.summary.label,
        statusJson.summary.message,
        ...statusJson.history.flatMap(item => [item.title, item.summary])
    ];
    const internalPhrases = [
        /\bmust be published\b/i,
        /\bmaintainer-approved\b/i,
        /\brepository (?:build|proof|evidence)\b/i,
        /\bverification build pending\b/i,
        /\bstatus-enabled store build\b/i
    ];
    for (const phrase of internalPhrases) {
        if (publicCopy.some(value => phrase.test(value))) {
            fail(`site/src/app/statusData.json public copy contains internal workflow language: ${phrase}`);
        }
    }
}

function assertChangelogCoversPackageVersion() {
    if (!changelog.includes(`## [${pkg.version}]`)) {
        fail(`CHANGELOG.md must include a release heading for ${pkg.version}`);
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
assertPopupHasNoLabsOrSurvey();
assertPopupPublicStatusLink();
assertPopupPlatformLinks();
assertChangelogCoversPackageVersion();
assertStatusJsonContract();
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
