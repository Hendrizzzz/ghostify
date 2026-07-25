const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const HIGH_SEVERITIES = new Set(['high', 'critical']);
const KNOWN_SEVERITIES = new Set(['info', 'low', 'moderate', 'high', 'critical']);
const ALLOWED_DEV_ADVISORIES = new Map([
    [
        'https://github.com/advisories/GHSA-mh99-v99m-4gvg',
        {
            expiresAfter: '2026-08-25',
            reason: 'brace-expansion is reachable only through the pinned web-ext development toolchain'
        }
    ]
]);

function parseDate(value) {
    const date = new Date(`${value}T23:59:59.999Z`);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid audit-policy date: ${value}`);
    }
    return date;
}

function isAllowanceActive(allowance, now) {
    return now.getTime() <= parseDate(allowance.expiresAfter).getTime();
}

function affectedNodesAreDevelopmentOnly(vulnerability, lockfile) {
    return (
        Array.isArray(vulnerability.nodes) &&
        vulnerability.nodes.length > 0 &&
        vulnerability.nodes.every(node => lockfile.packages?.[node]?.dev === true)
    );
}

function validateAuditSchema(audit) {
    if (!audit || typeof audit !== 'object' || Array.isArray(audit)) {
        throw new Error('npm audit JSON must be an object');
    }
    if (
        !audit.vulnerabilities ||
        typeof audit.vulnerabilities !== 'object' ||
        Array.isArray(audit.vulnerabilities)
    ) {
        throw new Error('npm audit JSON is missing a vulnerabilities object');
    }
    const counts = audit.metadata?.vulnerabilities;
    if (
        !counts ||
        !Number.isInteger(counts.high) ||
        counts.high < 0 ||
        !Number.isInteger(counts.critical) ||
        counts.critical < 0
    ) {
        throw new Error('npm audit JSON has invalid high or critical metadata counts');
    }

    const observedCounts = { high: 0, critical: 0 };
    for (const [name, vulnerability] of Object.entries(audit.vulnerabilities)) {
        if (!vulnerability || typeof vulnerability !== 'object' || Array.isArray(vulnerability)) {
            throw new Error(`npm audit vulnerability ${name} must be an object`);
        }
        if (!KNOWN_SEVERITIES.has(vulnerability.severity)) {
            throw new Error(`npm audit vulnerability ${name} has an invalid severity`);
        }
        if (HIGH_SEVERITIES.has(vulnerability.severity)) {
            observedCounts[vulnerability.severity] += 1;
        }
        if (
            !Array.isArray(vulnerability.via) ||
            vulnerability.via.some(
                via =>
                    !(
                        (typeof via === 'string' && via.length > 0) ||
                        (via &&
                            typeof via === 'object' &&
                            !Array.isArray(via) &&
                            typeof via.url === 'string' &&
                            via.url.length > 0)
                    )
            )
        ) {
            throw new Error(`npm audit vulnerability ${name} has an invalid via chain`);
        }
        if (
            !Array.isArray(vulnerability.nodes) ||
            vulnerability.nodes.length === 0 ||
            vulnerability.nodes.some(node => typeof node !== 'string' || node.length === 0)
        ) {
            throw new Error(`npm audit vulnerability ${name} has invalid affected nodes`);
        }
    }

    if (observedCounts.high !== counts.high || observedCounts.critical !== counts.critical) {
        throw new Error('npm audit high or critical metadata counts do not match vulnerability entries');
    }
}

function evaluateAudit(audit, lockfile, now = new Date()) {
    validateAuditSchema(audit);
    if (!lockfile?.packages || typeof lockfile.packages !== 'object') {
        throw new Error('package-lock.json is missing its packages object');
    }

    const relevant = new Map(
        Object.entries(audit.vulnerabilities || {}).filter(([, vulnerability]) =>
            HIGH_SEVERITIES.has(vulnerability.severity)
        )
    );
    const allowedPackages = new Set();
    const allowedAdvisories = new Set();

    let changed = true;
    while (changed) {
        changed = false;
        for (const [name, vulnerability] of relevant) {
            if (allowedPackages.has(name) || !affectedNodesAreDevelopmentOnly(vulnerability, lockfile)) {
                continue;
            }

            const advisoryVias = (vulnerability.via || []).filter(via => typeof via === 'object');
            const packageVias = (vulnerability.via || []).filter(via => typeof via === 'string');
            const advisoriesAllowed =
                advisoryVias.length > 0 &&
                advisoryVias.every(via => {
                    const allowance = ALLOWED_DEV_ADVISORIES.get(via.url);
                    if (!allowance || !isAllowanceActive(allowance, now)) {
                        return false;
                    }
                    allowedAdvisories.add(via.url);
                    return true;
                });
            const packagesAllowed =
                packageVias.length > 0 && packageVias.every(dependency => allowedPackages.has(dependency));

            if (
                (advisoryVias.length === 0 || advisoriesAllowed) &&
                (packageVias.length === 0 || packagesAllowed) &&
                advisoryVias.length + packageVias.length > 0
            ) {
                allowedPackages.add(name);
                changed = true;
            }
        }
    }

    const blocked = [...relevant.entries()]
        .filter(([name]) => !allowedPackages.has(name))
        .map(([name, vulnerability]) => ({
            name,
            severity: vulnerability.severity,
            via: vulnerability.via
        }));

    return {
        allowedPackages: [...allowedPackages].sort(),
        allowedAdvisories: [...allowedAdvisories].sort(),
        blocked
    };
}

function runAudit() {
    const repoRoot = path.resolve(__dirname, '..');
    const npmExecPath = process.env.npm_execpath;
    const command = npmExecPath ? process.execPath : 'npm';
    const args = npmExecPath ? [npmExecPath, 'audit', '--json'] : ['audit', '--json'];
    const result = childProcess.spawnSync(command, args, {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
        shell: !npmExecPath && process.platform === 'win32'
    });

    if (result.error) {
        throw result.error;
    }

    let audit;
    try {
        audit = JSON.parse((result.stdout || '').replace(/^\uFEFF/, ''));
    } catch (error) {
        throw new Error(`npm audit did not return valid JSON: ${error.message}\n${result.stderr || ''}`);
    }

    if (audit.error) {
        throw new Error(`npm audit failed: ${audit.error.summary || JSON.stringify(audit.error)}`);
    }

    const lockfile = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8'));
    const evaluation = evaluateAudit(audit, lockfile);

    if (evaluation.allowedPackages.length > 0) {
        console.warn(
            `Temporarily allowed development-only advisory chain: ${evaluation.allowedPackages.join(', ')}`
        );
        for (const url of evaluation.allowedAdvisories) {
            const allowance = ALLOWED_DEV_ADVISORIES.get(url);
            console.warn(`- ${url} (expires after ${allowance.expiresAfter}: ${allowance.reason})`);
        }
    }

    if (evaluation.blocked.length > 0) {
        console.error('Blocking high or critical dependency vulnerabilities:');
        for (const vulnerability of evaluation.blocked) {
            console.error(`- ${vulnerability.name} (${vulnerability.severity})`);
        }
        process.exitCode = 1;
        return;
    }

    console.log('No unapproved high or critical dependency vulnerabilities found.');
}

if (require.main === module) {
    try {
        runAudit();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

module.exports = {
    ALLOWED_DEV_ADVISORIES,
    evaluateAudit,
    isAllowanceActive,
    validateAuditSchema
};
