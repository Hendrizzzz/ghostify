// Generic assertion helpers shared by the extension package validator.
// Every helper throws through fail() so the CLI exits on the first error.

function fail(message) {
    throw new Error(message);
}

function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
            .join(",")}}`;
    }
    return JSON.stringify(value);
}

function assertStringArray(value, label) {
    if (!Array.isArray(value)) fail(`${label} must be an array`);
    for (const [index, item] of value.entries()) {
        if (!item || typeof item !== "string")
            fail(`${label}[${index}] must be a non-empty string`);
    }
}

function duplicateStrings(values) {
    const seen = new Set();
    const duplicates = new Set();
    for (const value of values) {
        if (seen.has(value)) duplicates.add(value);
        seen.add(value);
    }
    return [...duplicates];
}

function assertExactStringSet(actual, expected, label) {
    assertStringArray(actual, label);
    const duplicates = duplicateStrings(actual);
    if (duplicates.length) fail(`Duplicate ${label}: ${duplicates.join(", ")}`);

    const actualSet = new Set(actual);
    const expectedSet = new Set(expected);
    const unexpected = actual.filter((value) => !expectedSet.has(value));
    const missing = expected.filter((value) => !actualSet.has(value));

    if (unexpected.length)
        fail(`Unexpected ${label}: ${unexpected.join(", ")}`);
    if (missing.length) fail(`Missing ${label}: ${missing.join(", ")}`);
}

function assertEqual(actual, expected, label) {
    if (actual !== expected)
        fail(`${label} must be ${JSON.stringify(expected)}`);
}

function assertBoolean(actual, expected, label) {
    if (actual !== expected) fail(`${label} must be ${expected}`);
}

function assertEnum(actual, allowed, label) {
    if (!allowed.includes(actual)) {
        fail(`${label} must be one of ${allowed.join(", ")}`);
    }
}

function assertObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        fail(`${label} must be an object`);
    }
}

function assertNullableIsoDate(value, label) {
    if (value === null) return;
    assertIsoDate(value, label);
}

function assertIsoDate(value, label) {
    if (typeof value !== "string") fail(`${label} must be an ISO date string`);
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) {
        const [, year, month, day] = dateOnly;
        const parsed = new Date(
            Date.UTC(Number(year), Number(month) - 1, Number(day)),
        );
        if (
            parsed.getUTCFullYear() === Number(year) &&
            parsed.getUTCMonth() === Number(month) - 1 &&
            parsed.getUTCDate() === Number(day)
        )
            return;
        fail(`${label} must be an ISO date string`);
    }
    const timestamp = new Date(value);
    if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) ||
        Number.isNaN(timestamp.getTime()) ||
        timestamp.toISOString().replace(".000Z", "Z") !== value
    ) {
        fail(`${label} must be an ISO date string`);
    }
}

function assertHttpsUrl(value, label) {
    if (typeof value !== "string" || !value.startsWith("https://")) {
        fail(`${label} must be an HTTPS URL`);
    }
}

function assertNullableHttpsUrl(value, label) {
    if (value === null) return;
    assertHttpsUrl(value, label);
}

function assertOnlyKeys(value, allowedKeys, label) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        fail(`${label} must be an object`);
    for (const key of Object.keys(value)) {
        if (!allowedKeys.includes(key))
            fail(`Unexpected ${label} field: ${key}`);
    }
}

module.exports = {
    assertBoolean,
    assertEnum,
    assertEqual,
    assertExactStringSet,
    assertHttpsUrl,
    assertIsoDate,
    assertNullableHttpsUrl,
    assertNullableIsoDate,
    assertObject,
    assertOnlyKeys,
    assertStringArray,
    fail,
    stableJson,
};
