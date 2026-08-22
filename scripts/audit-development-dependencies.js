const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const BLOCKING_SEVERITIES = new Set(["high", "critical"]);
const GHSA_PATTERN =
    /GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}/i;

function advisoryId(via) {
    const match = String(via?.url || "").match(GHSA_PATTERN);
    return match ? match[0].toUpperCase() : null;
}

function validateExceptionContext(exception, lockfile, now = new Date()) {
    if (exception.scope !== "development-only") {
        return {
            valid: false,
            reason: `${exception.id}: scope must be development-only`,
        };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.expiresOn || "")) {
        return {
            valid: false,
            reason: `${exception.id}: expiresOn must use YYYY-MM-DD`,
        };
    }
    const expiresAt = new Date(`${exception.expiresOn}T23:59:59.999Z`);
    if (Number.isNaN(expiresAt.getTime()) || now > expiresAt) {
        return {
            valid: false,
            reason: `${exception.id}: exception expired on ${exception.expiresOn}`,
        };
    }

    const dependencyPath = exception.dependencyPath || [];
    if (
        dependencyPath.length < 2 ||
        dependencyPath.at(-1) !== exception.package
    ) {
        return {
            valid: false,
            reason: `${exception.id}: dependencyPath must end at ${exception.package}`,
        };
    }

    const packages = lockfile.packages || {};
    const root = packages[""] || {};
    if (!Object.hasOwn(root.devDependencies || {}, dependencyPath[0])) {
        return {
            valid: false,
            reason: `${exception.id}: ${dependencyPath[0]} is not a direct development dependency`,
        };
    }
    if (Object.hasOwn(root.dependencies || {}, dependencyPath[0])) {
        return {
            valid: false,
            reason: `${exception.id}: ${dependencyPath[0]} is also a runtime dependency`,
        };
    }

    for (let index = 0; index < dependencyPath.length; index += 1) {
        const name = dependencyPath[index];
        const node = packages[`node_modules/${name}`];
        if (!node || node.dev !== true) {
            return {
                valid: false,
                reason: `${exception.id}: ${name} is missing or is not development-only`,
            };
        }
        const next = dependencyPath[index + 1];
        if (next && !Object.hasOwn(node.dependencies || {}, next)) {
            return {
                valid: false,
                reason: `${exception.id}: ${name} does not depend on ${next}`,
            };
        }
    }

    const target = packages[exception.node];
    if (
        !target ||
        target.version !== exception.version ||
        target.dev !== true
    ) {
        return {
            valid: false,
            reason: `${exception.id}: expected development-only ${exception.package}@${exception.version} at ${exception.node}`,
        };
    }

    return { valid: true };
}

function exceptionAllows(
    name,
    vulnerabilities,
    exception,
    visiting = new Set(),
) {
    const pathIndex = exception.dependencyPath.indexOf(name);
    if (pathIndex === -1 || visiting.has(name)) return false;
    const vulnerability = vulnerabilities[name];
    if (
        !vulnerability ||
        !Array.isArray(vulnerability.via) ||
        vulnerability.via.length === 0
    )
        return false;

    const expectedNode = `node_modules/${name}`;
    if (
        !Array.isArray(vulnerability.nodes) ||
        vulnerability.nodes.some((node) => node !== expectedNode)
    )
        return false;

    const nextVisiting = new Set(visiting).add(name);
    const allowedAdvisories = new Set(
        exception.advisories.map((value) => value.toUpperCase()),
    );
    return vulnerability.via.every((via) => {
        if (typeof via === "string") {
            const expectedNext = exception.dependencyPath[pathIndex + 1];
            return (
                via === expectedNext &&
                exceptionAllows(via, vulnerabilities, exception, nextVisiting)
            );
        }
        const id = advisoryId(via);
        const isTarget =
            pathIndex === exception.dependencyPath.length - 1 &&
            name === exception.package;
        return isTarget && id !== null && allowedAdvisories.has(id);
    });
}

function evaluateAudit(report, policy, lockfile, now = new Date()) {
    if (
        report.auditReportVersion !== 2 ||
        typeof report.vulnerabilities !== "object"
    ) {
        return {
            allowed: [],
            blocked: ["npm audit returned an unsupported report format"],
        };
    }
    if (policy.schemaVersion !== 1 || !Array.isArray(policy.exceptions)) {
        return {
            allowed: [],
            blocked: ["dependency audit exception policy is invalid"],
        };
    }

    const blocking = Object.entries(report.vulnerabilities)
        .filter(([, vulnerability]) =>
            BLOCKING_SEVERITIES.has(vulnerability.severity),
        )
        .map(([name]) => name);
    const contexts = policy.exceptions.map((exception) => ({
        exception,
        context: validateExceptionContext(exception, lockfile, now),
    }));
    const allowed = [];
    const blocked = [];

    for (const name of blocking) {
        const match = contexts.find(
            ({ exception, context }) =>
                context.valid &&
                exceptionAllows(name, report.vulnerabilities, exception),
        );
        if (match) {
            allowed.push({ name, exception: match.exception });
        } else {
            const relevantInvalid = contexts.find(({ exception }) =>
                exception.dependencyPath?.includes(name),
            );
            blocked.push(
                relevantInvalid?.context.reason ||
                    `${name}: unreviewed high or critical vulnerability`,
            );
        }
    }

    return { allowed, blocked };
}

function runAudit(rootDir = path.resolve(__dirname, "..")) {
    const npmCli = process.env.npm_execpath;
    if (!npmCli) {
        console.error(
            "npm_execpath is unavailable; run this check through npm run audit:high.",
        );
        return 2;
    }
    const result = childProcess.spawnSync(
        process.execPath,
        [npmCli, "audit", "--json", "--audit-level=high"],
        { cwd: rootDir, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
    );
    if (result.error) {
        console.error(result.error.message);
        return 2;
    }

    let report;
    try {
        report = JSON.parse(result.stdout);
    } catch {
        if (result.stderr) process.stderr.write(result.stderr);
        console.error("npm audit did not return valid JSON.");
        return 2;
    }

    const policy = JSON.parse(
        fs.readFileSync(
            path.join(rootDir, ".github", "dependency-audit-exceptions.json"),
            "utf8",
        ),
    );
    const lockfile = JSON.parse(
        fs.readFileSync(path.join(rootDir, "package-lock.json"), "utf8"),
    );
    const decision = evaluateAudit(report, policy, lockfile);
    if (decision.blocked.length > 0) {
        console.error("Dependency audit failed:");
        for (const reason of decision.blocked) console.error(`- ${reason}`);
        return 1;
    }

    if (decision.allowed.length === 0) {
        console.log(
            "Dependency audit found no high or critical vulnerabilities.",
        );
        return 0;
    }

    const exceptions = [
        ...new Map(
            decision.allowed.map((item) => [item.exception.id, item.exception]),
        ).values(),
    ];
    console.warn(
        "Dependency audit passed with reviewed, temporary development-only exceptions:",
    );
    for (const exception of exceptions) {
        console.warn(
            `- ${exception.package}@${exception.version}: ${exception.advisories.join(", ")} ` +
                `(path ${exception.dependencyPath.join(" > ")}, expires ${exception.expiresOn})`,
        );
    }
    console.warn(
        "All other high and critical dependency findings remain blocking.",
    );
    return 0;
}

if (require.main === module) {
    process.exitCode = runAudit();
}

module.exports = {
    advisoryId,
    evaluateAudit,
    exceptionAllows,
    validateExceptionContext,
};
