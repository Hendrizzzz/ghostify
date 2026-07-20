const fs = require('fs');
const path = require('path');

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractReleaseNotes(changelog, version) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
        throw new Error('Release version must use X.Y.Z format.');
    }

    const headingPattern = new RegExp(`^## \\[${escapeRegExp(version)}\\](?: - .+)?$`, 'm');
    const heading = headingPattern.exec(changelog);
    if (!heading) throw new Error(`CHANGELOG.md does not contain a release heading for ${version}.`);

    const afterHeading = changelog.slice(heading.index + heading[0].length);
    const nextHeadingIndex = afterHeading.search(/^## /m);
    const notes = (nextHeadingIndex === -1 ? afterHeading : afterHeading.slice(0, nextHeadingIndex)).trim();
    if (!notes) throw new Error(`CHANGELOG.md release ${version} has no notes.`);

    return notes;
}

function assertDatedReleaseHeading(changelog, version) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
        throw new Error('Release version must use X.Y.Z format.');
    }

    const headingPattern = new RegExp(
        `^## \\[${escapeRegExp(version)}\\] - (\\d{4}-\\d{2}-\\d{2})$`,
        'm'
    );
    const match = headingPattern.exec(changelog);
    if (!match) {
        throw new Error(`CHANGELOG.md release ${version} must have a dated YYYY-MM-DD heading before publication.`);
    }

    const [year, month, day] = match[1].split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        throw new Error(`CHANGELOG.md release ${version} has an invalid publication date.`);
    }

    return match[1];
}

function main(argv) {
    const [version, changelogPath = 'CHANGELOG.md'] = argv;
    if (!version || argv.length > 2) {
        throw new Error('Usage: node scripts/extract-release-notes.js <version> [changelog-path]');
    }

    const changelog = fs.readFileSync(path.resolve(changelogPath), 'utf8');
    assertDatedReleaseHeading(changelog, version);
    process.stdout.write(`${extractReleaseNotes(changelog, version)}\n`);
}

if (require.main === module) {
    try {
        main(process.argv.slice(2));
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

module.exports = { assertDatedReleaseHeading, extractReleaseNotes };
