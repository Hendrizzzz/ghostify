const assert = require('assert');
const fs = require('fs');

const { extractReleaseNotes } = require('../scripts/extract-release-notes');

const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
const pkg = require('../package.json');
const notes = extractReleaseNotes(changelog, pkg.version);

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

console.log('release-note extraction tests passed');
