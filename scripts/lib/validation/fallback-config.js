// Reads the FALLBACK_CONFIG literal from src/content.js and checks that it
// stays in lockstep with dist/config/patterns.json.

const vm = require("vm");
const { fail, stableJson } = require("./assertions");

function readConstObjectLiteral(source, constName) {
    const declaration = `const ${constName}`;
    const declarationIndex = source.indexOf(declaration);
    if (declarationIndex < 0) fail(`src/content.js must declare ${constName}`);

    const braceStart = source.indexOf("{", declarationIndex);
    if (braceStart < 0)
        fail(`src/content.js ${constName} must be an object literal`);

    let depth = 0;
    let quote = null;
    let escaped = false;

    for (let index = braceStart; index < source.length; index += 1) {
        const char = source[index];

        if (quote) {
            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === quote) {
                quote = null;
            }
            continue;
        }

        if (char === '"' || char === "'" || char === "`") {
            quote = char;
            continue;
        }

        if (char === "{") depth += 1;
        if (char === "}") {
            depth -= 1;
            if (depth === 0) {
                return source.slice(braceStart, index + 1);
            }
        }
    }

    fail(`src/content.js ${constName} object literal is incomplete`);
}

function readFallbackConfig(source) {
    return vm.runInNewContext(
        `(${readConstObjectLiteral(source, "FALLBACK_CONFIG")})`,
        Object.create(null),
    );
}

function assertFallbackConfigMatchesPatterns(
    fallbackConfig,
    patterns,
    version,
) {
    if (patterns.version !== version) {
        fail(
            `dist/config/patterns.json version ${patterns.version} does not match package.json ${version}`,
        );
    }
    if (fallbackConfig.version !== version) {
        fail(
            `src/content.js fallback config version ${fallbackConfig.version || "<missing>"} does not match package.json ${version}`,
        );
    }
    if (
        stableJson(fallbackConfig.killSwitch || []) !==
        stableJson(patterns.killSwitch || [])
    ) {
        fail(
            "src/content.js fallback killSwitch does not match dist/config/patterns.json",
        );
    }
    if (
        stableJson(fallbackConfig.patterns || {}) !==
        stableJson(patterns.patterns || {})
    ) {
        fail(
            "src/content.js fallback patterns do not match dist/config/patterns.json",
        );
    }
}

module.exports = {
    assertFallbackConfigMatchesPatterns,
    readConstObjectLiteral,
    readFallbackConfig,
};
