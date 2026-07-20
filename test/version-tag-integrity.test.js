const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { validateVersionTagIntegrity } = require('../scripts/validate-version-tag-integrity');

function git(cwd, args) {
    const result = childProcess.spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
}

function write(root, relativePath, contents) {
    const destination = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, contents);
}

function createTaggedFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ghostify-version-tag-'));
    git(root, ['init']);
    git(root, ['config', 'user.name', 'Ghostify test']);
    git(root, ['config', 'user.email', 'ghostify-test@example.invalid']);
    write(root, 'package.json', '{"version":"1.2.3"}\n');
    write(root, 'browser-targets/firefox/manifest.overlay.json', '{"name":"fixture"}\n');
    write(root, 'dist/manifest.json', '{"version":"1.2.3"}\n');
    write(root, 'scripts/package-extension.js', 'module.exports = {};\n');
    write(root, 'README.md', '# Fixture\n');
    git(root, ['add', '--', '.']);
    git(root, ['commit', '-m', 'fixture release']);
    git(root, ['tag', 'v1.2.3']);
    return root;
}

const fixtureRoots = [];
try {
    const unchanged = createTaggedFixture();
    fixtureRoots.push(unchanged);
    assert.deepStrictEqual(validateVersionTagIntegrity(unchanged), {
        status: 'matched',
        tag: 'v1.2.3',
        changedPaths: []
    });

    write(unchanged, 'README.md', '# Documentation-only change\n');
    git(unchanged, ['add', '--', 'README.md']);
    git(unchanged, ['commit', '-m', 'docs update']);
    assert.strictEqual(validateVersionTagIntegrity(unchanged).status, 'matched');

    const changedPackage = createTaggedFixture();
    fixtureRoots.push(changedPackage);
    write(changedPackage, 'dist/manifest.json', '{"version":"1.2.3","description":"changed"}\n');
    git(changedPackage, ['add', '--', 'dist/manifest.json']);
    git(changedPackage, ['commit', '-m', 'change packaged input']);
    assert.throws(
        () => validateVersionTagIntegrity(changedPackage),
        /v1\.2\.3 already identifies different packaged extension inputs.*dist\/manifest\.json/
    );

    const changedFirefoxOverlay = createTaggedFixture();
    fixtureRoots.push(changedFirefoxOverlay);
    write(
        changedFirefoxOverlay,
        'browser-targets/firefox/manifest.overlay.json',
        '{"name":"changed fixture"}\n'
    );
    git(changedFirefoxOverlay, ['add', '--', 'browser-targets/firefox/manifest.overlay.json']);
    git(changedFirefoxOverlay, ['commit', '-m', 'change Firefox package overlay']);
    assert.throws(
        () => validateVersionTagIntegrity(changedFirefoxOverlay),
        /v1\.2\.3 already identifies different packaged extension inputs.*browser-targets\/firefox\/manifest\.overlay\.json/
    );

    write(changedPackage, 'package.json', '{"version":"1.2.4"}\n');
    git(changedPackage, ['add', '--', 'package.json']);
    git(changedPackage, ['commit', '-m', 'advance version']);
    assert.strictEqual(validateVersionTagIntegrity(changedPackage).status, 'untagged');
} finally {
    for (const root of fixtureRoots) fs.rmSync(root, { recursive: true, force: true });
}

console.log('version-tag package identity tests passed');
