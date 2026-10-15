const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

const popupSource = fs.readFileSync("dist/js/popup.js", "utf8");
const popupCss = fs.readFileSync("dist/css/popup.css", "utf8");
const popupHtml = fs.readFileSync("dist/popup.html", "utf8");
const popupJs = popupSource;

const context = {
    document: { addEventListener() {} },
    window: null,
};
context.window = context;
vm.runInNewContext(popupSource, context, { filename: "popup.js" });

const cases = [
    ["2026-01-15", "default"],
    ["2026-02-09", "default"],
    ["2026-02-10", "valentine"],
    ["2026-02-15", "valentine"],
    ["2026-02-16", "default"],
    ["2026-09-30", "default"],
    ["2026-10-01", "halloween"],
    ["2026-10-15", "halloween"],
    ["2026-11-01", "halloween"],
    ["2026-11-02", "default"],
    ["2026-12-14", "default"],
    ["2026-12-15", "christmas"],
    ["2026-12-26", "christmas"],
    ["2026-12-27", "newyear"],
    ["2027-01-03", "newyear"],
    ["2027-01-04", "default"],
];

for (const [iso, expected] of cases) {
    const [year, month, day] = iso.split("-").map(Number);
    assert.strictEqual(
        context.getSeasonalTheme(new Date(year, month - 1, day)),
        expected,
        `${iso} should use the ${expected} theme`,
    );
}

for (const theme of ["halloween", "christmas", "newyear", "valentine"]) {
    assert(
        popupCss.includes(`html[data-theme="${theme}"] {`) &&
            popupCss.includes(
                `.season-${theme === "newyear" ? "newyear" : theme}`,
            ) &&
            popupHtml.includes(`season-mark season-${theme}`),
        `${theme} theme should have tokens and a header mark`,
    );
}

for (const theme of ["halloween", "christmas", "newyear", "valentine"]) {
    const symbols = context.getThemeFxSymbols(theme);
    assert(symbols.length > 0, `${theme} should define toggle particles`);
    for (const symbol of symbols) {
        assert(
            popupHtml.includes(`id="${symbol}"`),
            `${symbol} should exist in the popup icon sprite`,
        );
    }
}
assert.strictEqual(
    context.getThemeFxSymbols("default").length,
    0,
    "The default theme should have no particle effects",
);
assert(
    popupCss.includes("prefers-reduced-motion") &&
        popupCss.includes(".fx-particle") &&
        popupCss.includes(".ambient-fx"),
    "Seasonal effects should be disabled under reduced motion",
);
assert(
    popupHtml.includes('class="hw-moon"') &&
        popupCss.includes("--on-ratio") &&
        popupJs.includes("--on-ratio") &&
        popupJs.includes("countEnabled"),
    "Halloween story should tie the moon, night depth and ghost fade to the switch ratio",
);
assert(
    popupCss.includes('.platform[data-state="all"] .hw-peek'),
    "Peeking ghosts should disappear once a platform is fully hidden",
);

// Smoke-test every Halloween sound path against a fake Web Audio graph, and
// keep it quiet: no single voice may ever ramp above a whisper.
let loudestVoice = 0;
function fakeParam() {
    return {
        value: 0,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
    };
}
function fakeGainParam() {
    return {
        value: 0,
        setValueAtTime() {},
        exponentialRampToValueAtTime(level) {
            loudestVoice = Math.max(loudestVoice, level);
        },
    };
}
function fakeNode() {
    return {
        frequency: fakeParam(),
        gain: fakeGainParam(),
        Q: fakeParam(),
        connect() {},
        start() {},
        stop() {},
    };
}
const fakeAudio = {
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    createGain: fakeNode,
    createOscillator: fakeNode,
    createBiquadFilter: fakeNode,
    createConvolver: fakeNode,
    createBuffer: (channels, length) => ({
        getChannelData: () => new Float32Array(length),
    }),
    createBufferSource: fakeNode,
};
vm.runInContext("var __fake = null;", context);
context.__fake = fakeAudio;
for (const [kind, mood] of [
    ["on", { ratio: 0.5 }],
    ["on", { ratio: 1, vanished: true }],
    ["off", {}],
    ["off", { reappeared: true }],
    ["tap", {}],
]) {
    vm.runInContext("audioContext = __fake;", context);
    assert.doesNotThrow(
        () => context.playSpookySound(kind, mood),
        `Halloween ${kind} sound should run${mood.vanished ? " (bell)" : ""}${mood.reappeared ? " (breath in)" : ""}`,
    );
}
assert(
    loudestVoice > 0 && loudestVoice <= 0.08,
    `Halloween sounds should stay quiet (loudest voice ${loudestVoice})`,
);

const themeCss = popupCss.slice(popupCss.indexOf("/* ── Seasonal themes"));
assert(
    !/--status-/.test(themeCss),
    "Seasonal themes must never override verification status colors",
);

console.log("popup seasonal theme tests passed");
