const assert = require('assert');
const fs = require('fs');

const { assertDatedReleaseHeading, extractReleaseNotes } = require('../scripts/extract-release-notes');

const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
const pkg = require('../package.json');
const notes = extractReleaseNotes(changelog, pkg.version);
const publishWorkflow = fs.readFileSync('.github/workflows/publish-release.yml', 'utf8');

assert(notes.includes('### Added'), 'current release notes should include the Added section');
assert(!notes.includes('## Historical Releases'), 'release notes must stop at the next version heading');
assert.throws(
    () => extractReleaseNotes(changelog, '999.999.999'),
    /does not contain a release heading/
);
assert.throws(
    () => extractReleaseNotes('## [1.2.3]\n\n## [1.2.2]\n\n- Earlier release.', '1.2.3'),
    /has no notes/
);
assert.throws(() => extractReleaseNotes(changelog, 'release-2.0.4'), /must use X.Y.Z format/);
assert.strictEqual(
    assertDatedReleaseHeading('## [1.2.3] - 2026-07-20\n\n- Release notes.', '1.2.3'),
    '2026-07-20'
);
assert.throws(
    () => assertDatedReleaseHeading('## [1.2.3] - Unreleased\n\n- Release notes.', '1.2.3'),
    /must have a dated YYYY-MM-DD heading/
);
assert.throws(
    () => assertDatedReleaseHeading('## [1.2.3] - 2026-02-30\n\n- Release notes.', '1.2.3'),
    /invalid publication date/
);

assert(
    publishWorkflow.includes('chrome_web_store_sha256') &&
    publishWorkflow.includes('Match approved Chrome Web Store artifact') &&
    publishWorkflow.includes('sha256sum'),
    'release workflow must bind the GitHub Release package to the approved Chrome Web Store artifact hash'
);

console.log('release-note extraction tests passed');
