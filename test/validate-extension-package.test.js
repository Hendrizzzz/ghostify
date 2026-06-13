const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function copyFixture() {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ghostify-validate-'));
    fs.mkdirSync(path.join(fixtureRoot, 'scripts'), { recursive: true });

    for (const file of ['package.json', 'package-lock.json']) {
        fs.copyFileSync(path.join(repoRoot, file), path.join(fixtureRoot, file));
    }

    fs.cpSync(path.join(repoRoot, 'dist'), path.join(fixtureRoot, 'dist'), { recursive: true });
    fs.cpSync(path.join(repoRoot, 'src'), path.join(fixtureRoot, 'src'), { recursive: true });
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
