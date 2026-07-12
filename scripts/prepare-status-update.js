const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const statusSourcePath = path.join(repoRoot, 'site', 'src', 'app', 'statusData.json');

const QA_IDS = {
    'instagram-hide-seen': 'GH-IG-SEEN-001',
    'instagram-hide-typing': 'GH-IG-TYPING-001',
    'instagram-hide-story-views': 'GH-IG-STORY-001',
    'messenger-hide-seen': 'GH-MSG-SEEN-001',
    'messenger-hide-typing': 'GH-MSG-TYPING-001',
    'messenger-hide-story-views': 'GH-MSG-STORY-001',
    'facebook-hide-seen': 'GH-FB-SEEN-001',
    'facebook-hide-typing': 'GH-FB-TYPING-001',
    'facebook-hide-story-views': 'GH-FB-STORY-001'
};

const YELLOW_MODES = {
    reported: {
        publicStatus: 'under_review',
        label: 'Reports received',
        title: 'Bug reports received',
        recordPrefix: 'Reports recorded'
    },
    'in-progress': {
        publicStatus: 'work_in_progress',
        label: 'Working on it',
        title: 'Fix work in progress',
        recordPrefix: 'Work in progress recorded'
    },
    'known-issue': {
        publicStatus: 'known_issue',
        label: 'Known issue',
        title: 'Issue confirmed',
        recordPrefix: 'Known issue recorded'
    }
};

const ALLOWED_ARGS = new Set(['mode', 'date', 'generated-at', 'features', 'issue-url', 'note']);

function parseArgs(argv) {
    const options = {};
    for (let index = 0; index < argv.length; index += 1) {
        const key = argv[index];
        if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
        const name = key.slice(2);
        if (!ALLOWED_ARGS.has(name)) throw new Error(`Unknown option: ${key}`);
        const value = argv[index + 1];
        if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
        options[name] = value;
        index += 1;
    }
    return options;
}

function assertDate(date) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) throw new Error(`Invalid UTC date: ${date}`);
    const [, year, month, day] = match;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
        parsed.getUTCFullYear() !== Number(year) ||
        parsed.getUTCMonth() !== Number(month) - 1 ||
        parsed.getUTCDate() !== Number(day)
    ) {
        throw new Error(`Invalid UTC date: ${date}`);
    }
}

function assertGeneratedAt(generatedAt, date, releaseCheckedAt) {
    const parsed = new Date(generatedAt);
    if (
        Number.isNaN(parsed.getTime()) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(generatedAt) ||
        parsed.toISOString().replace('.000Z', 'Z') !== generatedAt
    ) {
        throw new Error(`Invalid generated-at timestamp: ${generatedAt}`);
    }
    if (parsed.getTime() < Date.parse(isoAtUtcStart(date))) {
        throw new Error('generated-at timestamp must not predate the status date.');
    }
    if (releaseCheckedAt && parsed.getTime() < Date.parse(releaseCheckedAt)) {
        throw new Error('generated-at timestamp must not predate the recorded Store check.');
    }
}

function isoAtUtcStart(date) {
    return `${date}T00:00:00Z`;
}

function formatLongUtcDate(date) {
    return new Date(isoAtUtcStart(date)).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
    });
}

function prependHistory(status, item) {
    status.history = [item, ...status.history];
}

function assertNotBackdated(status, date) {
    const latestDate = status.history?.[0]?.date;
    if (latestDate && Date.parse(isoAtUtcStart(date)) < Date.parse(isoAtUtcStart(latestDate))) {
        throw new Error(`Status date ${date} must not predate latest history date ${latestDate}.`);
    }
}

function assertKnownFeatureIds(status, featureIds, mode) {
    if (!featureIds?.length) throw new Error(`${mode} updates require at least one feature id.`);
    if (new Set(featureIds).size !== featureIds.length) throw new Error('Feature ids must not contain duplicates.');
    const knownIds = new Set(status.entries.map(entry => entry.id));
    for (const id of featureIds) {
        if (!knownIds.has(id)) throw new Error(`Unknown feature id: ${id}`);
    }
}

function assertIssueUrl(issueUrl) {
    if (issueUrl && !/^https:\/\/github\.com\/Hendrizzzz\/Ghostify\/issues\/\d+(?:[/?#].*)?$/.test(issueUrl)) {
        throw new Error('Issue URL must point to a Ghostify GitHub issue over HTTPS.');
    }
}

function prepareVerifiedStatus(input, { date, generatedAt }) {
    const status = structuredClone(input);
    assertDate(date);
    assertGeneratedAt(generatedAt, date, status.release.checkedAt);
    assertNotBackdated(status, date);

    if (!status.release.matchesVerificationBuild || status.release.publishedVersion !== status.productVersion) {
        throw new Error(
            `Cannot prepare a green verification PR: Store v${status.release.publishedVersion} does not match build v${status.productVersion}.`
        );
    }

    const verifiedAt = isoAtUtcStart(date);
    const longDate = formatLongUtcDate(date);

    status.generatedAt = generatedAt;
    status.summary = {
        publicStatus: 'maintainer_verified',
        label: `Verified ${longDate}`,
        message: `The maintainer confirmed that all supported controls are working on ${longDate}.`
    };

    status.entries = status.entries.map(entry => {
        const qaId = QA_IDS[entry.id];
        if (!qaId) throw new Error(`Missing QA fixture mapping for ${entry.id}`);
        return {
            ...entry,
            publicStatus: 'maintainer_verified',
            localEvidenceStatus: 'verified',
            sourceType: 'maintainer',
            reviewer: 'Hendrizzzz maintainer verification',
            reviewRecord: `${qaId} approved in the ${date} verification PR for v${status.productVersion}`,
            verifiedAt,
            relatedIssueUrl: null,
            notes: `Maintainer-confirmed verification for ${entry.platform} ${entry.feature} on ${longDate}.`
        };
    });

    prependHistory(status, {
        date,
        publicStatus: 'maintainer_verified',
        title: 'All supported controls verified',
        summary: `The maintainer confirmed that all supported controls are working on v${status.productVersion}.`
    });

    return status;
}

function prepareYellowStatus(input, { mode, date, generatedAt, featureIds, issueUrl = null, note }) {
    const status = structuredClone(input);
    const modeConfig = YELLOW_MODES[mode];
    if (!modeConfig) throw new Error(`Unsupported yellow status mode: ${mode}`);
    assertDate(date);
    assertGeneratedAt(generatedAt, date, status.release.checkedAt);
    assertNotBackdated(status, date);
    assertKnownFeatureIds(status, featureIds, mode);
    assertIssueUrl(issueUrl);

    const selected = new Set(featureIds);
    const affectedLabels = [];
    const longDate = formatLongUtcDate(date);
    status.generatedAt = generatedAt;
    status.entries = status.entries.map(entry => {
        if (!selected.has(entry.id)) return entry;
        affectedLabels.push(`${entry.platform} ${entry.feature}`);
        return {
            ...entry,
            publicStatus: modeConfig.publicStatus,
            localEvidenceStatus: 'manual_pending',
            sourceType: 'maintainer',
            reviewer: 'Hendrizzzz maintainer update',
            reviewRecord: `${modeConfig.recordPrefix} on ${date} for v${status.productVersion}`,
            relatedIssueUrl: issueUrl,
            notes: note || `${modeConfig.label} for ${entry.platform} ${entry.feature} as of ${longDate}.`
        };
    });

    const defaultMessage = `${modeConfig.label} for ${affectedLabels.join(', ')}.`;
    status.summary = {
        publicStatus: modeConfig.publicStatus,
        label: modeConfig.label,
        message: note || defaultMessage
    };
    prependHistory(status, {
        date,
        publicStatus: modeConfig.publicStatus,
        title: modeConfig.title,
        summary: note || defaultMessage
    });
    return status;
}

function prepareStatusUpdate(input, options) {
    if (options.mode === 'verified') return prepareVerifiedStatus(input, options);
    if (YELLOW_MODES[options.mode]) return prepareYellowStatus(input, options);
    throw new Error(`Unsupported status mode: ${options.mode}`);
}

function isGreenProposalEligible(status, { scheduled }) {
    const latestStatusIsGreen = ['maintainer_verified', 'community_verified_reviewed'].includes(status.summary?.publicStatus);
    const storeBuildMatches = status.release?.matchesVerificationBuild === true &&
        status.release?.publishedVersion === status.productVersion;
    return {
        latestStatusIsGreen,
        storeBuildMatches,
        ready: storeBuildMatches && (!scheduled || latestStatusIsGreen)
    };
}

function writeStatus(status) {
    fs.writeFileSync(statusSourcePath, `${JSON.stringify(status, null, 2)}\n`);
}

function run(argv = process.argv.slice(2)) {
    const args = parseArgs(argv);
    if (!args.mode) throw new Error('--mode is required; green verification must be explicit.');
    const now = new Date();
    const date = args.date || now.toISOString().slice(0, 10);
    const generatedAt = args['generated-at'] || now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const input = JSON.parse(fs.readFileSync(statusSourcePath, 'utf8'));
    const status = prepareStatusUpdate(input, {
        mode: args.mode,
        date,
        generatedAt,
        featureIds: args.features ? args.features.split(',').map(value => value.trim()).filter(Boolean) : [],
        issueUrl: args['issue-url'] || null,
        note: args.note || ''
    });
    writeStatus(status);
}

if (require.main === module) {
    try {
        run();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

module.exports = {
    QA_IDS,
    YELLOW_MODES,
    parseArgs,
    prepareStatusUpdate,
    prepareVerifiedStatus,
    prepareYellowStatus,
    isGreenProposalEligible
};
