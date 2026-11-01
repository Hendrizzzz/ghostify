const assert = require("assert");
const fs = require("fs");

function testReleaseDocsIncludeMessengerFacebookStorySmokeIds() {
    const qaFixtures = fs.readFileSync("docs/QA_FIXTURES.md", "utf8");
    const releaseChecklist = fs.readFileSync("RELEASE_CHECKLIST.md", "utf8");

    for (const smokeId of ["GH-MSG-STORY-001", "GH-FB-STORY-001"]) {
        assert(
            qaFixtures.includes(smokeId) && releaseChecklist.includes(smokeId),
            `${smokeId} should be part of release smoke coverage when public copy claims Messenger/Facebook story-view support`,
        );
    }
}

(async () => {
    testReleaseDocsIncludeMessengerFacebookStorySmokeIds();
    console.log("release documentation regression tests passed");
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
