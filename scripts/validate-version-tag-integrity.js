const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const PACKAGE_IDENTITY_PATHS = [
    'browser-targets/firefox',
    'dist',
    'scripts/lib/deterministic-zip.js',
    'scripts/package-extension.js',
    'scripts/package-firefox.js',
    'scripts/prepare-firefox-extension.js'
];

function git(repoRoot, args) {
    return childProcess.spawnSync('git', args, {
        cwd: repoRoot,
        encoding: 'utf8'
    });
}

function failFromGit(result, fallback) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(detail || fallback);
}

function validateVersionTagIntegrity(repoRoot = process.cwd()) {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    if (!pkg.version || !/^\d+\.\d+\.\d+$/.test(pkg.version)) {
        throw new Error('package.json version must use X.Y.Z format.');
    }

    const tag = `v${pkg.version}`;
    const tagLookup = git(repoRoot, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`]);
    if (tagLookup.status === 1) return { status: 'untagged', tag, changedPaths: [] };
    if (tagLookup.status !== 0) failFromGit(tagLookup, `Could not inspect ${tag}.`);

    const comparison = git(repoRoot, ['diff', '--quiet', tag, '--', ...PACKAGE_IDENTITY_PATHS]);
    if (comparison.status === 0) return { status: 'matched', tag, changedPaths: [] };
    if (comparison.status !== 1) failFromGit(comparison, `Could not compare package inputs with ${tag}.`);

    const changed = git(repoRoot, ['diff', '--name-only', tag, '--', ...PACKAGE_IDENTITY_PATHS]);
    if (changed.status !== 0) failFromGit(changed, `Could not list package input changes since ${tag}.`);
    const changedPaths = changed.stdout.trim().split(/\r?\n/).filter(Boolean);
    throw new Error(
        `${tag} already identifies different packaged extension inputs. ` +
        `Advance package.json to the next unused version before changing: ${changedPaths.join(', ')}`
    );
}

function main() {
    const result = validateVersionTagIntegrity();
    if (result.status === 'untagged') {
        console.log(`${result.tag} is not tagged; package identity is available for the current development version`);
    } else {
        console.log(`packaged extension inputs still match ${result.tag}`);
    }
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

module.exports = { PACKAGE_IDENTITY_PATHS, validateVersionTagIntegrity };
