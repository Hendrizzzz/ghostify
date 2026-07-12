const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

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
