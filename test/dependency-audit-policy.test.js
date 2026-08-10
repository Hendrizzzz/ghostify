const assert = require('assert');
const {
    evaluateAudit,
    validateExceptionContext
} = require('../scripts/audit-development-dependencies');

const exception = {
    id: 'image-size-web-ext-dev-only-2026-08',
    package: 'image-size',
    version: '2.0.2',
    node: 'node_modules/image-size',
    advisories: ['GHSA-w3rx-r6r6-pgpr', 'GHSA-5p2g-fcmc-qvqq'],
    dependencyPath: ['web-ext', 'addons-linter', 'image-size'],
    scope: 'development-only',
    expiresOn: '2026-10-09'
};
const policy = { schemaVersion: 1, exceptions: [exception] };
const lockfile = {
    packages: {
        '': { devDependencies: { 'web-ext': '10.5.0' } },
        'node_modules/web-ext': {
            version: '10.5.0',
            dev: true,
            dependencies: { 'addons-linter': '10.8.0' }
        },
        'node_modules/addons-linter': {
            version: '10.8.0',
            dev: true,
            dependencies: { 'image-size': '2.0.2' }
        },
        'node_modules/image-size': { version: '2.0.2', dev: true }
    }
};
const audit = {
    auditReportVersion: 2,
    vulnerabilities: {
        'image-size': {
            severity: 'high',
            nodes: ['node_modules/image-size'],
            via: [
                { url: 'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr' },
                { url: 'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq' }
            ]
        },
        'addons-linter': {
            severity: 'high',
            nodes: ['node_modules/addons-linter'],
            via: ['image-size']
        },
        'web-ext': {
            severity: 'high',
            nodes: ['node_modules/web-ext'],
            via: ['addons-linter']
        }
    }
};
const reviewDate = new Date('2026-08-10T00:00:00Z');

assert.deepStrictEqual(
    evaluateAudit(audit, policy, lockfile, reviewDate).blocked,
    [],
    'the exact reviewed development-only advisory chain should pass'
);

const newAdvisory = structuredClone(audit);
newAdvisory.vulnerabilities['image-size'].via.push({
    url: 'https://github.com/advisories/GHSA-2345-6789-cfgh'
});
assert(
    evaluateAudit(newAdvisory, policy, lockfile, reviewDate).blocked.length > 0,
    'a new advisory on an excepted package must remain blocking'
);

const unrelated = structuredClone(audit);
unrelated.vulnerabilities['unexpected-package'] = {
    severity: 'critical',
    nodes: ['node_modules/unexpected-package'],
    via: [{ url: 'https://github.com/advisories/GHSA-2345-6789-cfgh' }]
};
assert(
    evaluateAudit(unrelated, policy, lockfile, reviewDate).blocked.some(reason => reason.includes('unexpected-package')),
    'an unrelated high or critical finding must remain blocking'
);

const runtimeLockfile = structuredClone(lockfile);
runtimeLockfile.packages['node_modules/image-size'].dev = false;
assert.strictEqual(
    validateExceptionContext(exception, runtimeLockfile, reviewDate).valid,
    false,
    'the exception must fail closed if the package becomes a runtime dependency'
);

const changedPath = structuredClone(lockfile);
delete changedPath.packages['node_modules/addons-linter'].dependencies['image-size'];
assert.strictEqual(
    validateExceptionContext(exception, changedPath, reviewDate).valid,
    false,
    'the exception must fail closed if the reviewed dependency path changes'
);

const changedAuditChain = structuredClone(audit);
changedAuditChain.vulnerabilities['web-ext'].via = ['image-size'];
assert(
    evaluateAudit(changedAuditChain, policy, lockfile, reviewDate).blocked.length > 0,
    'the exception must fail closed if the audit report skips or changes a reviewed dependency hop'
);

assert.strictEqual(
    validateExceptionContext(exception, lockfile, new Date('2026-10-10T00:00:00Z')).valid,
    false,
    'the exception must fail closed after its review deadline'
);

console.log('Dependency audit exception policy tests passed.');
