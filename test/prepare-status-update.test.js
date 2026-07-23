const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const { QA_IDS, getVerificationProposalState, parseArgs, prepareStatusUpdate } = require('../scripts/prepare-status-update');

const repoRoot = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(repoRoot, 'site', 'src', 'app', 'statusData.json'), 'utf8'));

function proposalContextForStatus(status) {
    const date = status.history[0].date;
    const baseline = [status.generatedAt, status.release.checkedAt, `${date}T00:00:00Z`]
        .map(value => Date.parse(value))
        .filter(Number.isFinite);
    const generatedAt = new Date(Math.max(...baseline) + 60 * 60 * 1000)
        .toISOString()
        .replace('.000Z', 'Z');
    return { date, generatedAt };
}

const { date: proposalDate, generatedAt: proposalGeneratedAt } = proposalContextForStatus(source);

function matchingReleaseStatus() {
    const status = structuredClone(source);
    status.release.verificationVersion = status.release.publishedVersion;
    status.release.matchesVerificationBuild = true;
    return status;
}

function testVerifiedProposalUpdatesEverySupportedControlWithoutExpiry() {
    const status = prepareStatusUpdate(matchingReleaseStatus(), {
        mode: 'verified',
        date: proposalDate,
        generatedAt: proposalGeneratedAt
    });

    assert.strictEqual(status.summary.publicStatus, 'maintainer_verified');
    assert.strictEqual(status.history[0].date, proposalDate);
    assert.strictEqual(status.history[0].publicStatus, 'maintainer_verified');
    assert.strictEqual(status.entries.length, Object.keys(QA_IDS).length);

    for (const entry of status.entries) {
        assert.strictEqual(entry.publicStatus, 'maintainer_verified');
        assert.strictEqual(entry.localEvidenceStatus, 'verified');
        assert.strictEqual(entry.verifiedAt, `${proposalDate}T00:00:00Z`);
        assert(!Object.hasOwn(entry, 'expiresAt'));
        assert(entry.reviewRecord.includes(QA_IDS[entry.id]));
    }
}

function testProposalFixtureFollowsStatusPreparedByWorkflow() {
    const preparedDate = new Date(Date.parse(`${source.history[0].date}T00:00:00Z`) + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
    const workflowStatus = matchingReleaseStatus();
    workflowStatus.generatedAt = `${preparedDate}T01:00:00Z`;
    workflowStatus.history.unshift({
        ...workflowStatus.history[0],
        date: preparedDate
    });

    const context = proposalContextForStatus(workflowStatus);
    assert.strictEqual(context.date, preparedDate);
    assert(Date.parse(context.generatedAt) > Date.parse(workflowStatus.generatedAt));
    assert.doesNotThrow(() => prepareStatusUpdate(workflowStatus, {
        mode: 'verified',
        date: context.date,
        generatedAt: context.generatedAt
    }));
}

function testVerifiedProposalTargetsRecordedStoreBuildAcrossVersionMismatch() {
    const mismatchingStatus = structuredClone(source);
    mismatchingStatus.productVersion = '2.0.7';
    mismatchingStatus.release.publishedVersion = '2.0.6';
    mismatchingStatus.release.verificationVersion = '2.0.5';
    mismatchingStatus.release.matchesVerificationBuild = false;
    mismatchingStatus.summary.publicStatus = 'under_review';
    mismatchingStatus.entries[0].publicStatus = 'known_issue';
    mismatchingStatus.entries[0].localEvidenceStatus = 'manual_pending';
    mismatchingStatus.entries[0].relatedIssueUrl = 'https://github.com/Hendrizzzz/Ghostify/issues/123';
    mismatchingStatus.history.unshift({
        date: proposalDate,
        publicStatus: 'under_review',
        eventType: 'review',
        title: 'Existing review state',
        summary: 'Existing history must survive a later verified proposal.'
    });

    const status = prepareStatusUpdate(mismatchingStatus, {
        mode: 'verified',
        date: proposalDate,
        generatedAt: proposalGeneratedAt
    });

    assert.strictEqual(status.release.publishedVersion, '2.0.6');
    assert.strictEqual(status.release.verificationVersion, '2.0.6');
    assert.strictEqual(status.release.matchesVerificationBuild, true);
    assert.strictEqual(status.summary.publicStatus, 'maintainer_verified');
    assert(status.entries.every(entry => entry.reviewRecord.includes('for v2.0.6')));
    assert(status.entries.every(entry => entry.relatedIssueUrl === null));
    assert(status.history.some(item => item.title === 'Existing review state'));
}

function testReportedProposalTurnsSelectedControlAndOverallStatusYellow() {
    const status = prepareStatusUpdate(source, {
        mode: 'reported',
        date: proposalDate,
        generatedAt: proposalGeneratedAt,
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
        date: proposalDate,
        generatedAt: proposalGeneratedAt,
        featureIds: ['messenger-hide-typing']
    });
    const working = prepareStatusUpdate(reported, {
        mode: 'in-progress',
        date: proposalDate,
        generatedAt: new Date(Date.parse(proposalGeneratedAt) + 60 * 60 * 1000)
            .toISOString()
            .replace('.000Z', 'Z'),
        featureIds: ['messenger-hide-typing'],
        note: 'A fix for Messenger Hide Typing is in progress.'
    });

    assert.strictEqual(working.summary.publicStatus, 'work_in_progress');
    assert.strictEqual(working.history[0].publicStatus, 'work_in_progress');
    assert.strictEqual(working.history[1].publicStatus, 'under_review');
    assert.strictEqual(working.history.length, source.history.length + 2);
}

function testMultipleSameDayStatusUpdatesPreserveNewestFirstOrder() {
    const reported = prepareStatusUpdate(source, {
        mode: 'reported',
        date: proposalDate,
        generatedAt: proposalGeneratedAt,
        featureIds: ['messenger-hide-typing']
    });
    const working = prepareStatusUpdate(reported, {
        mode: 'in-progress',
        date: proposalDate,
        generatedAt: new Date(Date.parse(proposalGeneratedAt) + 60 * 60 * 1000)
            .toISOString()
            .replace('.000Z', 'Z'),
        featureIds: ['messenger-hide-typing']
    });
    const confirmed = prepareStatusUpdate(working, {
        mode: 'known-issue',
        date: proposalDate,
        generatedAt: new Date(Date.parse(proposalGeneratedAt) + 2 * 60 * 60 * 1000)
            .toISOString()
            .replace('.000Z', 'Z'),
        featureIds: ['messenger-hide-typing']
    });

    assert.deepStrictEqual(
        confirmed.history.slice(0, 3).map(item => [item.date, item.publicStatus]),
        [
            [proposalDate, 'known_issue'],
            [proposalDate, 'work_in_progress'],
            [proposalDate, 'under_review']
        ]
    );
    assert.strictEqual(confirmed.history.length, source.history.length + 3);
}

function testIdenticalVerificationUpdateDoesNotDuplicateHistory() {
    const freshDate = new Date(Date.parse(`${proposalDate}T00:00:00Z`) + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
    const firstGeneratedAt = `${freshDate}T01:00:00Z`;
    const first = prepareStatusUpdate(matchingReleaseStatus(), {
        mode: 'verified',
        date: freshDate,
        generatedAt: firstGeneratedAt
    });
    const secondGeneratedAt = new Date(Date.parse(firstGeneratedAt) + 60 * 60 * 1000)
        .toISOString()
        .replace('.000Z', 'Z');
    const second = prepareStatusUpdate(first, {
        mode: 'verified',
        date: freshDate,
        generatedAt: secondGeneratedAt
    });

    assert.strictEqual(first.history.length, source.history.length + 1);
    assert.strictEqual(second.history.length, first.history.length);
    assert.deepStrictEqual(second.history[0], first.history[0]);
}

function testKnownIssueProposalUpdatesOnlySelectedControls() {
    const status = prepareStatusUpdate(source, {
        mode: 'known-issue',
        date: proposalDate,
        generatedAt: proposalGeneratedAt,
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
            date: proposalDate,
            generatedAt: proposalGeneratedAt,
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
        date: proposalDate,
        generatedAt: proposalGeneratedAt,
        featureIds: ['messenger-hide-typing', 'messenger-hide-typing']
    }), /must not contain duplicates/);
}

function testVerificationProposalStateAllowsUpdatesAndYellowRecovery() {
    const mismatchingYellow = structuredClone(source);
    mismatchingYellow.summary.publicStatus = 'under_review';
    mismatchingYellow.release.publishedVersion = '2.0.6';
    mismatchingYellow.release.verificationVersion = '2.0.5';
    mismatchingYellow.release.matchesVerificationBuild = false;
    assert.deepStrictEqual(getVerificationProposalState(mismatchingYellow, { date: proposalDate }), {
        targetVersion: '2.0.6',
        alreadyVerifiedToday: false,
        ready: true
    });

    const verifiedToday = prepareStatusUpdate(mismatchingYellow, {
        mode: 'verified',
        date: proposalDate,
        generatedAt: proposalGeneratedAt
    });
    assert.deepStrictEqual(getVerificationProposalState(verifiedToday, { date: proposalDate }), {
        targetVersion: '2.0.6',
        alreadyVerifiedToday: true,
        ready: false
    });

    const nextDate = new Date(Date.parse(`${proposalDate}T00:00:00Z`) + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
    assert.strictEqual(getVerificationProposalState(verifiedToday, { date: nextDate }).ready, true);

    const missingPublishedVersion = structuredClone(source);
    delete missingPublishedVersion.release.publishedVersion;
    assert.throws(
        () => getVerificationProposalState(missingPublishedVersion, { date: proposalDate }),
        /published version is required/
    );
}

function testDailyWorkflowIsSingleRefreshableMaintainerApprovalPr() {
    const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'daily-verification.yml'), 'utf8');
    assert(workflow.includes('schedule:'));
    assert(workflow.includes('workflow_dispatch:'));
    assert(workflow.includes('pull-requests: write'));
    assert(workflow.includes('chore/status-daily-verification'));
    assert(workflow.includes('Verify Store v${proposal.targetVersion}'));
    assert(workflow.includes('getVerificationProposalState'));
    assert(!workflow.includes('latestStatusIsGreen'));
    assert(!workflow.includes('storeBuildMatches'));
    assert(workflow.includes('base_sha'));
    assert(workflow.includes('main changed while this proposal was being validated'));
    assert(workflow.includes('git push --force-with-lease'));
    assert(workflow.includes('check only this box and merge'));
    assert(workflow.includes('Do not merge this green verification PR'));
    assert(workflow.includes('Merging is the maintainer attestation'));
    assert(!workflow.includes('gh pr merge'));
    assert(!workflow.includes('enable-auto-merge'));
    assert(!workflow.includes('site/public/status.json'));
}

testVerifiedProposalUpdatesEverySupportedControlWithoutExpiry();
testProposalFixtureFollowsStatusPreparedByWorkflow();
testVerifiedProposalTargetsRecordedStoreBuildAcrossVersionMismatch();
testReportedProposalTurnsSelectedControlAndOverallStatusYellow();
testInProgressProposalStaysYellowAndPreservesHistory();
testMultipleSameDayStatusUpdatesPreserveNewestFirstOrder();
testIdenticalVerificationUpdateDoesNotDuplicateHistory();
testKnownIssueProposalUpdatesOnlySelectedControls();
testYellowProposalRejectsUnknownControl();
testStatusInputsRejectImpossibleDatesAndDuplicateFeatures();
testVerificationProposalStateAllowsUpdatesAndYellowRecovery();
testDailyWorkflowIsSingleRefreshableMaintainerApprovalPr();

console.log('Status proposal tests passed.');
