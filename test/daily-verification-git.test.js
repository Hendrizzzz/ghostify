const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const workflow = fs.readFileSync('.github/workflows/daily-verification.yml', 'utf8').replace(/\r\n/g, '\n');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const sitePackageJson = JSON.parse(fs.readFileSync('site/package.json', 'utf8'));
const validateJobStart = workflow.indexOf('  validate-proposal:');
const publishJobStart = workflow.indexOf('  publish-proposal:');
assert(validateJobStart >= 0 && publishJobStart > validateJobStart, 'daily workflow must separate validation and publishing jobs');
const validateJob = workflow.slice(validateJobStart, publishJobStart);
const publishJob = workflow.slice(publishJobStart);

assert(
    workflow.includes('I tested the extension installed from the Chrome Web Store, not an unpacked development build.'),
    'daily verification PRs must identify the tested Store-installed artifact'
);
assert(
    validateJob.includes('permissions:\n      contents: read') &&
        validateJob.includes('run: npm run ci:verification') &&
        !validateJob.includes('contents: write') &&
        !validateJob.includes('pull-requests: write'),
    'dependency execution and validation must use read-only repository permissions'
);
assert(
    validateJob.includes('id: extension-dependency-review') &&
        validateJob.includes('id: site-dependency-review') &&
        validateJob.includes('continue-on-error: true') &&
        validateJob.includes('A complete dependency audit did not pass.'),
    'complete dependency audit failures must stay visible while required CI remains the merge gate'
);
assert(
    packageJson.scripts['audit:runtime'].includes('--omit=dev') &&
        packageJson.scripts['ci:verification'].includes('audit:runtime'),
    'daily verification CI must keep extension runtime advisories blocking'
);
assert(
    sitePackageJson.scripts['audit:runtime'].includes('--omit=dev') &&
        validateJob.includes('working-directory: site') &&
        validateJob.includes('run: npm run audit:runtime'),
    'daily verification must keep website runtime advisories blocking'
);
assert(
    packageJson.scripts.ci.includes('audit:high'),
    'normal CI must keep the complete dependency audit blocking'
);
assert(
    publishJob.includes('actions: write') &&
        publishJob.includes('contents: write') &&
        publishJob.includes('pull-requests: write') &&
        !publishJob.includes('run: npm ci'),
    'the write-enabled publishing job must not install package dependencies'
);
assert(
        publishJob.includes('echo "head_sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"') &&
        publishJob.includes('gh workflow run ci.yml --ref "$BRANCH"') &&
        publishJob.includes('select(.headSha == \\"$HEAD_SHA\\")'),
    'bot-created proposals must dispatch required CI and verify the exact proposal commit'
);
assert.deepStrictEqual(
    packageJson.overrides['fx-runner@1.5.0'],
    { 'shell-quote': '1.9.0' },
    'the shell-quote remediation must stay scoped to the affected fx-runner path'
);

function git(cwd, args, options = {}) {
    return childProcess.spawnSync('git', args, {
        cwd,
        encoding: 'utf8',
        ...options
    });
}

function mustGit(cwd, args) {
    const result = git(cwd, args);
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    return result.stdout.trim();
}

function configure(cwd) {
    mustGit(cwd, ['config', 'user.name', 'Ghostify test']);
    mustGit(cwd, ['config', 'user.email', 'ghostify-test@example.invalid']);
}

function commitProposal(cwd, value) {
    fs.writeFileSync(path.join(cwd, 'status.json'), `${value}\n`);
    mustGit(cwd, ['add', 'status.json']);
    mustGit(cwd, ['commit', '-m', `chore(status): ${value}`]);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ghostify-daily-pr-'));
try {
    const remote = path.join(root, 'remote.git');
    const seed = path.join(root, 'seed');
    const first = path.join(root, 'first');
    const stale = path.join(root, 'stale');
    const refresh = path.join(root, 'refresh');
    mustGit(root, ['init', '--bare', remote]);
    mustGit(root, ['init', seed]);
    configure(seed);
    commitProposal(seed, 'main');
    mustGit(seed, ['branch', '-M', 'main']);
    mustGit(seed, ['remote', 'add', 'origin', remote]);
    mustGit(seed, ['push', '-u', 'origin', 'main']);
    mustGit(remote, ['symbolic-ref', 'HEAD', 'refs/heads/main']);

    mustGit(root, ['clone', remote, first]);
    configure(first);
    mustGit(first, ['switch', '-c', 'chore/status-daily-verification', 'origin/main']);
    commitProposal(first, 'day-one');
    mustGit(first, ['push', '--force-with-lease', '--set-upstream', 'origin', 'chore/status-daily-verification']);

    mustGit(root, ['clone', remote, stale]);
    configure(stale);
    mustGit(root, ['clone', remote, refresh]);
    configure(refresh);
    mustGit(refresh, ['fetch', 'origin', 'chore/status-daily-verification:refs/remotes/origin/chore/status-daily-verification']);
    mustGit(refresh, ['switch', '-C', 'chore/status-daily-verification', 'origin/main']);
    commitProposal(refresh, 'day-two');
    mustGit(refresh, ['push', '--force-with-lease', '--set-upstream', 'origin', 'chore/status-daily-verification']);

    mustGit(stale, ['switch', '-C', 'chore/status-daily-verification', 'origin/main']);
    commitProposal(stale, 'stale-day');
    const rejected = git(stale, ['push', '--force-with-lease', '--set-upstream', 'origin', 'chore/status-daily-verification']);
    assert.notStrictEqual(rejected.status, 0, 'force-with-lease must reject a stale daily branch refresh');

    const branchCount = mustGit(remote, ['for-each-ref', '--format=%(refname)', 'refs/heads/chore/status-daily-verification'])
        .split(/\r?\n/)
        .filter(Boolean).length;
    assert.strictEqual(branchCount, 1, 'daily refreshes must reuse one proposal branch');
} finally {
    fs.rmSync(root, { recursive: true, force: true });
}

console.log('Daily verification git refresh tests passed.');
