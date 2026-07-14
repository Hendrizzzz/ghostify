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

function main(argv) {
    const [version, changelogPath = 'CHANGELOG.md'] = argv;
    if (!version || argv.length > 2) {
        throw new Error('Usage: node scripts/extract-release-notes.js <version> [changelog-path]');
    }

    const changelog = fs.readFileSync(path.resolve(changelogPath), 'utf8');
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

module.exports = { extractReleaseNotes };
