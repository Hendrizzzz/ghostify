const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { buildSync } = require("esbuild");

const root = path.resolve(__dirname, "..");
const result = buildSync({
    entryPoints: [path.join(root, "site/src/app/statusData.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
});
const compiled = new Module(__filename, module);
compiled._compile(result.outputFiles[0].text, __filename);
const { STATUS_DATA, getStatusCredit } = compiled.exports;

function fixture() {
    const data = structuredClone(STATUS_DATA);
    data.release.matchesVerificationBuild = true;
    data.summary = {
        publicStatus: "under_review",
        label: "Version 2.1.0 is awaiting store review.",
        message: "Submitted to all stores.",
    };
    data.entries.forEach((entry) => {
        entry.verifiedAt = "2026-10-09T00:00:00Z";
    });
    data.history = [
        {
            date: "2026-10-15",
            eventType: "investigation",
            publicStatus: "under_review",
            title: "Version submitted",
            summary: "Awaiting store review.",
        },
    ];
    return data;
}

{
    const data = fixture();
    assert.deepEqual(getStatusCredit(data), {
        label: data.summary.label,
        updatedAt: "2026-10-15",
        verified: false,
    });
}

{
    const data = fixture();
    data.history.unshift({
        ...data.history[0],
        date: "2026-10-16",
        eventType: "release",
        title: "Release published",
    });
    assert.equal(getStatusCredit(data).updatedAt, "2026-10-15");
    data.history[0].eventType = "fix";
    assert.equal(getStatusCredit(data).updatedAt, "2026-10-15");
}

for (const publicStatus of [
    "maintainer_verified",
    "community_verified_reviewed",
]) {
    const data = fixture();
    data.summary.publicStatus = publicStatus;
    data.summary.label = "All supported controls are working.";
    assert.equal(getStatusCredit(data).verified, true);
    assert.equal(getStatusCredit(data).label, data.summary.label);
    data.release.matchesVerificationBuild = false;
    assert.deepEqual(getStatusCredit(data), {
        label: "Under review",
        updatedAt: "2026-10-15",
        verified: false,
    });
}

{
    const data = fixture();
    data.history = [];
    assert.equal(getStatusCredit(data).updatedAt, data.generatedAt);
}

console.log(
    "Landing status label, update date, and verification guard tests passed",
);
