const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const pkg = require('../package.json');

function copyFixture() {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ghostify-validate-'));
    fs.mkdirSync(path.join(fixtureRoot, 'scripts'), { recursive: true });

    for (const file of ['package.json', 'package-lock.json', 'PRIVACY.md']) {
        fs.copyFileSync(path.join(repoRoot, file), path.join(fixtureRoot, file));
    }
    fs.copyFileSync(path.join(repoRoot, 'CHANGELOG.md'), path.join(fixtureRoot, 'CHANGELOG.md'));

    fs.cpSync(path.join(repoRoot, 'dist'), path.join(fixtureRoot, 'dist'), { recursive: true });
    fs.cpSync(path.join(repoRoot, 'src'), path.join(fixtureRoot, 'src'), { recursive: true });
    fs.mkdirSync(path.join(fixtureRoot, 'site', 'public'), { recursive: true });
    fs.copyFileSync(
        path.join(repoRoot, 'site', 'public', 'status.json'),
        path.join(fixtureRoot, 'site', 'public', 'status.json')
    );
    fs.mkdirSync(path.join(fixtureRoot, 'site', 'src', 'app'), { recursive: true });
    fs.copyFileSync(
        path.join(repoRoot, 'site', 'src', 'app', 'statusData.json'),
        path.join(fixtureRoot, 'site', 'src', 'app', 'statusData.json')
    );
    fs.copyFileSync(
        path.join(repoRoot, 'scripts', 'validate-extension-package.js'),
        path.join(fixtureRoot, 'scripts', 'validate-extension-package.js')
    );

    return fixtureRoot;
}

function runValidator(cwd) {
    return childProcess.spawnSync(process.execPath, ['scripts/validate-extension-package.js'], {
        cwd,
        encoding: 'utf8'
    });
}

function runValidatorFrom(cwd, scriptPath) {
    return childProcess.spawnSync(process.execPath, [scriptPath], {
        cwd,
        encoding: 'utf8'
    });
}

function readManifest(fixtureRoot) {
    const manifestPath = path.join(fixtureRoot, 'dist', 'manifest.json');
    return {
        manifestPath,
        manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    };
}

function writeManifest(manifestPath, manifest) {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);
}

function readStatusJson(fixtureRoot) {
    const statusPath = path.join(fixtureRoot, 'site', 'public', 'status.json');
    return {
        statusPath,
        statusJson: JSON.parse(fs.readFileSync(statusPath, 'utf8'))
    };
}

function writeStatusJson(statusPath, statusJson) {
    fs.writeFileSync(statusPath, `${JSON.stringify(statusJson, null, 2)}\n`);
}

function writeStatusJsonPair(fixtureRoot, statusJson) {
    writeStatusJson(path.join(fixtureRoot, 'site', 'public', 'status.json'), statusJson);
    writeStatusJson(path.join(fixtureRoot, 'site', 'src', 'app', 'statusData.json'), statusJson);
}

function withFixture(testFn) {
    const fixtureRoot = copyFixture();
    try {
        testFn(fixtureRoot);
    } finally {
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
}

withFixture(fixtureRoot => {
    const result = runValidator(fixtureRoot);
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
});

withFixture(fixtureRoot => {
    const result = runValidatorFrom(
        path.dirname(fixtureRoot),
        path.join(fixtureRoot, 'scripts', 'validate-extension-package.js')
    );
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
});

withFixture(fixtureRoot => {
    const { manifestPath, manifest } = readManifest(fixtureRoot);
    manifest.permissions.push('tabs');
    writeManifest(manifestPath, manifest);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject unexpected manifest permissions');
    assert.match(
        result.stderr,
        /Unexpected dist\/manifest\.json permissions: tabs/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { manifestPath, manifest } = readManifest(fixtureRoot);
    manifest.permissions.push('storage');
    writeManifest(manifestPath, manifest);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject duplicate manifest permissions');
    assert.match(
        result.stderr,
        /Duplicate dist\/manifest\.json permissions: storage/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { manifestPath, manifest } = readManifest(fixtureRoot);
    manifest.host_permissions.push('https://example.com/*');
    writeManifest(manifestPath, manifest);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject unexpected host permissions');
    assert.match(
        result.stderr,
        /Unexpected dist\/manifest\.json host_permissions: https:\/\/example\.com\/\*/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const privacyPath = path.join(fixtureRoot, 'PRIVACY.md');
    fs.writeFileSync(
        privacyPath,
        fs.readFileSync(privacyPath, 'utf8').replace('`https://www.fbsbx.com/*`', '`https://www.example.com/*`')
    );

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject missing privacy-policy host permission coverage');
    assert.match(
        result.stderr,
        /PRIVACY\.md must justify https:\/\/www\.fbsbx\.com\/\* host permission/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const privacyPath = path.join(fixtureRoot, 'PRIVACY.md');
    fs.writeFileSync(
        privacyPath,
        fs.readFileSync(privacyPath, 'utf8').replace('`storage`', '`localStorage`')
    );

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject missing privacy-policy permission coverage');
    assert.match(
        result.stderr,
        /PRIVACY\.md must justify storage permission/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const privacyPath = path.join(fixtureRoot, 'PRIVACY.md');
    fs.writeFileSync(
        privacyPath,
        fs.readFileSync(privacyPath, 'utf8').replace(
            '*   **Declarative Net Request permission (`declarativeNetRequest`):',
            '*   **Tabs permission (`tabs`):** Not used.\n*   **Declarative Net Request permission (`declarativeNetRequest`):'
        )
    );

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject stale extra privacy-policy permission entries');
    assert.match(
        result.stderr,
        /Unexpected PRIVACY\.md permission justification: tabs/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const privacyPath = path.join(fixtureRoot, 'PRIVACY.md');
    fs.writeFileSync(
        privacyPath,
        fs.readFileSync(privacyPath, 'utf8').replace(
            "Ghostify's extension runtime does not collect, store, share, or sell your personal data.",
            'Ghostify does not collect personal data.'
        )
    );

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject collection claims that are not scoped to the extension runtime');
    assert.match(
        result.stderr,
        /PRIVACY\.md must include runtime-scoped collection statement/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const privacyPath = path.join(fixtureRoot, 'PRIVACY.md');
    fs.writeFileSync(
        privacyPath,
        fs.readFileSync(privacyPath, 'utf8').replace(
            'Ghostify transiently inspects request URLs, request payloads, and supported page or worker messages inside your browser',
            'Ghostify works inside your browser'
        )
    );

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject missing local inspection disclosure');
    assert.match(
        result.stderr,
        /PRIVACY\.md must include local transient inspection disclosure/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const privacyPath = path.join(fixtureRoot, 'PRIVACY.md');
    fs.writeFileSync(
        privacyPath,
        fs.readFileSync(privacyPath, 'utf8').replace(
            'Ghostify limits Messenger-specific runtime behavior to supported Messenger proxy pages',
            'Ghostify uses this host permission for Messenger support'
        )
    );

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject missing fbsbx runtime-narrowing disclosure');
    assert.match(
        result.stderr,
        /PRIVACY\.md must include fbsbx proxy narrowing disclosure/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const privacyPath = path.join(fixtureRoot, 'PRIVACY.md');
    fs.writeFileSync(
        privacyPath,
        fs.readFileSync(privacyPath, 'utf8').replace(
            'Chrome Web Store User Data Policy',
            'Chrome extension policy'
        )
    );

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject missing Chrome Web Store Limited Use disclosure');
    assert.match(
        result.stderr,
        /PRIVACY\.md must include Chrome Web Store Limited Use disclosure/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const privacyPath = path.join(fixtureRoot, 'PRIVACY.md');
    fs.writeFileSync(
        privacyPath,
        fs.readFileSync(privacyPath, 'utf8').replace(
            'GitHub issue forms or Tally forms',
            'feedback links'
        )
    );

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject missing voluntary feedback disclosure');
    assert.match(
        result.stderr,
        /PRIVACY\.md must include voluntary feedback disclosure/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const popupPath = path.join(fixtureRoot, 'dist', 'popup.html');
    fs.writeFileSync(
        popupPath,
        fs.readFileSync(popupPath, 'utf8').replace(`version=${pkg.version}`, 'version=0.0.0')
    );

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject stale popup survey versions');
    assert.match(
        result.stderr,
        new RegExp(`Tally survey link version 0\\.0\\.0 does not match package\\.json ${pkg.version.replace(/\./g, '\\.')}`),
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const popupPath = path.join(fixtureRoot, 'dist', 'popup.html');
    fs.writeFileSync(
        popupPath,
        fs.readFileSync(popupPath, 'utf8').replace('https://facebook.com/', 'https://example.com/')
    );

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject missing popup Facebook link');
    assert.match(
        result.stderr,
        new RegExp('dist/popup.html must link Facebook to https://facebook.com/'),
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const changelogPath = path.join(fixtureRoot, 'CHANGELOG.md');
    fs.writeFileSync(
        changelogPath,
        fs.readFileSync(changelogPath, 'utf8').replace(`## [${pkg.version}]`, '## [0.0.0]')
    );

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject missing package-version changelog heading');
    assert.match(
        result.stderr,
        new RegExp(`CHANGELOG\\.md must include a release heading for ${pkg.version.replace(/\./g, '\\.')}`),
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { statusPath, statusJson } = readStatusJson(fixtureRoot);
    statusJson.productVersion = '0.0.0';
    writeStatusJsonPair(fixtureRoot, statusJson);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject stale public status version');
    assert.match(
        result.stderr,
        new RegExp(`site/public/status\\.json productVersion must be "${pkg.version.replace(/\./g, '\\.')}"`),
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const statusSourcePath = path.join(fixtureRoot, 'site', 'src', 'app', 'statusData.json');
    const statusSourceJson = JSON.parse(fs.readFileSync(statusSourcePath, 'utf8'));
    statusSourceJson.summary.label = 'Drifted';
    fs.writeFileSync(statusSourcePath, `${JSON.stringify(statusSourceJson, null, 2)}\n`);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject drift between site status source and public JSON');
    assert.match(
        result.stderr,
        /site\/src\/app\/statusData\.json must match site\/public\/status\.json/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { statusPath, statusJson } = readStatusJson(fixtureRoot);
    delete statusJson.provenWorking;
    writeStatusJsonPair(fixtureRoot, statusJson);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject missing proven-working timeline');
    assert.match(
        result.stderr,
        /site\/public\/status\.json provenWorking must be an object/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { statusPath, statusJson } = readStatusJson(fixtureRoot);
    statusJson.provenWorking.currentWindowStartedAt = '2026-06-28';
    writeStatusJsonPair(fixtureRoot, statusJson);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject future current working windows');
    assert.match(
        result.stderr,
        /site\/public\/status\.json provenWorking currentWindowStartedAt must not be after lastVerifiedAt/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { statusPath, statusJson } = readStatusJson(fixtureRoot);
    statusJson.history = statusJson.history.filter(
        item => item.date !== statusJson.provenWorking.previousWindowStartedAt
    );
    writeStatusJsonPair(fixtureRoot, statusJson);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject status history missing the proven working timeline');
    assert.match(
        result.stderr,
        /site\/public\/status\.json history must include provenWorking\.previousWindowStartedAt/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { statusPath, statusJson } = readStatusJson(fixtureRoot);
    statusJson.automationPolicy.canMarkVerified = true;
    writeStatusJsonPair(fixtureRoot, statusJson);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject auto-green public status policy');
    assert.match(
        result.stderr,
        /site\/public\/status\.json automationPolicy\.canMarkVerified must be false/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { statusPath, statusJson } = readStatusJson(fixtureRoot);
    statusJson.communityVerification.privateMessagesAllowed = true;
    writeStatusJsonPair(fixtureRoot, statusJson);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject private messages in verification proof');
    assert.match(
        result.stderr,
        /site\/public\/status\.json communityVerification\.privateMessagesAllowed must be false/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { statusPath, statusJson } = readStatusJson(fixtureRoot);
    statusJson.entries[0].publicStatus = 'maintainer_verified';
    statusJson.entries[0].verifiedAt = '2026-06-20T00:00:00Z';
    statusJson.entries[0].expiresAt = null;
    writeStatusJsonPair(fixtureRoot, statusJson);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject verified public status without expiry');
    assert.match(
        result.stderr,
        /site\/public\/status\.json entries\[0\]\.expiresAt is required for verified public status/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { statusPath, statusJson } = readStatusJson(fixtureRoot);
    statusJson.entries[0].publicStatus = 'maintainer_verified';
    statusJson.entries[0].verifiedAt = '2026-06-20T00:00:00Z';
    statusJson.entries[0].expiresAt = '2026-07-04T00:00:00Z';
    statusJson.entries[0].localEvidenceStatus = 'manual_pending';
    writeStatusJsonPair(fixtureRoot, statusJson);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject verified public status with manual-pending local evidence');
    assert.match(
        result.stderr,
        /site\/public\/status\.json entries\[0\]\.localEvidenceStatus must be verified for verified public status/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { statusPath, statusJson } = readStatusJson(fixtureRoot);
    statusJson.entries[0].publicStatus = 'community_verified_reviewed';
    statusJson.entries[0].verifiedAt = '2026-06-20T00:00:00Z';
    statusJson.entries[0].expiresAt = '2026-07-04T00:00:00Z';
    statusJson.entries[0].localEvidenceStatus = 'verified';
    statusJson.entries[0].sourceType = 'maintainer';
    writeStatusJsonPair(fixtureRoot, statusJson);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject community verified status without reviewed community source');
    assert.match(
        result.stderr,
        /site\/public\/status\.json entries\[0\]\.sourceType must be reviewed_community for community_verified_reviewed/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { statusPath, statusJson } = readStatusJson(fixtureRoot);
    statusJson.entries[0].relatedIssueUrl = 'javascript:alert(1)';
    writeStatusJsonPair(fixtureRoot, statusJson);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject non-HTTPS public status issue URLs');
    assert.match(
        result.stderr,
        /site\/public\/status\.json entries\[0\]\.relatedIssueUrl must be an HTTPS URL/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { statusPath, statusJson } = readStatusJson(fixtureRoot);
    statusJson.entries.push({ ...statusJson.entries[0], id: 'duplicate-instagram-hide-seen' });
    writeStatusJsonPair(fixtureRoot, statusJson);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject duplicate platform/feature public status rows');
    assert.match(
        result.stderr,
        /site\/public\/status\.json has duplicate public verification entry for Instagram:Hide Seen/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { statusPath, statusJson } = readStatusJson(fixtureRoot);
    statusJson.rawSubmissions = [];
    writeStatusJsonPair(fixtureRoot, statusJson);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject unexpected raw public status fields');
    assert.match(
        result.stderr,
        /Unexpected site\/public\/status\.json field: rawSubmissions/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { statusPath, statusJson } = readStatusJson(fixtureRoot);
    statusJson.entries = statusJson.entries.filter(entry => !(entry.platform === 'Facebook' && entry.feature === 'Hide Seen'));
    writeStatusJsonPair(fixtureRoot, statusJson);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject missing platform/feature public status rows');
    assert.match(
        result.stderr,
        /site\/public\/status\.json is missing public verification entry for Facebook:Hide Seen/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { manifestPath, manifest } = readManifest(fixtureRoot);
    manifest.optional_permissions = ['tabs'];
    writeManifest(manifestPath, manifest);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject optional permissions');
    assert.match(
        result.stderr,
        /dist\/manifest\.json optional_permissions must not be declared/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { manifestPath, manifest } = readManifest(fixtureRoot);
    manifest.optional_host_permissions = ['https://example.com/*'];
    writeManifest(manifestPath, manifest);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject optional host permissions');
    assert.match(
        result.stderr,
        /dist\/manifest\.json optional_host_permissions must not be declared/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { manifestPath, manifest } = readManifest(fixtureRoot);
    manifest.content_scripts[0].matches.push('https://example.com/*');
    writeManifest(manifestPath, manifest);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject unexpected content-script matches');
    assert.match(
        result.stderr,
        /Unexpected content_scripts entry for js\/content\.js matches: https:\/\/example\.com\/\*/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { manifestPath, manifest } = readManifest(fixtureRoot);
    manifest.content_scripts[0].exclude_matches = ['https://*.facebook.com/*'];
    writeManifest(manifestPath, manifest);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject unexpected content-script fields');
    assert.match(
        result.stderr,
        /Unexpected content_scripts entry for js\/content\.js field: exclude_matches/,
        result.stderr || result.stdout
    );
});

withFixture(fixtureRoot => {
    const { manifestPath, manifest } = readManifest(fixtureRoot);
    manifest.web_accessible_resources[0].matches.push('https://example.com/*');
    writeManifest(manifestPath, manifest);

    const result = runValidator(fixtureRoot);
    assert.notStrictEqual(result.status, 0, 'validator should reject unexpected web-accessible resource matches');
    assert.match(
        result.stderr,
        /Unexpected web_accessible_resources\[0\]\.matches: https:\/\/example\.com\/\*/,
        result.stderr || result.stdout
    );
});

console.log('validate-extension-package permission drift tests passed');
