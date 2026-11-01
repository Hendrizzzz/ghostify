// Release identity checks: package.json, package-lock.json, and the
// CHANGELOG.md heading must agree on the package version.

const { fail } = require("./assertions");

function assertPackageVersions(pkg, lock) {
    if (!pkg.version) fail("package.json must declare a version");
    if (lock.version && lock.version !== pkg.version) {
        fail(
            `package-lock.json version ${lock.version} does not match package.json ${pkg.version}`,
        );
    }
    if (
        lock.packages?.[""]?.version &&
        lock.packages[""].version !== pkg.version
    ) {
        fail(
            `package-lock root package version ${lock.packages[""].version} does not match package.json ${pkg.version}`,
        );
    }
}

function assertChangelogCoversPackageVersion(changelog, version) {
    if (!changelog.includes(`## [${version}]`)) {
        fail(`CHANGELOG.md must include a release heading for ${version}`);
    }
}

module.exports = {
    assertChangelogCoversPackageVersion,
    assertPackageVersions,
};
