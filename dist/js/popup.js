const DEFAULT_SETTINGS = {
    igTyping: true,
    igSeen: true,
    igStory: true,
    msgTyping: true,
    msgSeen: true,
    msgStory: true
};

const SETTING_INPUT_IDS = {
    igTyping: 'ig-typing',
    igSeen: 'ig-seen',
    igStory: 'ig-story',
    msgTyping: 'msg-typing',
    msgSeen: 'msg-seen',
    msgStory: 'msg-story'
};

const PUBLIC_STATUS_FEED_URL = 'https://ghostify-extension.vercel.app/status.json';
const PUBLIC_STATUS_TIMEOUT_MS = 4000;
const EDGE_ADDONS_LISTING_URL = 'https://microsoftedge.microsoft.com/addons/detail/mgbppdkolkeelimnemlbpmfdddhoeeal';
const EDGE_USER_AGENT_PATTERN = /\bEdg(?:A|iOS)?\//;

const PUBLIC_STATUS_VERIFIED = new Set([
    'maintainer_verified',
    'community_verified_reviewed'
]);

// Interface sound is opt-in and stays off until the user turns it on. The
// preference lives under its own key so the privacy settings schema is untouched.
const SOUND_STORAGE_KEY = 'ghostifyPopupSound';
let soundEnabled = false;
let audioContext = null;

function playTone(kind, mood = {}) {
    if (!soundEnabled) return;
    try {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return;
        audioContext = audioContext || new AudioCtor();
        if (audioContext.state === 'suspended') audioContext.resume();

        const theme = document.documentElement.dataset.theme;
        if (theme === 'halloween') {
            playSpookySound(kind, mood);
        } else if (theme === 'christmas') {
            playChristmasSound(kind, mood);
        } else if (theme === 'newyear') {
            playNewYearSound(kind, mood);
        } else if (theme === 'valentine') {
            playValentineSound(kind, mood);
        } else {
            playSoftTick(kind);
        }
    } catch (e) {
        // Sound is a nicety; never let it affect the controls.
    }
}

function playSoftTick(kind) {
    const start = kind === 'on' ? 620 : kind === 'off' ? 520 : 700;
    const end = kind === 'on' ? start * 1.3 : kind === 'off' ? start * 0.75 : start;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + 0.07);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
}

// Halloween sound is meant to be felt more than heard: a breath, a low hollow
// note and a room it all sits in. Soft attacks, nothing above a whisper, no
// stings or shrieks. "On" exhales and sinks a little deeper the more switches
// are on; "off" is a short breath out. Hiding the last one rings a single
// distant bell (the ghost has vanished); showing one again is a breath in.
// All synthesized, no audio files.
let spaceCache = null;

function getSpace(ctx) {
    if (spaceCache && spaceCache.ctx === ctx) return spaceCache;
    const master = ctx.createBiquadFilter();
    master.type = 'lowpass';
    master.frequency.value = 4800;
    master.connect(ctx.destination);

    // A synthetic room: stereo noise that decays and darkens over 1.6 seconds.
    const length = Math.floor(ctx.sampleRate * 1.6);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        let smoothed = 0;
        for (let i = 0; i < length; i++) {
            const progress = i / length;
            smoothed += ((Math.random() * 2 - 1) - smoothed) * (0.55 - 0.45 * progress);
            data[i] = smoothed * Math.pow(1 - progress, 2.6);
        }
    }
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse;
    reverb.connect(master);

    spaceCache = { ctx, master, reverb };
    return spaceCache;
}

function route(ctx, node, wetAmount) {
    const space = getSpace(ctx);
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    wet.gain.value = wetAmount;
    node.connect(dry);
    node.connect(wet);
    dry.connect(space.master);
    wet.connect(space.reverb);
}

function breath(ctx, start, fromHz, toHz, peak, attack, duration, wetAmount) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(fromHz, start);
    filter.frequency.exponentialRampToValueAtTime(toHz, start + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    route(ctx, gain, wetAmount);
    source.start(start);
    source.stop(start + duration);
}

function hollowTone(ctx, start, freq, peak, decay, wetAmount, endFreq) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, start);
    if (endFreq) oscillator.frequency.exponentialRampToValueAtTime(endFreq, start + decay);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    oscillator.connect(gain);
    route(ctx, gain, wetAmount);
    oscillator.start(start);
    oscillator.stop(start + decay + 0.05);
}

function playSpookySound(kind, mood = {}) {
    const ctx = audioContext;
    const now = ctx.currentTime;
    const depth = 1 - 0.18 * (mood.ratio || 0);

    if (kind === 'on' && mood.vanished) {
        // One distant bell. Inharmonic partials are what make it a bell.
        [[98, 0.07], [270.5, 0.035], [529, 0.016]].forEach(([freq, level]) => {
            hollowTone(ctx, now, freq, level, 1.6, 0.8);
        });
        breath(ctx, now, 380, 900, 0.03, 0.12, 0.5, 0.7);
    } else if (kind === 'off' && mood.reappeared) {
        breath(ctx, now, 380, 1100, 0.045, 0.16, 0.42, 0.6);
    } else if (kind === 'on') {
        breath(ctx, now, 420, 980, 0.07, 0.09, 0.36, 0.55);
        hollowTone(ctx, now, 98 * depth, 0.05, 0.42, 0.55);
        hollowTone(ctx, now, 196 * depth, 0.018, 0.3, 0.55);
    } else if (kind === 'off') {
        breath(ctx, now, 980, 380, 0.05, 0.05, 0.28, 0.5);
    } else {
        // A soft knock on old wood.
        hollowTone(ctx, now, 190, 0.06, 0.1, 0.3, 120);
        breath(ctx, now, 2200, 1500, 0.012, 0.01, 0.05, 0.3);
    }
}

// Christmas: music-box notes. Each switch you turn on plays the next note of a
// rising pentatonic line, and the sixth resolves into a soft chord as the star
// lights. Turning one off steps back down. Taps are a tiny bell tick.
function bellNote(ctx, start, freq, peak, decay, wetAmount) {
    // Harmonic partials of decreasing level and shorter life: a music box.
    [[1, 1, 1], [2, 0.4, 0.6], [3, 0.18, 0.4], [4.2, 0.07, 0.3]].forEach(([multiple, level, life]) => {
        hollowTone(ctx, start, freq * multiple, peak * level, decay * life, wetAmount);
    });
}

const CHRISTMAS_SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

function playChristmasSound(kind, mood = {}) {
    const ctx = audioContext;
    const now = ctx.currentTime;
    const index = Math.min(CHRISTMAS_SCALE.length - 1, Math.max(0, (mood.count || 1) - 1));

    if (kind === 'on' && mood.vanished) {
        // The star lights: a soft major chord, notes arriving a breath apart.
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            bellNote(ctx, now + i * 0.06, freq, 0.035, 1.6, 0.8);
        });
    } else if (kind === 'off' && mood.reappeared) {
        bellNote(ctx, now, 392, 0.03, 0.9, 0.7);
    } else if (kind === 'on') {
        bellNote(ctx, now, CHRISTMAS_SCALE[index], 0.05, 0.9, 0.7);
    } else if (kind === 'off') {
        const freq = CHRISTMAS_SCALE[Math.min(CHRISTMAS_SCALE.length - 1, (mood.count || 0))];
        bellNote(ctx, now, freq, 0.035, 0.6, 0.6);
        bellNote(ctx, now + 0.09, freq * 0.75, 0.022, 0.6, 0.6);
    } else {
        hollowTone(ctx, now, 1568, 0.02, 0.12, 0.6);
    }
}

// New Year: clear glass clinks that rise a little with every switch. The sixth
// strikes midnight: one low bell stroke, then a few clinks of glasses.
function glassClink(ctx, start, freq, peak, decay, wetAmount) {
    hollowTone(ctx, start, freq, peak, decay, wetAmount);
    hollowTone(ctx, start, freq * 2.76, peak * 0.4, decay * 0.55, wetAmount);
    hollowTone(ctx, start, freq * 5.4, peak * 0.15, decay * 0.3, wetAmount);
}

function playNewYearSound(kind, mood = {}) {
    const ctx = audioContext;
    const now = ctx.currentTime;

    if (kind === 'on' && mood.vanished) {
        [[196, 0.07], [540, 0.03], [1050, 0.014]].forEach(([freq, level]) => {
            hollowTone(ctx, now, freq, level, 1.8, 0.8);
        });
        [0.55, 0.7, 0.9, 1.05, 1.3].forEach((offset, i) => {
            glassClink(ctx, now + offset, 1250 + i * 230 + (i % 2) * 140, 0.02, 0.7, 0.7);
        });
    } else if (kind === 'off' && mood.reappeared) {
        // Tick, tock: the clock starts running again.
        hollowTone(ctx, now, 900, 0.03, 0.06, 0.3, 600);
        hollowTone(ctx, now + 0.22, 720, 0.026, 0.06, 0.3, 480);
    } else if (kind === 'on') {
        glassClink(ctx, now, 880 * (1 + 0.07 * ((mood.count || 1) - 1)), 0.04, 0.6, 0.6);
    } else if (kind === 'off') {
        hollowTone(ctx, now, 523, 0.03, 0.4, 0.5, 392);
    } else {
        hollowTone(ctx, now, 1760, 0.016, 0.1, 0.5);
    }
}

// Valentine's: warm plucked notes. Each switch adds the next note of a rising
// line; the sixth is a soft heartbeat, lub-dub, then a little shimmer. Turning
// one off steps down; taps are a tiny pluck.
function pluck(ctx, start, freq, peak, decay, wetAmount) {
    [[1, 1, 1], [2, 0.3, 0.5], [3, 0.1, 0.3]].forEach(([multiple, level, life]) => {
        hollowTone(ctx, start, freq * multiple, peak * level, decay * life, wetAmount);
    });
}

const VALENTINE_SCALE = [392, 493.88, 587.33, 659.25, 783.99, 987.77];

function playValentineSound(kind, mood = {}) {
    const ctx = audioContext;
    const now = ctx.currentTime;
    const index = Math.min(VALENTINE_SCALE.length - 1, Math.max(0, (mood.count || 1) - 1));

    if (kind === 'on' && mood.vanished) {
        hollowTone(ctx, now, 72, 0.075, 0.18, 0.3, 50);
        hollowTone(ctx, now + 0.19, 64, 0.06, 0.2, 0.3, 46);
        [587.33, 783.99, 987.77, 1174.66].forEach((freq, i) => {
            pluck(ctx, now + 0.5 + i * 0.09, freq, 0.03, 1.2, 0.8);
        });
    } else if (kind === 'off' && mood.reappeared) {
        pluck(ctx, now, 293.66, 0.035, 0.8, 0.7);
    } else if (kind === 'on') {
        pluck(ctx, now, VALENTINE_SCALE[index], 0.05, 0.8, 0.65);
    } else if (kind === 'off') {
        const freq = VALENTINE_SCALE[Math.min(VALENTINE_SCALE.length - 1, mood.count || 0)];
        pluck(ctx, now, freq, 0.034, 0.5, 0.6);
        pluck(ctx, now + 0.1, freq * 0.8, 0.022, 0.5, 0.6);
    } else {
        hollowTone(ctx, now, 1174.66, 0.02, 0.1, 0.5);
    }
}

function setupSoundToggle() {
    const button = document.getElementById('sound-toggle');
    if (!button) return;

    const render = () => {
        button.setAttribute('aria-pressed', String(soundEnabled));
        button.setAttribute('aria-label', soundEnabled ? 'Sound effects on' : 'Sound effects off');
    };

    chrome.storage.local.get([SOUND_STORAGE_KEY], (result) => {
        soundEnabled = result[SOUND_STORAGE_KEY] === true;
        render();
    });

    button.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        chrome.storage.local.set({ [SOUND_STORAGE_KEY]: soundEnabled });
        render();
        playTone('on');
    });
}

function pulseRow(input) {
    const row = input.closest('.row');
    if (!row) return;
    row.classList.remove('is-pulsing');
    void row.offsetWidth;
    row.classList.add('is-pulsing');
    setTimeout(() => row.classList.remove('is-pulsing'), 320);
}

// Per-theme particle sets for toggle/hover effects (symbols live in popup.html).
const THEME_FX = {
    halloween: ['fx-bat', 'fx-bat', 'fx-pumpkin', 'fx-ghost'],
    christmas: ['fx-snow', 'fx-snow', 'fx-star'],
    newyear: ['fx-spark', 'fx-spark', 'fx-ring'],
    valentine: ['fx-heart', 'fx-heart', 'fx-spark']
};

const FX_COLORS = {
    'fx-bat': 'var(--ghost-text)',
    'fx-pumpkin': 'var(--ghost-soft)',
    'fx-ghost': 'var(--ghost-text)',
    'fx-snow': 'var(--ghost-text)',
    'fx-star': 'var(--ghost-soft-light)',
    'fx-spark': 'var(--ghost-soft-light)',
    'fx-ring': 'var(--ghost-soft)',
    'fx-heart': 'var(--ghost-soft)'
};

// Symbol used for the lit/unlit counter on each platform heading.
const THEME_GLYPH = {
    halloween: 'fx-pumpkin'
};

function getThemeFxSymbols(theme) {
    return THEME_FX[theme] ? THEME_FX[theme].slice() : [];
}

function prefersReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function spawnParticles(row, originSelector, count) {
    try {
        const symbols = getThemeFxSymbols(document.documentElement.dataset.theme);
        if (!row || !symbols.length || prefersReducedMotion() || !row.animate) return;
        if (row.querySelectorAll('.fx-particle').length > 14) return;

        const origin = row.querySelector(originSelector) || row;
        const rowRect = row.getBoundingClientRect();
        const originRect = origin.getBoundingClientRect();
        const x = originRect.left - rowRect.left + originRect.width / 2;
        const y = originRect.top - rowRect.top + originRect.height / 2;

        for (let i = 0; i < count; i++) {
            const symbol = symbols[Math.floor(Math.random() * symbols.length)];
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', '#' + symbol);
            svg.appendChild(use);
            svg.setAttribute('class', 'fx-particle');
            svg.setAttribute('aria-hidden', 'true');
            svg.style.left = x + 'px';
            svg.style.top = y + 'px';
            svg.style.color = FX_COLORS[symbol] || 'currentColor';
            const size = 17 + Math.random() * 9;
            svg.style.width = size + 'px';
            svg.style.height = size + 'px';
            row.appendChild(svg);

            const dx = (Math.random() - 0.7) * 150;
            const dy = -(34 + Math.random() * 44);
            const turn = (Math.random() - 0.5) * 90;
            const animation = svg.animate([
                { transform: 'translate(-50%, -50%) scale(0.3) rotate(0deg)', opacity: 0 },
                { opacity: 1, offset: 0.2 },
                { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(1) rotate(' + turn + 'deg)', opacity: 0 }
            ], { duration: 800 + Math.random() * 500, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', delay: i * 45 });
            animation.onfinish = () => svg.remove();
        }
    } catch (e) {
        // Effects are decoration only.
    }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const SEASON_LAYER_COUNT = { christmas: 8, newyear: 8, valentine: 6 };
const FLOURISH_STORAGE_KEY = 'ghostifyFlourishDay';

function makeHeart(extraClass) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#fx-heart');
    svg.appendChild(use);
    if (extraClass) svg.setAttribute('class', extraClass);
    return svg;
}

// Snow, confetti or rising hearts drifting behind the UI. It only shows in the
// gaps because the cards sit above it. Negative delays mean it is already
// mid-air the moment the popup opens.
function buildSeasonLayer(theme) {
    const count = SEASON_LAYER_COUNT[theme];
    const shell = document.querySelector('.popup-shell');
    if (!count || !shell || prefersReducedMotion()) return;
    const layer = document.createElement('div');
    layer.className = 'season-layer';
    layer.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < count; i++) {
        const piece = theme === 'valentine' ? makeHeart() : document.createElement('span');
        const size = theme === 'newyear' ? 5 + Math.random() * 4 : theme === 'valentine' ? 9 + Math.random() * 9 : 2.5 + Math.random() * 3;
        piece.style.setProperty('--x', (3 + Math.random() * 94) + '%');
        piece.style.setProperty('--s', size + 'px');
        piece.style.setProperty('--t', (9 + Math.random() * 9) + 's');
        piece.style.setProperty('--d', (-Math.random() * 18) + 's');
        piece.style.setProperty('--drift', ((Math.random() - 0.5) * 50) + 'px');
        piece.style.setProperty('--spin', (360 + Math.random() * 540) + 'deg');
        layer.appendChild(piece);
    }
    shell.insertBefore(layer, shell.firstChild);
}

// The first time the popup opens each day: a short shower over the whole popup
// (snow and stars, confetti, or rising hearts). After that the popup stays calm.
// ?flourish=always forces it for previews.
function seasonFlourish(theme) {
    if (!SEASON_LAYER_COUNT[theme] || prefersReducedMotion()) return;
    const forced = new URLSearchParams(window.location.search).get('flourish') === 'always';
    if (forced) {
        runFlourish(theme);
        return;
    }
    const now = new Date();
    const today = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
    chrome.storage.local.get([FLOURISH_STORAGE_KEY], (result) => {
        if (result[FLOURISH_STORAGE_KEY] === today) return;
        chrome.storage.local.set({ [FLOURISH_STORAGE_KEY]: today });
        runFlourish(theme);
    });
}

function runFlourish(theme) {
    try {
        const shell = document.querySelector('.popup-shell');
        if (!shell || !shell.animate) return;
        const height = shell.offsetHeight || 420;
        const total = theme === 'newyear' ? 28 : theme === 'christmas' ? 20 : 14;
        for (let i = 0; i < total; i++) {
            let piece;
            if (theme === 'valentine') {
                piece = makeHeart('fl-piece ' + (i % 3 === 0 ? 'fl-heart--light' : 'fl-heart'));
            } else if (theme === 'christmas' && i % 5 === 0) {
                piece = makeHeart('fl-piece fl-gold');
                piece.firstChild.setAttribute('href', '#fx-star');
            } else {
                piece = document.createElement('span');
                piece.className = theme === 'newyear' ? 'fl-piece fl-conf--' + (i % 4) : 'fl-piece fl-snow';
            }
            const size = theme === 'newyear' ? 6 + Math.random() * 5 : theme === 'valentine' ? 11 + Math.random() * 10 : 3 + Math.random() * 4;
            piece.style.left = (2 + Math.random() * 96) + '%';
            piece.style.width = size + 'px';
            piece.style.height = (theme === 'newyear' ? size * 0.55 : size) + 'px';
            piece.style.opacity = '0';
            const rising = theme === 'valentine';
            if (rising) piece.style.bottom = '-16px';
            else piece.style.top = '-14px';
            const drift = (Math.random() - 0.5) * 70;
            const travel = (rising ? -1 : 1) * (height + 30);
            const spin = rising ? 0 : 200 + Math.random() * 520;
            shell.appendChild(piece);
            const animation = piece.animate([
                { opacity: 0, transform: 'translate(0, 0) rotate(0deg)' },
                { opacity: 1, offset: 0.12 },
                { opacity: 1, offset: 0.8 },
                { opacity: 0, transform: 'translate(' + drift + 'px, ' + travel + 'px) rotate(' + spin + 'deg)' }
            ], { duration: 1700 + Math.random() * 1300, delay: Math.random() * 800, easing: 'cubic-bezier(0.3, 0.55, 0.4, 1)', fill: 'both' });
            animation.onfinish = () => piece.remove();
        }
    } catch (e) {
        // Decoration only.
    }
}

// All six switches on: Christmas lights the star, New Year strikes midnight.
function celebrate() {
    const theme = document.documentElement.dataset.theme;
    const header = document.querySelector('.header');
    if (!header) return;
    if (theme === 'christmas') spawnParticles(header, '.xm-tree', 9);
    if (theme === 'newyear') spawnParticles(header, '.ny-clock', 12);
    if (theme === 'valentine') spawnParticles(header, '.vl-hearts', 10);
}

const SEASONAL_THEMES = ['halloween', 'christmas', 'newyear', 'valentine'];

// Date windows are local time and inclusive; each season starts two days early
// to absorb store review lag. Outside them the popup keeps the default look:
// Halloween Sep 29-Nov 4, Christmas Nov 29-Dec 27, New Year Dec 28-Jan 31,
// Valentine's Feb 8-15.
function getSeasonalTheme(date = new Date()) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    if (month === 2 && day >= 8 && day <= 15) return 'valentine';
    if ((month === 9 && day >= 29) || month === 10 || (month === 11 && day <= 4)) return 'halloween';
    if ((month === 11 && day >= 29) || (month === 12 && day <= 27)) return 'christmas';
    if ((month === 12 && day >= 28) || month === 1) return 'newyear';
    return 'default';
}

function applyTheme(forced) {
    try {
        const requested = forced || new URLSearchParams(window.location.search).get('theme');
        const theme = SEASONAL_THEMES.includes(requested) || requested === 'default'
            ? requested
            : getSeasonalTheme();
        if (theme !== 'default') {
            document.documentElement.dataset.theme = theme;
            buildSeasonLayer(theme);
            seasonFlourish(theme);
            const year = document.querySelector('.ny-year');
            if (year) {
                const now = new Date();
                year.textContent = String(now.getFullYear() + (now.getMonth() === 11 ? 1 : 0));
            }
            const symbols = getThemeFxSymbols(theme);
            const ambientSymbol = theme === 'halloween' ? 'fx-bat' : symbols[symbols.length - 1];
            document.querySelectorAll('.ambient-fx use').forEach(use => {
                use.setAttribute('href', '#' + ambientSymbol);
            });
        }
    } catch (e) {
        // Theming is cosmetic; fall back to the default look.
    }
}

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    loadSettings();
    attachEventListeners();
    configureStoreRatingLink();
    setupHelpMenu();
    setupSoundToggle();
    updatePublicStatusSummary();

    const manifestData = chrome.runtime.getManifest();
    const versionSpan = document.getElementById('version-number');
    if (versionSpan) {
        versionSpan.innerText = `v${manifestData.version}`;
    }
});

function configureStoreRatingLink(userAgent = navigator.userAgent) {
    const ratingLink = document.querySelector('.rate-link');
    if (!ratingLink || !EDGE_USER_AGENT_PATTERN.test(userAgent || '')) return;

    ratingLink.href = EDGE_ADDONS_LISTING_URL;
    ratingLink.setAttribute('aria-label', 'Rate Ghostify on Microsoft Edge Add-ons');
    ratingLink.dataset.tooltip = 'Enjoying Ghostify? Leave a quick rating on Microsoft Edge Add-ons.';
}


function setupHelpMenu() {
    const trigger = document.getElementById('help-trigger');
    const menu = document.getElementById('help-menu');
    const copyButton = document.getElementById('help-copy');
    if (!trigger || !menu) return;

    const setOpen = (open) => {
        menu.hidden = !open;
        trigger.setAttribute('aria-expanded', String(open));
    };

    trigger.addEventListener('click', () => {
        setOpen(menu.hidden);
        playTone('tap');
    });
    document.addEventListener('click', (event) => {
        if (!menu.hidden && !menu.contains(event.target) && !trigger.contains(event.target)) {
            setOpen(false);
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !menu.hidden) {
            setOpen(false);
            trigger.focus();
        }
    });

    if (!copyButton) return;
    const copyTitle = document.getElementById('help-copy-title');
    copyButton.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(copyButton.dataset.email);
            playTone('tap');
            if (copyTitle) copyTitle.textContent = 'Copied to clipboard';
            copyButton.classList.add('is-copied');
            setTimeout(() => {
                if (copyTitle) copyTitle.textContent = 'Copy email address';
                copyButton.classList.remove('is-copied');
            }, 1600);
        } catch (e) {
            // Clipboard can be unavailable; the address stays visible to copy by hand.
        }
    });
}

function loadSettings() {
    chrome.storage.local.get(['ghostifySettings'], (result) => {
        const settings = result.ghostifySettings || DEFAULT_SETTINGS;

        Object.entries(SETTING_INPUT_IDS).forEach(([settingKey, elementId]) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.checked = settings[settingKey];
            }
        });
        updatePlatformCounts();
    });
}

function updatePlatformCounts() {
    document.querySelectorAll('.platform').forEach(platform => {
        const countElement = platform.querySelector('.platform-count');
        if (!countElement) return;
        const inputs = platform.querySelectorAll('input[type="checkbox"]');
        const active = Array.from(inputs).filter(input => input.checked).length;
        const label = `${active} of ${inputs.length} on`;
        const changed = countElement.dataset.label && countElement.dataset.label !== label;
        countElement.dataset.label = label;
        countElement.textContent = '';

        const text = document.createElement('span');
        text.className = 'count-text';
        text.textContent = label;
        countElement.appendChild(text);

        const glyph = THEME_GLYPH[document.documentElement.dataset.theme];
        if (glyph) {
            const glyphs = document.createElement('span');
            glyphs.className = 'count-glyphs';
            glyphs.setAttribute('aria-hidden', 'true');
            inputs.forEach((input, index) => {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
                use.setAttribute('href', '#' + glyph);
                svg.appendChild(use);
                svg.setAttribute('class', 'count-glyph' + (index < active ? ' is-lit' : ''));
                glyphs.appendChild(svg);
            });
            countElement.appendChild(glyphs);
        }
        if (changed) {
            countElement.classList.remove('is-updating');
            void countElement.offsetWidth;
            countElement.classList.add('is-updating');
        }
        countElement.dataset.state = active === 0 ? 'none' : active === inputs.length ? 'all' : 'some';
        platform.dataset.state = countElement.dataset.state;
    });

    const { enabled, total } = countEnabled();
    document.documentElement.style.setProperty('--on-ratio', String(total ? enabled / total : 0));
    document.documentElement.dataset.complete = total && enabled === total ? 'true' : 'false';
    document.querySelectorAll('.xm-orn').forEach((ornament, index) => {
        ornament.classList.toggle('is-lit', index < enabled);
    });
    document.querySelectorAll('.vl-h').forEach((heart, index) => {
        heart.classList.toggle('is-lit', index < enabled);
    });
}

function countEnabled() {
    const inputs = document.querySelectorAll('input[type="checkbox"]');
    const enabled = Array.from(inputs).filter(input => input.checked).length;
    return { enabled, total: inputs.length };
}


function attachEventListeners() {
    // Most rows are one <label>; any plain <div> row should toggle on a click
    // in its padding too, so every row behaves the same.
    document.querySelectorAll('div.row').forEach(row => {
        row.addEventListener('click', (event) => {
            if (event.target.closest('label')) return;
            const input = row.querySelector('input[type="checkbox"]');
            if (input) input.click();
        });
    });

    document.querySelectorAll('.row').forEach(row => {
        let lastHover = 0;
        row.addEventListener('mouseenter', () => {
            const now = Date.now();
            if (now - lastHover < 900) return;
            lastHover = now;
            spawnParticles(row, '.feature-chip', 1);
        });
    });

    const inputs = document.querySelectorAll('input[type="checkbox"]');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            saveSettings();
            updatePlatformCounts();
            pulseRow(input);
            spawnParticles(input.closest('.row'), '.switch', input.checked ? 6 : 2);
            const { enabled, total } = countEnabled();
            playTone(input.checked ? 'on' : 'off', {
                ratio: total ? enabled / total : 0,
                count: enabled,
                vanished: input.checked && enabled === total,
                reappeared: !input.checked && enabled === total - 1
            });
            if (input.checked && enabled === total) celebrate();
        });
    });
}

function saveSettings() {
    const settings = {};

    Object.entries(SETTING_INPUT_IDS).forEach(([settingKey, elementId]) => {
        settings[settingKey] = document.getElementById(elementId)?.checked ?? DEFAULT_SETTINGS[settingKey];
    });

    chrome.storage.local.set({ ghostifySettings: settings });
}

async function updatePublicStatusSummary() {
    const summaryElement = document.getElementById('public-status-summary');
    const linkElement = document.getElementById('public-status-link');
    const tooltipElement = document.getElementById('public-status-tooltip');
    if (!summaryElement) return;

    try {
        const data = await fetchPublicStatus();
        const summary = summarizePublicStatus(data);
        const tone = getPublicStatusTone(data);
        const description = getPublicStatusDescription(data);
        summaryElement.textContent = summary;
        if (tooltipElement) tooltipElement.textContent = description;
        if (linkElement) {
            linkElement.classList.remove('is-fallback');
            linkElement.dataset.status = tone;
            linkElement.setAttribute('aria-label', buildPublicStatusAriaLabel(tone, summary));
        }
    } catch (e) {
        const summary = 'Review';
        summaryElement.textContent = summary;
        if (tooltipElement) tooltipElement.textContent = 'Public status details are temporarily unavailable.';
        if (linkElement) {
            linkElement.classList.add('is-fallback');
            linkElement.dataset.status = 'review';
            linkElement.setAttribute('aria-label', 'Open Ghostify status page. Public status feed unavailable.');
        }
    }
}

function fetchPublicStatus() {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('GET', PUBLIC_STATUS_FEED_URL, true);
        request.responseType = 'json';
        request.timeout = PUBLIC_STATUS_TIMEOUT_MS;
        request.withCredentials = false;
        request.onload = () => {
            try {
                if (request.status < 200 || request.status >= 300) {
                    throw new Error(`status ${request.status}`);
                }
                const data = request.response;
                validatePublicStatusData(data);
                resolve(data);
            } catch (error) {
                reject(error);
            }
        };
        request.onerror = () => reject(new Error('status request failed'));
        request.ontimeout = () => reject(new Error('status timeout'));
        request.send();
    });
}

function validatePublicStatusData(data) {
    if (!data || typeof data !== 'object') throw new Error('invalid status data');
    if (data.schemaVersion !== 1) throw new Error('unsupported status schema');
    if (!Array.isArray(data.entries)) throw new Error('missing status entries');
    if (data.entries.length > 32) throw new Error('status feed too large');
    if (!Array.isArray(data.history) || !data.history.length) throw new Error('missing status history');
}

function summarizePublicStatus(data) {
    const latestRecord = latestPublicStatusRecord(data.history || []);
    return formatStatusRecordDate(latestRecord) || formatLastVerifiedDate(data) || 'Review';
}

function getPublicStatusDescription(data) {
    const latestRecord = latestPublicStatusRecord(data.history || []);
    return latestRecord?.title || latestRecord?.summary || 'Open the public status page for the latest review.';
}

function getPublicStatusTone(data) {
    if (data.release?.matchesVerificationBuild === false) return 'review';
    const latestRecord = latestPublicStatusRecord(data.history || []);
    if (latestRecord && PUBLIC_STATUS_VERIFIED.has(latestRecord.publicStatus)) return 'verified';
    return 'review';
}

function latestPublicStatusRecord(history) {
    return history.find(record =>
        record?.date &&
        record?.publicStatus &&
        record.eventType !== 'release' &&
        record.eventType !== 'fix'
    ) || null;
}

function buildPublicStatusAriaLabel(tone, summary) {
    if (tone === 'verified') return `Open Ghostify status page. Verified ${summary}.`;
    return `Open Ghostify status page. Reports or review recorded ${summary}.`;
}

function formatStatusRecordDate(record) {
    if (!record?.date) return '';
    const date = new Date(record.date);
    if (Number.isNaN(date.getTime())) return '';
    return formatShortUtcDate(date);
}

function formatLastVerifiedDate(data) {
    const entries = data.entries || [];
    const verifiedDate = latestVerificationDate(entries);
    if (!verifiedDate || Number.isNaN(verifiedDate.getTime())) return '';
    return formatShortUtcDate(verifiedDate);
}

function latestVerificationDate(entries) {
    const verifiedDates = entries
        .map(entry => entry.verifiedAt ? new Date(entry.verifiedAt) : null)
        .filter(date => date && !Number.isNaN(date.getTime()))
        .sort((left, right) => right.getTime() - left.getTime());

    return verifiedDates[0] || null;
}

function formatShortUtcDate(date) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
