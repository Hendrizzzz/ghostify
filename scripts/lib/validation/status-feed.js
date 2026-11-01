// Contract for the public status feed (site/src/app/statusData.json), which
// the popup and the status page display. The checks run section by section
// in a fixed order and stop at the first failure.

const fs = require("fs");
const {
    assertBoolean,
    assertEnum,
    assertEqual,
    assertHttpsUrl,
    assertIsoDate,
    assertNullableHttpsUrl,
    assertNullableIsoDate,
    assertObject,
    assertOnlyKeys,
    fail,
} = require("./assertions");

const PUBLIC_STATUS_VALUES = [
    "maintainer_verified",
    "community_verified_reviewed",
    "under_review",
    "work_in_progress",
    "known_issue",
    "public_status_unavailable",
];

const VERIFIED_PUBLIC_STATUS_VALUES = new Set([
    "maintainer_verified",
    "community_verified_reviewed",
]);

const PUBLIC_STATUS_LOCAL_EVIDENCE_VALUES = [
    "manual_pending",
    "verified",
    "gap",
    "not_applicable",
];

const PUBLIC_STATUS_EVIDENCE_TYPES = [
    "sender_side_no_signal",
    "story_owner_no_view",
    "local_loaded",
    "local_probe_blocked",
    "manual_smoke_pending",
];

const PUBLIC_STATUS_SOURCE_TYPES = ["maintainer", "reviewed_community"];

const PUBLIC_STATUS_PLATFORM_VALUES = ["Instagram", "Messenger", "Facebook"];

const PUBLIC_STATUS_FEATURE_VALUES = [
    "Hide Seen",
    "Hide Typing",
    "Hide Story Views",
];

function assertNoDuplicateStatusSource(publicStatusPath) {
    if (fs.existsSync(publicStatusPath)) {
        fail(
            "site/public/status.json must not exist; site/src/app/statusData.json is the canonical source",
        );
    }
}

function assertStatusFeedFields(statusJson, productVersion) {
    assertObject(statusJson, "site/src/app/statusData.json");
    assertOnlyKeys(
        statusJson,
        [
            "schemaVersion",
            "product",
            "productVersion",
            "generatedAt",
            "release",
            "statusUrl",
            "historyUrl",
            "summary",
            "policy",
            "automationPolicy",
            "communityVerification",
            "entries",
            "history",
        ],
        "site/src/app/statusData.json",
    );
    assertEqual(
        statusJson.schemaVersion,
        1,
        "site/src/app/statusData.json schemaVersion",
    );
    assertEqual(
        statusJson.productVersion,
        productVersion,
        "site/src/app/statusData.json productVersion",
    );
    assertHttpsUrl(
        statusJson.statusUrl,
        "site/src/app/statusData.json statusUrl",
    );
    assertHttpsUrl(
        statusJson.historyUrl,
        "site/src/app/statusData.json historyUrl",
    );
    assertNullableIsoDate(
        statusJson.generatedAt,
        "site/src/app/statusData.json generatedAt",
    );
}

function assertStatusRelease(statusJson) {
    assertObject(statusJson.release, "site/src/app/statusData.json release");
    assertOnlyKeys(
        statusJson.release,
        [
            "channel",
            "publishedAt",
            "publishedVersion",
            "verificationVersion",
            "checkedAt",
            "matchesVerificationBuild",
            "storeUrl",
        ],
        "site/src/app/statusData.json release",
    );
    assertEqual(
        statusJson.release.channel,
        "Chrome Web Store",
        "site/src/app/statusData.json release.channel",
    );
    assertIsoDate(
        statusJson.release.publishedAt,
        "site/src/app/statusData.json release.publishedAt",
    );
    assertEqual(
        statusJson.release.publishedAt,
        "2026-02-06",
        "site/src/app/statusData.json release.publishedAt",
    );
    if (
        !statusJson.release.publishedVersion ||
        typeof statusJson.release.publishedVersion !== "string"
    ) {
        fail(
            "site/src/app/statusData.json release.publishedVersion must be a non-empty string",
        );
    }
    if (
        !statusJson.release.verificationVersion ||
        typeof statusJson.release.verificationVersion !== "string"
    ) {
        fail(
            "site/src/app/statusData.json release.verificationVersion must be a non-empty string",
        );
    }
    assertNullableIsoDate(
        statusJson.release.checkedAt,
        "site/src/app/statusData.json release.checkedAt",
    );
    assertHttpsUrl(
        statusJson.release.storeUrl,
        "site/src/app/statusData.json release.storeUrl",
    );
    assertEqual(
        statusJson.release.storeUrl,
        "https://chromewebstore.google.com/detail/ghostify-hide-seen-typing/flpnibonbhdmnpgflnbemgghghhblmpm",
        "site/src/app/statusData.json release.storeUrl",
    );
    assertEqual(
        statusJson.release.matchesVerificationBuild,
        statusJson.release.publishedVersion ===
            statusJson.release.verificationVersion,
        "site/src/app/statusData.json release.matchesVerificationBuild",
    );
    if (
        Date.parse(statusJson.generatedAt) <
        Date.parse(statusJson.release.checkedAt)
    ) {
        fail(
            "site/src/app/statusData.json generatedAt must not predate release.checkedAt",
        );
    }
}

function assertStatusSummary(statusJson) {
    assertObject(statusJson.summary, "site/src/app/statusData.json summary");
    assertOnlyKeys(
        statusJson.summary,
        ["publicStatus", "label", "message"],
        "site/src/app/statusData.json summary",
    );
    assertEnum(
        statusJson.summary.publicStatus,
        PUBLIC_STATUS_VALUES,
        "site/src/app/statusData.json summary.publicStatus",
    );
    if (
        !statusJson.summary.label ||
        typeof statusJson.summary.label !== "string"
    ) {
        fail(
            "site/src/app/statusData.json summary.label must be a non-empty string",
        );
    }
    if (
        !statusJson.summary.message ||
        typeof statusJson.summary.message !== "string"
    ) {
        fail(
            "site/src/app/statusData.json summary.message must be a non-empty string",
        );
    }
    if (
        !statusJson.release.matchesVerificationBuild &&
        VERIFIED_PUBLIC_STATUS_VALUES.has(statusJson.summary.publicStatus)
    ) {
        fail(
            "site/src/app/statusData.json summary cannot be verified when the published Store version differs from the verification build",
        );
    }
}

function assertStatusPolicies(statusJson) {
    assertObject(statusJson.policy, "site/src/app/statusData.json policy");
    assertOnlyKeys(
        statusJson.policy,
        [
            "verificationCadence",
            "latestMergedUpdateWins",
            "ageDoesNotChangeStatus",
        ],
        "site/src/app/statusData.json policy",
    );
    assertBoolean(
        statusJson.policy.latestMergedUpdateWins,
        true,
        "site/src/app/statusData.json policy.latestMergedUpdateWins",
    );
    assertBoolean(
        statusJson.policy.ageDoesNotChangeStatus,
        true,
        "site/src/app/statusData.json policy.ageDoesNotChangeStatus",
    );

    assertObject(
        statusJson.automationPolicy,
        "site/src/app/statusData.json automationPolicy",
    );
    assertOnlyKeys(
        statusJson.automationPolicy,
        [
            "canFlagReports",
            "canSummarizeReports",
            "canDowngradeStatus",
            "canMarkVerified",
        ],
        "site/src/app/statusData.json automationPolicy",
    );
    assertBoolean(
        statusJson.automationPolicy.canFlagReports,
        true,
        "site/src/app/statusData.json automationPolicy.canFlagReports",
    );
    assertBoolean(
        statusJson.automationPolicy.canSummarizeReports,
        true,
        "site/src/app/statusData.json automationPolicy.canSummarizeReports",
    );
    assertBoolean(
        statusJson.automationPolicy.canDowngradeStatus,
        true,
        "site/src/app/statusData.json automationPolicy.canDowngradeStatus",
    );
    assertBoolean(
        statusJson.automationPolicy.canMarkVerified,
        false,
        "site/src/app/statusData.json automationPolicy.canMarkVerified",
    );

    assertObject(
        statusJson.communityVerification,
        "site/src/app/statusData.json communityVerification",
    );
    assertOnlyKeys(
        statusJson.communityVerification,
        [
            "requiresMaintainerReview",
            "publicCreditRequiresOptIn",
            "screenshotsMustBeRedacted",
            "privateMessagesAllowed",
            "rawSubmissionsShownInPopup",
        ],
        "site/src/app/statusData.json communityVerification",
    );
    assertBoolean(
        statusJson.communityVerification.requiresMaintainerReview,
        true,
        "site/src/app/statusData.json communityVerification.requiresMaintainerReview",
    );
    assertBoolean(
        statusJson.communityVerification.publicCreditRequiresOptIn,
        true,
        "site/src/app/statusData.json communityVerification.publicCreditRequiresOptIn",
    );
    assertBoolean(
        statusJson.communityVerification.screenshotsMustBeRedacted,
        true,
        "site/src/app/statusData.json communityVerification.screenshotsMustBeRedacted",
    );
    assertBoolean(
        statusJson.communityVerification.privateMessagesAllowed,
        false,
        "site/src/app/statusData.json communityVerification.privateMessagesAllowed",
    );
    assertBoolean(
        statusJson.communityVerification.rawSubmissionsShownInPopup,
        false,
        "site/src/app/statusData.json communityVerification.rawSubmissionsShownInPopup",
    );
}

function assertStatusEntries(statusJson) {
    if (!Array.isArray(statusJson.entries) || !statusJson.entries.length) {
        fail("site/src/app/statusData.json entries must be a non-empty array");
    }
    if (statusJson.entries.length > 32) {
        fail(
            "site/src/app/statusData.json entries must stay compact for popup use",
        );
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
        assertOnlyKeys(
            entry,
            [
                "id",
                "platform",
                "feature",
                "publicStatus",
                "localEvidenceStatus",
                "publicEvidenceType",
                "sourceType",
                "reviewer",
                "reviewRecord",
                "verifiedAt",
                "relatedIssueUrl",
                "notes",
            ],
            label,
        );
        if (!entry.id || typeof entry.id !== "string")
            fail(`${label}.id must be a non-empty string`);
        assertEnum(
            entry.platform,
            PUBLIC_STATUS_PLATFORM_VALUES,
            `${label}.platform`,
        );
        assertEnum(
            entry.feature,
            PUBLIC_STATUS_FEATURE_VALUES,
            `${label}.feature`,
        );
        assertEnum(
            entry.publicStatus,
            PUBLIC_STATUS_VALUES,
            `${label}.publicStatus`,
        );
        if (
            !statusJson.release.matchesVerificationBuild &&
            VERIFIED_PUBLIC_STATUS_VALUES.has(entry.publicStatus)
        ) {
            fail(
                `${label}.publicStatus cannot be verified when the published Store version differs from the verification build`,
            );
        }
        assertEnum(
            entry.localEvidenceStatus,
            PUBLIC_STATUS_LOCAL_EVIDENCE_VALUES,
            `${label}.localEvidenceStatus`,
        );
        assertEnum(
            entry.publicEvidenceType,
            PUBLIC_STATUS_EVIDENCE_TYPES,
            `${label}.publicEvidenceType`,
        );
        assertEnum(
            entry.sourceType,
            PUBLIC_STATUS_SOURCE_TYPES,
            `${label}.sourceType`,
        );
        assertNullableIsoDate(entry.verifiedAt, `${label}.verifiedAt`);
        assertNullableHttpsUrl(
            entry.relatedIssueUrl,
            `${label}.relatedIssueUrl`,
        );
        if (!entry.reviewer || typeof entry.reviewer !== "string")
            fail(`${label}.reviewer must be a non-empty string`);
        if (!entry.reviewRecord || typeof entry.reviewRecord !== "string")
            fail(`${label}.reviewRecord must be a non-empty string`);
        if (!entry.notes || typeof entry.notes !== "string")
            fail(`${label}.notes must be a non-empty string`);

        if (VERIFIED_PUBLIC_STATUS_VALUES.has(entry.publicStatus)) {
            if (!entry.verifiedAt)
                fail(
                    `${label}.verifiedAt is required for verified public status`,
                );
            if (entry.localEvidenceStatus !== "verified") {
                fail(
                    `${label}.localEvidenceStatus must be verified for verified public status`,
                );
            }
        }

        if (
            entry.publicStatus === "maintainer_verified" &&
            entry.sourceType !== "maintainer"
        ) {
            fail(
                `${label}.sourceType must be maintainer for maintainer_verified`,
            );
        }
        if (
            entry.publicStatus === "community_verified_reviewed" &&
            entry.sourceType !== "reviewed_community"
        ) {
            fail(
                `${label}.sourceType must be reviewed_community for community_verified_reviewed`,
            );
        }

        const featureKey = `${entry.platform}:${entry.feature}`;
        if (actualFeatureKeys.has(featureKey)) {
            fail(
                `site/src/app/statusData.json has duplicate public verification entry for ${featureKey}`,
            );
        }
        actualFeatureKeys.add(featureKey);
    }

    for (const key of expectedFeatureKeys) {
        if (!actualFeatureKeys.has(key)) {
            fail(
                `site/src/app/statusData.json is missing public verification entry for ${key}`,
            );
        }
    }

    if (statusJson.summary.publicStatus === "maintainer_verified") {
        for (const [index, entry] of statusJson.entries.entries()) {
            if (entry.publicStatus !== "maintainer_verified") {
                fail(
                    `site/src/app/statusData.json entries[${index}].publicStatus must be maintainer_verified when summary is maintainer_verified`,
                );
            }
        }
    }
}

function assertStatusHistory(statusJson) {
    if (!Array.isArray(statusJson.history) || !statusJson.history.length) {
        fail("site/src/app/statusData.json history must be a non-empty array");
    }
    for (const [index, item] of statusJson.history.entries()) {
        const label = `site/src/app/statusData.json history[${index}]`;
        assertObject(item, label);
        assertOnlyKeys(
            item,
            ["date", "publicStatus", "eventType", "title", "summary"],
            label,
        );
        assertNullableIsoDate(item.date, `${label}.date`);
        assertEnum(
            item.publicStatus,
            PUBLIC_STATUS_VALUES,
            `${label}.publicStatus`,
        );
        assertEnum(
            item.eventType,
            ["release", "fix", "verification", "incident", "investigation"],
            `${label}.eventType`,
        );
        if (!item.title || typeof item.title !== "string")
            fail(`${label}.title must be a non-empty string`);
        if (!item.summary || typeof item.summary !== "string")
            fail(`${label}.summary must be a non-empty string`);
        if (
            Date.parse(`${item.date}T00:00:00Z`) >
            Date.parse(statusJson.generatedAt)
        ) {
            fail(`${label}.date must not be after generatedAt`);
        }
        if (
            index > 0 &&
            Date.parse(item.date) >
                Date.parse(statusJson.history[index - 1].date)
        ) {
            fail(
                "site/src/app/statusData.json history must be newest-first; same-day records keep array order",
            );
        }
    }
    const latestStatusRecord =
        statusJson.history.find(
            (item) => item.eventType !== "release" && item.eventType !== "fix",
        ) || statusJson.history[0];
    if (latestStatusRecord.publicStatus !== statusJson.summary.publicStatus) {
        fail(
            "site/src/app/statusData.json summary.publicStatus must match the latest verification status record",
        );
    }
    if (statusJson.summary.publicStatus === "maintainer_verified") {
        for (const [index, entry] of statusJson.entries.entries()) {
            if (
                String(entry.verifiedAt).slice(0, 10) !==
                latestStatusRecord.date
            ) {
                fail(
                    `site/src/app/statusData.json entries[${index}].verifiedAt must match the latest verification status date`,
                );
            }
        }
    }
}

function assertStatusPublicCopy(statusJson) {
    const publicCopy = [
        statusJson.summary.label,
        statusJson.summary.message,
        ...statusJson.history.flatMap((item) => [item.title, item.summary]),
    ];
    const internalPhrases = [
        /\bmust be published\b/i,
        /\bmaintainer-approved\b/i,
        /\brepository (?:build|proof|evidence)\b/i,
        /\bverification build pending\b/i,
        /\bstatus-enabled store build\b/i,
    ];
    for (const phrase of internalPhrases) {
        if (publicCopy.some((value) => phrase.test(value))) {
            fail(
                `site/src/app/statusData.json public copy contains internal workflow language: ${phrase}`,
            );
        }
    }
}

function assertStatusJsonContract(statusJson, productVersion) {
    assertStatusFeedFields(statusJson, productVersion);
    assertStatusRelease(statusJson);
    assertStatusSummary(statusJson);
    assertStatusPolicies(statusJson);
    assertStatusEntries(statusJson);
    assertStatusHistory(statusJson);
    assertStatusPublicCopy(statusJson);
}

module.exports = {
    assertNoDuplicateStatusSource,
    assertStatusJsonContract,
};
