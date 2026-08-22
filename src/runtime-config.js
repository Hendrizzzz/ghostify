const MAX_PATTERNS_PER_FEATURE = 50;
const MAX_PATTERN_LENGTH = 96;
const UNSUPPORTED_PATTERN_META = /[|^$()[\]{}+?\\]/;

export function normalizePackagedConfig(config, fallbackConfig) {
    if (!config || typeof config !== "object" || Array.isArray(config))
        return null;
    if (!fallbackConfig || config.version !== fallbackConfig.version)
        return null;
    if (
        !config.patterns ||
        typeof config.patterns !== "object" ||
        Array.isArray(config.patterns)
    )
        return null;

    const patternKeys = Object.keys(fallbackConfig.patterns || {});
    if (!patternKeys.length) return null;

    const patterns = {};
    for (const key of patternKeys) {
        if (!Array.isArray(config.patterns[key])) return null;
        patterns[key] = config.patterns[key]
            .filter((pattern) => typeof pattern === "string")
            .map((pattern) => pattern.trim())
            .filter(
                (pattern) => pattern && pattern.length <= MAX_PATTERN_LENGTH,
            )
            .filter((pattern) => !UNSUPPORTED_PATTERN_META.test(pattern))
            .slice(0, MAX_PATTERNS_PER_FEATURE);
    }

    const allowedFeatures = new Set(patternKeys);
    const killSwitch = Array.isArray(config.killSwitch)
        ? [
              ...new Set(
                  config.killSwitch.filter((feature) =>
                      allowedFeatures.has(feature),
                  ),
              ),
          ]
        : [];

    return {
        version: config.version,
        killSwitch,
        patterns,
    };
}
