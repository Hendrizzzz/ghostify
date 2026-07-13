const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const { QA_IDS, isGreenProposalEligible, parseArgs, prepareStatusUpdate } = require('../scripts/prepare-status-update');

const repoRoot = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(repoRoot, 'site', 'src', 'app', 'statusData.json'), 'utf8'));

function matchingReleaseStatus() {
    const status = structuredClone(source);
    status.release.publishedVersion = status.productVersion;
    status.release.matchesVerificationBuild = true;
    return status;
}

function testVerifiedProposalUpdatesEverySupportedControlWithoutExpiry() {
    const status = prepareStatusUpdate(matchingReleaseStatus(), {
        mode: 'verified',
        date: '2026-07-12',
        generatedAt: '2026-07-12T10:15:00Z'
    });

    assert.strictEqual(status.summary.publicStatus, 'maintainer_verified');
    assert.strictEqual(status.history[0].date, '2026-07-12');
    assert.strictEqual(status.history[0].publicStatus, 'maintainer_verified');
    assert.strictEqual(status.entries.length, Object.keys(QA_IDS).length);

    for (const entry of status.entries) {
        assert.strictEqual(entry.publicStatus, 'maintainer_verified');
        assert.strictEqual(entry.localEvidenceStatus, 'verified');
        assert.strictEqual(entry.verifiedAt, '2026-07-12T00:00:00Z');
        assert(!Object.hasOwn(entry, 'expiresAt'));
        assert(entry.reviewRecord.includes(QA_IDS[entry.id]));
    }
}

function testVerifiedProposalRejectsStoreBuildMismatch() {
    assert.throws(
        () => prepareStatusUpdate(source, {
            mode: 'verified',
            date: '2026-07-12',
            generatedAt: '2026-07-12T10:15:00Z'
        }),
        error => error.message.includes(
            `Store v${source.release.publishedVersion} does not match build v${source.productVersion}`
        )
    );
}

function testReportedProposalTurnsSelectedControlAndOverallStatusYellow() {
    const status = prepareStatusUpdate(source, {
        mode: 'reported',
        date: '2026-07-12',
        generatedAt: '2026-07-12T10:15:00Z',
        featureIds: ['messenger-hide-typing'],
        note: 'Users report that Messenger Hide Typing may not be working.'
    });

    const affected = status.entries.find(entry => entry.id === 'messenger-hide-typing');
    const unaffected = status.entries.find(entry => entry.id === 'instagram-hide-seen');
    assert.strictEqual(status.summary.publicStatus, 'under_review');
    assert.strictEqual(status.history[0].publicStatus, 'under_review');
    assert.strictEqual(affected.publicStatus, 'under_review');
    assert.strictEqual(affected.localEvidenceStatus, 'manual_pending');
    assert.strictEqual(unaffected.publicStatus, source.entries.find(entry => entry.id === unaffected.id).publicStatus);
}

function testInProgressProposalStaysYellowAndPreservesHistory() {
    const reported = prepareStatusUpdate(source, {
        mode: 'reported',
        date: '2026-07-12',
        generatedAt: '2026-07-12T10:15:00Z',
        featureIds: ['messenger-hide-typing']
    });
    const working = prepareStatusUpdate(reported, {
        mode: 'in-progress',
        date: '2026-07-12',
        generatedAt: '2026-07-12T11:00:00Z',
        featureIds: ['messenger-hide-typing'],
        note: 'A fix for Messenger Hide Typing is in progress.'
    });

    assert.strictEqual(working.summary.publicStatus, 'work_in_progress');
    assert.strictEqual(working.history[0].publicStatus, 'work_in_progress');
    assert.strictEqual(working.history[1].publicStatus, 'under_review');
    assert.strictEqual(working.history.length, source.history.length + 2);
}

function testKnownIssueProposalUpdatesOnlySelectedControls() {
    const status = prepareStatusUpdate(source, {
        mode: 'known-issue',
        date: '2026-07-12',
        generatedAt: '2026-07-12T10:15:00Z',
        featureIds: ['facebook-hide-seen'],
        issueUrl: 'https://github.com/Hendrizzzz/Ghostify/issues/123',
        note: 'Facebook Hide Seen has a confirmed issue.'
    });

    const affected = status.entries.find(entry => entry.id === 'facebook-hide-seen');
    assert.strictEqual(status.summary.publicStatus, 'known_issue');
    assert.strictEqual(affected.publicStatus, 'known_issue');
    assert.strictEqual(affected.relatedIssueUrl, 'https://github.com/Hendrizzzz/Ghostify/issues/123');
}

function testYellowProposalRejectsUnknownControl() {
    assert.throws(
        () => prepareStatusUpdate(source, {
            mode: 'reported',
            date: '2026-07-12',
            generatedAt: '2026-07-12T10:15:00Z',
            featureIds: ['unknown-feature']
        }),
        /Unknown feature id/
    );
}

function testStatusInputsRejectImpossibleDatesAndDuplicateFeatures() {
    assert.throws(() => parseArgs(['--mdoe', 'reported']), /Unknown option/);
    const missingMode = childProcess.spawnSync(process.execPath, ['scripts/prepare-status-update.js', '--date', '2026-07-12'], {
        cwd: repoRoot,
        encoding: 'utf8'
    });
    assert.notStrictEqual(missingMode.status, 0);
    assert.match(missingMode.stderr, /--mode is required/);
    assert.throws(() => prepareStatusUpdate(source, {
        mode: 'reported',
        date: '2026-02-31',
        generatedAt: '2026-03-03T00:00:00Z',
        featureIds: ['messenger-hide-typing']
    }), /Invalid UTC date/);
    assert.throws(() => prepareStatusUpdate(source, {
        mode: 'reported',
        date: '2026-07-12',
        generatedAt: '2026-07-12T10:15:00Z',
        featureIds: ['messenger-hide-typing', 'messenger-hide-typing']
    }), /must not contain duplicates/);
}

function testGreenEligibilityRequiresMatchingBuildAndProtectsYellowSchedule() {
    assert.deepStrictEqual(isGreenProposalEligible(source, { scheduled: true }), {
        latestStatusIsGreen: false,
        storeBuildMatches: false,
        ready: false
    });
    const matchingGreen = matchingReleaseStatus();
    matchingGreen.summary.publicStatus = 'maintainer_verified';
    assert.strictEqual(isGreenProposalEligible(matchingGreen, { scheduled: true }).ready, true);
    matchingGreen.summary.publicStatus = 'under_review';
    assert.strictEqual(isGreenProposalEligible(matchingGreen, { scheduled: true }).ready, false);
    assert.strictEqual(isGreenProposalEligible(matchingGreen, { scheduled: false }).ready, true);
}

function testDailyWorkflowIsSingleRefreshableMaintainerApprovalPr() {
    const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'daily-verification.yml'), 'utf8');
    assert(workflow.includes('schedule:'));
    assert(workflow.includes('workflow_dispatch:'));
    assert(workflow.includes('pull-requests: write'));
    assert(workflow.includes('chore/status-daily-verification'));
    assert(workflow.includes('latestStatusIsGreen'));
    assert(workflow.includes('storeBuildMatches'));
    assert(workflow.includes('base_sha'));
    assert(workflow.includes('main changed while this proposal was being validated'));
    assert(workflow.includes('git push --force-with-lease'));
    assert(workflow.includes('Merge only after manually verifying the supported controls.'));
    assert(!workflow.includes('gh pr merge'));
    assert(!workflow.includes('enable-auto-merge'));
    assert(!workflow.includes('site/public/status.json'));
}

testVerifiedProposalUpdatesEverySupportedControlWithoutExpiry();
testVerifiedProposalRejectsStoreBuildMismatch();
testReportedProposalTurnsSelectedControlAndOverallStatusYellow();
testInProgressProposalStaysYellowAndPreservesHistory();
testKnownIssueProposalUpdatesOnlySelectedControls();
testYellowProposalRejectsUnknownControl();
testStatusInputsRejectImpossibleDatesAndDuplicateFeatures();
testGreenEligibilityRequiresMatchingBuildAndProtectsYellowSchedule();
testDailyWorkflowIsSingleRefreshableMaintainerApprovalPr();

console.log('Status proposal tests passed.');
