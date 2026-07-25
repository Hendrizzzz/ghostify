const assert = require('assert');
const {
    ALLOWED_DEV_ADVISORIES,
    evaluateAudit,
    isAllowanceActive
} = require('../scripts/audit-dependencies');

const advisoryUrl = 'https://github.com/advisories/GHSA-mh99-v99m-4gvg';
const audit = {
    metadata: {
        vulnerabilities: {
            high: 3,
            critical: 0
        }
    },
    vulnerabilities: {
        'brace-expansion': {
            severity: 'high',
            via: [{ url: advisoryUrl }],
            nodes: ['node_modules/brace-expansion']
        },
        minimatch: {
            severity: 'high',
            via: ['brace-expansion'],
            nodes: ['node_modules/minimatch']
        },
        'web-ext': {
            severity: 'high',
            via: ['minimatch'],
            nodes: ['node_modules/web-ext']
        }
    }
};
const developmentLockfile = {
    packages: {
        'node_modules/brace-expansion': { dev: true },
        'node_modules/minimatch': { dev: true },
        'node_modules/web-ext': { dev: true }
    }
};

const allowed = evaluateAudit(audit, developmentLockfile, new Date('2026-07-25T00:00:00Z'));
assert.deepStrictEqual(allowed.blocked, []);
assert.deepStrictEqual(allowed.allowedPackages, ['brace-expansion', 'minimatch', 'web-ext']);
assert.deepStrictEqual(allowed.allowedAdvisories, [advisoryUrl]);

const runtimeLockfile = JSON.parse(JSON.stringify(developmentLockfile));
runtimeLockfile.packages['node_modules/brace-expansion'].dev = false;
const runtimeFinding = evaluateAudit(audit, runtimeLockfile, new Date('2026-07-25T00:00:00Z'));
assert.deepStrictEqual(
    runtimeFinding.blocked.map(finding => finding.name).sort(),
    ['brace-expansion', 'minimatch', 'web-ext'],
    'an allowlisted advisory must still block when any affected root package is not development-only'
);

const expired = evaluateAudit(audit, developmentLockfile, new Date('2026-08-26T00:00:00Z'));
assert.deepStrictEqual(
    expired.blocked.map(finding => finding.name).sort(),
    ['brace-expansion', 'minimatch', 'web-ext'],
    'an expired advisory allowance must fail closed'
);

const unrelatedAudit = JSON.parse(JSON.stringify(audit));
unrelatedAudit.vulnerabilities['brace-expansion'].via[0].url =
    'https://github.com/advisories/GHSA-unrelated';
const unrelated = evaluateAudit(unrelatedAudit, developmentLockfile, new Date('2026-07-25T00:00:00Z'));
assert.deepStrictEqual(
    unrelated.blocked.map(finding => finding.name).sort(),
    ['brace-expansion', 'minimatch', 'web-ext'],
    'a different advisory must not inherit the narrow allowance'
);

const allowance = ALLOWED_DEV_ADVISORIES.get(advisoryUrl);
assert(isAllowanceActive(allowance, new Date('2026-08-25T23:59:59Z')));
assert(!isAllowanceActive(allowance, new Date('2026-08-26T00:00:00Z')));

assert.throws(
    () => evaluateAudit({}, developmentLockfile),
    /missing a vulnerabilities object/,
    'missing npm audit vulnerability data must fail closed'
);

const malformedSeverity = JSON.parse(JSON.stringify(audit));
delete malformedSeverity.vulnerabilities['brace-expansion'].severity;
assert.throws(
    () => evaluateAudit(malformedSeverity, developmentLockfile),
    /invalid severity/,
    'a malformed vulnerability severity must fail closed'
);

const malformedVia = JSON.parse(JSON.stringify(audit));
malformedVia.vulnerabilities['brace-expansion'].via = [{}];
assert.throws(
    () => evaluateAudit(malformedVia, developmentLockfile),
    /invalid via chain/,
    'a malformed advisory chain must fail closed'
);

const malformedMetadata = JSON.parse(JSON.stringify(audit));
delete malformedMetadata.metadata.vulnerabilities.high;
assert.throws(
    () => evaluateAudit(malformedMetadata, developmentLockfile),
    /invalid high or critical metadata counts/,
    'missing audit summary counts must fail closed'
);

const mismatchedMetadata = JSON.parse(JSON.stringify(audit));
mismatchedMetadata.vulnerabilities = {};
assert.throws(
    () => evaluateAudit(mismatchedMetadata, developmentLockfile),
    /metadata counts do not match vulnerability entries/,
    'nonzero audit summary counts with missing vulnerability entries must fail closed'
);

console.log('Dependency audit policy tests passed.');
