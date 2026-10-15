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
    ["2026-09-28", "default"],
    ["2026-09-29", "halloween"],
    ["2026-10-15", "halloween"],
    ["2026-11-04", "halloween"],
    ["2026-11-05", "default"],
    ["2026-11-28", "default"],
    ["2026-11-29", "christmas"],
    ["2026-12-15", "christmas"],
    ["2026-12-27", "christmas"],
    ["2026-12-28", "newyear"],
    ["2026-12-31", "newyear"],
    ["2027-01-01", "newyear"],
    ["2027-01-31", "newyear"],
    ["2027-02-01", "default"],
    ["2027-02-07", "default"],
    ["2027-02-08", "valentine"],
    ["2027-02-15", "valentine"],
    ["2027-02-16", "default"],
    ["2027-06-15", "default"],
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
for (const play of [
    "playChristmasSound",
    "playNewYearSound",
    "playValentineSound",
]) {
    for (const [kind, mood] of [
        ["on", { ratio: 1 / 6, count: 1 }],
        ["on", { ratio: 5 / 6, count: 5 }],
        ["on", { ratio: 1, count: 6, vanished: true }],
        ["off", { ratio: 0.5, count: 3 }],
        ["off", { ratio: 5 / 6, count: 5, reappeared: true }],
        ["tap", {}],
    ]) {
        vm.runInContext("audioContext = __fake;", context);
        assert.doesNotThrow(
            () => context[play](kind, mood),
            `${play} ${kind} sound should run`,
        );
    }
}

// Christmas and New Year get the same scene-plus-story treatment as Halloween.
assert(
    popupHtml.includes('class="xm-tree"') &&
        popupHtml.includes('class="xm-cap"') &&
        popupHtml.includes('class="xm-gifts"') &&
        (popupHtml.match(/class="xm-orn"/g) || []).length === 6 &&
        popupCss.includes(".xm-orn.is-lit") &&
        popupCss.includes('html[data-complete="true"] .xm-star') &&
        popupJs.includes("xm-orn"),
    "Christmas should light one tree ornament per enabled switch and the star at all six",
);
assert(
    popupHtml.includes('class="ny-clock"') &&
        popupHtml.includes('class="ny-year"') &&
        popupCss.includes(".ny-hand--m") &&
        popupCss.includes("var(--on-ratio, 0) - 1") &&
        popupCss.includes('html[data-complete="true"] .ny-face') &&
        popupJs.includes("ny-year") &&
        popupJs.includes("function celebrate"),
    "New Year should run a countdown clock to midnight and celebrate at all six",
);

// Each season is recognisable at first glance, built on the ghost.
assert(
    popupHtml.includes('class="xm-garland"') &&
        popupHtml.includes('class="xm-hat"') &&
        popupCss.includes("--ghost-pine"),
    "Christmas should hang a pine garland and put a Santa hat on the ghost",
);
assert(
    popupHtml.includes('class="ny-bunting"') &&
        popupHtml.includes('class="ny-hat"') &&
        popupHtml.includes('class="ny-glasses"') &&
        popupHtml.includes('class="ny-year"'),
    "New Year should string bunting, put a party hat on the ghost and show the year",
);
assert(
    popupHtml.includes('class="vl-bunting"') &&
        popupHtml.includes('class="vl-face"') &&
        popupHtml.includes('class="vl-envelope"') &&
        (popupHtml.match(/class="vl-h"/g) || []).length === 6 &&
        popupCss.includes('html[data-complete="true"] .vl-eyes') &&
        popupJs.includes("vl-h"),
    "Valentine's should hang heart bunting, blush the ghost and fill six hearts with heart-eyes at all six",
);
assert(
    popupJs.includes("function buildSeasonLayer") &&
        popupJs.includes("function seasonFlourish") &&
        popupJs.includes("FLOURISH_STORAGE_KEY") &&
        popupCss.includes(".season-layer") &&
        popupCss.includes(".fl-piece"),
    "Seasonal themes should drift snow, confetti or hearts and open with a once-a-day shower",
);
assert(
    popupCss.includes("--ghost-gold") &&
        popupCss.includes("--ny-rose") &&
        !/html\[data-theme="[a-z]+"\] \{[^}]*--status-/.test(popupCss),
    "Seasonal palettes extend the token ramp without touching status colors",
);

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
