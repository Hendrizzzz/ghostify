const assert = require('assert');
const { loadSrcModule } = require('./helpers/load-src-module');

const { normalizePackagedConfig } = loadSrcModule('src/runtime-config.js');

const fallbackConfig = {
    version: '9.9.9',
    patterns: {
        igSeen: ['mark_seen'],
        msgSeen: ['mark_read']
    }
};

assert.strictEqual(normalizePackagedConfig(null, fallbackConfig), null);
assert.strictEqual(normalizePackagedConfig([], fallbackConfig), null);
assert.strictEqual(normalizePackagedConfig({ version: '9.9.8', patterns: {} }, fallbackConfig), null);
assert.strictEqual(normalizePackagedConfig({ version: '9.9.9' }, fallbackConfig), null);
assert.strictEqual(
    normalizePackagedConfig({ version: '9.9.9', patterns: { igSeen: [] } }, fallbackConfig),
    null,
    'every known pattern key must be present as an array'
);

const normalized = normalizePackagedConfig({
    version: '9.9.9',
    killSwitch: ['msgSeen', 'unknown', 'msgSeen', 42],
    patterns: {
        igSeen: [' mark_seen ', '', 42, 'a'.repeat(97), 'unsafe(pattern)'],
        msgSeen: Array.from({ length: 55 }, (_, index) => `pattern_${index}`),
        unknown: ['ignored']
    }
}, fallbackConfig);

assert.deepStrictEqual(normalized.killSwitch, ['msgSeen']);
assert.deepStrictEqual(normalized.patterns.igSeen, ['mark_seen']);
assert.strictEqual(normalized.patterns.msgSeen.length, 50);
assert.strictEqual(Object.prototype.hasOwnProperty.call(normalized.patterns, 'unknown'), false);

console.log('runtime configuration validation tests passed');
