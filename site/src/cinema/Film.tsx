import { gsap } from 'gsap';
import { Observer } from 'gsap/Observer';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { PlatformLogo, type MetaPlatform } from './PlatformLogo';
import { STATUS_DATA, formatStatusDate, getLastVerifiedAt } from '../app/statusData';
import { Clip, FOOTAGE, primeClip, runClip, type Footage } from './Clip';
import { Ghost, GhostSilhouette } from './Ghost';
import { RealPopup, type RealPopupHandle } from './RealPopup';
import { GITHUB_URL, StoreButtons, type Store } from './Shell';
import { soundPreferred, type FilmSound } from './sound';
import { Stills } from './Stills';

gsap.registerPlugin(ScrollTrigger, Observer);

/* The landing film, cut into shots. One gesture plays exactly one shot: a
   fixed-length timeline that runs on its own clock (enter, action, beat,
   hold), never scrubbed to the wheel. Each shot is composed on a fixed canvas,
   1280 × 720 for the widescreen cut and 390 × 844 for the vertical cut, and
   scaled into the screen by one unit, --u. The cut is picked by the screen's
   shape, not by device. Only transforms, opacity and clip-path animate. */

type R = readonly [x: number, y: number, w: number];

/* Where things sit, in canvas units. [widescreen, vertical]. */
const AT = {
  g0: [
    [576, 118, 128],
    [159, 128, 72],
  ],
  clear: [
    [140, -150, 1000],
    [-185, -60, 760],
  ],
  spill1: [
    [560, -110, 880],
    [-160, 40, 710],
  ],
  chat: [
    [900, 104, 300],
    [0, 0, 390],
  ],
  chatFar: [
    [720, 166, 210],
    [120, 190, 170],
  ],
  reflect: [
    [720, 488, 210],
    [120, 451, 170],
  ],
  ghost: [
    [96, 172, 300],
    [246, 514, 120],
  ],
  ghostFar: [
    [262, 262, 236],
    [24, 446, 140],
  ],
  haze: [
    [-200, 380, 640],
    [-160, 560, 460],
  ],
  seen: [
    [470, 236, 0],
    [24, 542, 0],
  ],
  seenFrom: [
    [930, 400, 0],
    [190, 450, 0],
  ],
  glow2: [
    [20, -60, 840],
    [-150, 20, 690],
  ],
  typing: [
    [150, 110, 500],
    [16, 132, 358],
  ],
  dots: [
    [720, 330, 0],
    [118, 486, 0],
  ],
  lean: [
    [1010, 230, 340],
    [226, 556, 220],
  ],
  glow3: [
    [230, -130, 960],
    [-160, -40, 710],
  ],
  fb: [
    [900, 160, 222],
    [250, 140, 150],
  ],
  ig: [
    [580, 96, 262],
    [0, 0, 390],
  ],
  peek: [
    [434, 244, 220],
    [262, 466, 160],
  ],
  glow4: [
    [560, 60, 640],
    [-40, 250, 470],
  ],
  popup: [
    [730, 100, 390],
    [88, 270, 280],
  ],
  peek4: [
    [600, 230, 190],
    [4, 370, 130],
  ],
  w0: [
    [250, 178, 169],
    [20, 300, 104],
  ],
  w1: [
    [528, 150, 224],
    [133, 268, 124],
  ],
  w2: [
    [862, 180, 168],
    [266, 300, 104],
  ],
  wGlow0: [
    [120, 100, 440],
    [-80, 200, 300],
  ],
  wGlow1: [
    [430, 60, 420],
    [40, 170, 310],
  ],
  wGlow2: [
    [740, 100, 440],
    [170, 200, 300],
  ],
  wGhost: [
    [612, 444, 56],
    [175, 418, 40],
  ],
  glow6: [
    [340, 0, 600],
    [-60, 80, 510],
  ],
} as const satisfies Record<string, readonly [R, R]>;

type Key = keyof typeof AT;

function at(key: Key, extra?: CSSProperties): CSSProperties {
  const [w, t] = AT[key];
  return {
    ...extra,
    '--x': w[0],
    '--y': w[1],
    '--w': w[2],
    '--px': t[0],
    '--py': t[1],
    '--pw': t[2],
  } as CSSProperties;
}

const WALL_ROWS = [
  'Seen 21:04 · typing… · Seen · viewed your story · ',
  'typing… · Seen 9:41 · viewed your story · Seen · ',
  'Seen · viewed your story · Seen 21:04 · typing… · ',
  'viewed your story · typing… · Seen · Seen 9:41 · ',
  'Seen 21:04 · Seen · typing… · viewed your story · ',
  'typing… · viewed your story · Seen 9:41 · Seen · ',
];
const WALL_OFFSETS = [-60, -340, -120, -420, -200, -520, -20, -280];

/* The shots, in order. `id` is the URL hash; `layer` the stage layer that
   holds the shot; `ghost` the ghost a match cut grows out of. */
export const SHOTS = [
  { id: 'wall', name: 'The wall', layer: '.s0', ghost: '.g0' },
  { id: 'cold-open', name: 'Cold open', layer: '.s1', ghost: '.s1 .ghost-in' },
  { id: 'receipt', name: 'The receipt', layer: '.s1', ghost: '.s1 .step' },
  { id: 'dots', name: 'The dots', layer: '.s2', ghost: '.s2 .lean' },
  { id: 'story', name: 'The story', layer: '.s3', ghost: '.s3 .peek' },
  { id: 'switches', name: 'The switches', layer: '.s4', ghost: '.s4 .peek4' },
  { id: 'wide', name: 'The wide', layer: '.s5', ghost: '.s5 .w-ghost' },
  { id: 'privacy', name: 'Privacy', layer: '.s7', ghost: '' },
  { id: 'end', name: 'End card', layer: '.s6', ghost: '.s6 .g6' },
] as const;
const LAST = SHOTS.length - 1;
/* Shots that run straight on from the one before, with no cut. */
const CONTINUOUS = new Set([2, 7]);
/* The rest after a shot before the next gesture is accepted (s). */
const HOLD = 0.3;
/* Trackpad momentum: a wheel stream that is still running when a shot ends
   is ignored for this long (ms). */
const COOLDOWN = 1000;
const SWITCH_COUNT = 6;

const shotFromHash = () => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id === 'install') return LAST;
  return SHOTS.findIndex((s) => s.id === id);
};

/* The ghost's outline in its 200 × 250 box, as coordinate pairs, for the
   match cut's mask. */
const OUTLINE =
  'M20 196 L20 102 C20 54 56 18 100 18 C144 18 180 54 180 102 L180 196 C180 222 173 226 160 226 C147 226 143 215 140 207 C137 215 133 222 120 222 C107 222 103 215 100 207 C97 215 93 227 80 227 C67 227 63 215 60 207 C57 215 53 223 40 223 C27 223 20 219 20 196 Z';
const PAIR = /(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g;
const ghostPath = (x: number, y: number, s: number) =>
  `path('${OUTLINE.replace(
    PAIR,
    (_, a: string, b: string) =>
      `${(x + Number(a) * s).toFixed(1)} ${(y + Number(b) * s).toFixed(1)}`,
  )}')`;

/* The wide's platform marks, each centred under its own screen: canvas x for
   [widescreen, vertical]. */
const MARKS: ReadonlyArray<readonly [MetaPlatform, string, number, number]> = [
  ['instagram', 'Instagram', 334, 72],
  ['messenger', 'Messenger', 640, 195],
  ['facebook', 'Facebook', 946, 318],
];

const ALL_WORKING = STATUS_DATA.summary.publicStatus === 'maintainer_verified';
const LAST_VERIFIED = formatStatusDate(getLastVerifiedAt());

/* A line that rises out of a mask. */
function Line({ children }: { children: ReactNode }) {
  return (
    <span className="rise">
      <span>{children}</span>
    </span>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

function Speaker() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

/* Light thrown by a screen: a tiny still of it, stretched and masked soft.
   Painted as a background so the browser never treats it as a picture. */
function Glow({ at: key, src }: { at: Key; src: string }) {
  return (
    <div
      className="glow at"
      style={at(key, { backgroundImage: `url(${src})` })}
      aria-hidden="true"
    />
  );
}

/* The wide: three real screens on a floor. `decor` is the second take used
   inside the browser window, hidden from assistive tech. */
function World({ decor = false }: { decor?: boolean }) {
  const far = (key: 'w0' | 'w1' | 'w2', f: Footage, name: string) => (
    <div className={`far ${key} at`} style={at(key)}>
      <img src={f.still} alt={decor ? '' : name} loading="lazy" />
      <img className="far-reflect" src={f.still} alt="" aria-hidden="true" loading="lazy" />
    </div>
  );
  return (
    <div className="world" aria-hidden={decor || undefined}>
      <Glow at="wGlow0" src={FOOTAGE.instagram.glow} />
      <Glow at="wGlow1" src={FOOTAGE.messenger.glow} />
      <Glow at="wGlow2" src={FOOTAGE.facebook.glow} />
      {far('w0', FOOTAGE.instagram, 'Instagram')}
      {far('w1', FOOTAGE.messenger, 'Messenger')}
      {far('w2', FOOTAGE.facebook, 'Facebook')}
      <div className="floor" aria-hidden="true" />
      <div className="w-ghost at" style={at('wGhost')}>
        <GhostSilhouette rim="top" />
      </div>
    </div>
  );
}

type Props = { stores: Store[]; sound: FilmSound; base: string };

/* Reduced motion, or a film that could not start, gets the still frames. */
export function Film(props: Props) {
  const [still, setStill] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setStill(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);

  return still ? <Stills {...props} /> : <Reel {...props} onFail={() => setStill(true)} />;
}

function Reel({ stores, sound, base, onFail }: Props & { onFail: () => void }) {
  const root = useRef<HTMLElement>(null);
  const fail = useRef(onFail);
  fail.current = onFail;
  const popup = useRef<RealPopupHandle>(null);
  const chatVideo = useRef<HTMLVideoElement>(null);
  const igVideo = useRef<HTMLVideoElement>(null);
  const spill1 = useRef<HTMLCanvasElement>(null);
  const spill3 = useRef<HTMLCanvasElement>(null);
  /* Set by the effect: lets the controls drive the director. */
  const api = useRef<{ start: () => void; jump: (i: number) => void; skip: () => void }>(null);

  useEffect(() => {
    const el = root.current!;
    const stage = el.querySelector<HTMLElement>('.film-stage')!;
    const rim = el.querySelector<HTMLElement>('.cut-rim')!;
    const q = gsap.utils.selector(el);
    const ticks = q('.tick') as HTMLAnchorElement[];
    let U = 1;
    let tall = false;

    const measure = () => {
      tall = !matchMedia('(min-aspect-ratio: 1/1)').matches;
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      U = tall ? Math.min(w / 390, h / 844) : Math.min(w / 1280, h / 720);
      el.style.setProperty('--uk', String(U));
    };

    // Start each light spill from a still of its footage.
    const seed = (c: HTMLCanvasElement | null, src: string) => {
      const img = new Image();
      img.onload = () => c?.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      img.src = src;
    };

    /* The pointer: wipes receipts off the wall, leans the popup, and the
       lit ghosts' eyes follow it. One rAF, transforms and two variables. */
    const wipe = el.querySelector<HTMLElement>('.wipe');
    const tilt = el.querySelector<HTMLElement>('.tilt');
    const eyes = q('.ghost.eyes-follow') as HTMLElement[];
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, nx: 0, ny: 0 };
    let praf = 0;
    const steer = () => {
      praf = 0;
      pointer.x += (pointer.tx - pointer.x) * 0.35;
      pointer.y += (pointer.ty - pointer.y) * 0.35;
      if (wipe) wipe.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
      const gx = pointer.nx.toFixed(2);
      const gy = pointer.ny.toFixed(2);
      eyes.forEach((g) => {
        g.style.setProperty('--gx', gx);
        g.style.setProperty('--gy', gy);
      });
      tilt?.style.setProperty('--lx', gx);
      tilt?.style.setProperty('--ly', gy);
      if (Math.abs(pointer.tx - pointer.x) + Math.abs(pointer.ty - pointer.y) > 0.5) {
        praf = requestAnimationFrame(steer);
      }
    };
    const onPoint = (x: number, y: number) => {
      const r = stage.getBoundingClientRect();
      if (pointer.x < -9000) {
        pointer.x = x - r.left;
        pointer.y = y - r.top;
      }
      pointer.tx = x - r.left;
      pointer.ty = y - r.top;
      pointer.nx = Math.max(-1, Math.min(1, (x - r.left) / r.width - 0.5) * 2);
      pointer.ny = Math.max(-1, Math.min(1, (y - r.top) / r.height - 0.5) * 2);
      if (!praf) praf = requestAnimationFrame(steer);
    };
    const onMove = (e: PointerEvent) => onPoint(e.clientX, e.clientY);

    /* The first sign of a visitor (a pointer, a key, a touch, a wheel) starts
       fetching the cold open's footage, ahead of the press that plays it. */
    const INTENT = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel'] as const;
    const intent = () => {
      INTENT.forEach((t) => removeEventListener(t, intent, true));
      primeClip(chatVideo.current);
    };

    /* ---------- The shots ---------- */

    const T = (k: Key) => AT[k][tall ? 1 : 0];
    /* A resting place expressed as a transform away from another one. */
    const from = (rest: Key, there: Key) => ({
      x: (T(there)[0] - T(rest)[0]) * U,
      y: (T(there)[1] - T(rest)[1]) * U,
      scale: T(rest)[2] ? T(there)[2] / T(rest)[2] : 0.3,
    });
    const px = (n: number) => n * U;
    type TL = gsap.core.Timeline;

    /* The line rises out of its mask. */
    const rise = (tl: TL, sel: string, at: number, stagger = 0.1) =>
      tl.fromTo(
        q(sel),
        { yPercent: 118, autoAlpha: 1 },
        { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger },
        at,
      );
    const bars = (tl: TL, open: boolean) =>
      tl.to(
        q('.bar-top, .bar-bottom'),
        {
          yPercent: (i: number) => (open ? (i ? 100 : -100) : 0),
          duration: 0.8,
          ease: 'power3.inOut',
        },
        0,
      );
    const subtitle = (tl: TL, layer: string, at = 0.45) => {
      tl.fromTo(q(`${layer} .scrim`), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, at - 0.2);
      rise(tl, `${layer} .sub .rise > span`, at);
    };
    const cue = (tl: TL, fn: () => void, at: number) => tl.call(fn, undefined, at);

    const SHOT: Array<(tl: TL) => void> = [
      /* The wall. The receipts settle, the lit ghost, the line, the stores. */
      (tl) => {
        bars(tl, true);
        // The receipts are already faintly there on the first frame, so the
        // page paints its largest text at once and brightens from there.
        tl.fromTo(
          q('.wall'),
          { opacity: 0.35 },
          { opacity: 1, duration: 1.2, ease: 'power1.out' },
          0,
        );
        q('.wall-row').forEach((row, i) => {
          tl.fromTo(
            row,
            { x: px(i % 2 ? 70 : -70) },
            { x: 0, duration: 2.2, ease: 'power3.out' },
            0,
          );
        });
        tl.fromTo(
          q('.g0'),
          { autoAlpha: 0, y: px(24) },
          { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out' },
          0.15,
        );
        rise(tl, '.hero h1 .rise > span', 0.3);
        tl.fromTo(
          q('.hero p'),
          { autoAlpha: 0, y: px(10) },
          { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out' },
          0.6,
        );
        tl.fromTo(
          q('.hero .store'),
          { autoAlpha: 0, y: px(12) },
          { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power2.out' },
          0.75,
        );
        tl.fromTo(q('.begin'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 1.1);
      },

      /* Cold open. The chat flickers on far away; the ghost rises into frame. */
      (tl) => {
        bars(tl, false);
        gsap.set(q('.s1 .chat'), from('chat', 'chatFar'));
        gsap.set(q('.s1 .ghost-rig'), from('ghost', 'ghostFar'));
        gsap.set(q('.seen'), { autoAlpha: 0 });
        gsap.set(q('.seen i'), { opacity: 1, y: 0 });
        gsap.set(q('.seen-strike'), { scaleX: 0 });
        gsap.set(q('.s1 .step'), { x: 0, y: 0 });
        gsap.set(q('.s1 .sub .rise > span'), { yPercent: 118 });
        gsap.set(q('.s1 .scrim'), { autoAlpha: 0 });
        tl.fromTo(
          q('.s1 .chat-glow'),
          { opacity: 0 },
          { keyframes: { opacity: [0, 0.75, 0.1, 0.95, 0.35, 1] }, duration: 1.1 },
          0.1,
        );
        cue(tl, () => sound.hum(), 0.15);
        tl.fromTo(q('.s1 .reflect'), { opacity: 0 }, { opacity: 0.18, duration: 1.2 }, 0.4);
        tl.fromTo(
          q('.s1 .spill'),
          { opacity: 0, scale: 0.7 },
          { opacity: 0.2, scale: 0.8, duration: 1.6 },
          0.3,
        );
        tl.fromTo(
          q('.s1 .ghost-in'),
          { autoAlpha: 0, y: px(40) },
          { autoAlpha: 1, y: 0, duration: 1.2, ease: 'power3.out' },
          0.6,
        );
        tl.fromTo(
          q('.s1 .haze'),
          { autoAlpha: 0, x: 0 },
          { autoAlpha: 1, x: px(tall ? 24 : 56), duration: 2.4, ease: 'power1.out' },
          0,
        );
        // Three planes drift at three speeds: haze, ghost, screen.
        tl.fromTo(
          q('.s1 .drift-ghost'),
          { x: 0 },
          { x: px(tall ? 6 : 14), duration: 2.4, ease: 'power1.out' },
          0,
        );
        tl.fromTo(
          q('.s1 .drift-screen'),
          { x: 0 },
          { x: px(tall ? 2 : 4), duration: 2.4, ease: 'power1.out' },
          0,
        );
        rise(tl, '.s1 .title .rise > span', 0.7);
      },

      /* The receipt. The camera pushes in and Seen lifts out of the chat,
         whole and readable. It holds; the ghost steps into its path, a line
         strikes through it and the word sinks back into the dark, still
         legible, never delivered. */
      (tl) => {
        bars(tl, false);
        gsap.set(q('.s1 .chat-glow'), { opacity: 1 });
        gsap.set(q('.s1 .ghost-in'), { autoAlpha: 1, y: 0 });
        gsap.set(q('.s1 .haze'), { autoAlpha: 1 });
        gsap.set(q('.seen i'), { opacity: 1, y: 0 });
        gsap.set(q('.seen-strike'), { scaleX: 0 });
        tl.to(q('.s1 .title .rise > span'), { autoAlpha: 0, duration: 0.35 }, 0);
        tl.fromTo(
          q('.s1 .chat'),
          from('chat', 'chatFar'),
          { x: 0, y: 0, scale: 1, duration: 1.6, ease: 'power2.inOut' },
          0,
        );
        tl.fromTo(
          q('.s1 .ghost-rig'),
          from('ghost', 'ghostFar'),
          { x: 0, y: 0, scale: 1, duration: 1.6, ease: 'power2.inOut' },
          0,
        );
        tl.fromTo(q('.s1 .reflect'), { opacity: 0.18 }, { opacity: 0, duration: 0.8 }, 0);
        tl.fromTo(
          q('.s1 .spill'),
          { opacity: 0.2, scale: 0.8 },
          { opacity: 0.3, scale: 1.05, duration: 1.6 },
          0,
        );
        tl.fromTo(
          q('.s1 .haze'),
          { x: px(tall ? 24 : 56) },
          { x: px(tall ? 40 : 90), duration: 2.2, ease: 'power1.out' },
          0,
        );
        tl.fromTo(
          q('.s1 .drift-ghost'),
          { x: px(tall ? 6 : 14) },
          { x: px(tall ? 10 : 24), duration: 2.2, ease: 'power1.out' },
          0,
        );
        subtitle(tl, '.s1', 0.2);
        cue(tl, () => sound.rise(), 0.5);
        // Seen lifts out of the chat and settles, whole.
        tl.fromTo(
          q('.seen'),
          { ...from('seen', 'seenFrom'), autoAlpha: 0 },
          { x: 0, y: 0, scale: 1, autoAlpha: 1, duration: 0.95, ease: 'power3.out' },
          0.55,
        );
        // The ghost steps into its path; the word is stopped short.
        tl.fromTo(
          q('.s1 .step'),
          { x: 0, y: 0 },
          { x: px(tall ? -12 : 34), y: px(-6), duration: 0.5, ease: 'power2.out' },
          1.55,
        );
        tl.to(
          q('.seen'),
          { keyframes: { x: [0, px(tall ? 0 : 10), 0] }, duration: 0.5, ease: 'power2.out' },
          1.62,
        );
        cue(tl, () => sound.cut(), 1.8);
        // One clean stroke through it, then it sinks back, still readable.
        tl.fromTo(
          q('.seen-strike'),
          { scaleX: 0 },
          { scaleX: 1, duration: 0.5, ease: 'power3.inOut' },
          1.8,
        );
        tl.to(
          q('.seen i'),
          { opacity: 0.36, y: px(4), duration: 0.7, stagger: 0.05, ease: 'power2.out' },
          1.95,
        );
      },

      /* The dots. Three rise, the third is swallowed, and none ever arrive. */
      (tl) => {
        bars(tl, false);
        tl.fromTo(
          q('.s2 .typing'),
          { scale: 1, x: 0 },
          { scale: 1.05, x: px(-14), duration: 2.4, ease: 'power1.out' },
          0,
        );
        q('.dot').forEach((d, i) => {
          tl.fromTo(
            d,
            { autoAlpha: 0, y: px(36), scale: 0.6 },
            { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(2)' },
            0.45 + i * 0.3,
          );
          cue(tl, () => sound.tap(i === 2), 0.45 + i * 0.3);
          tl.to(
            d,
            { autoAlpha: 0, y: px(-14), scale: 0.7, duration: i === 2 ? 0.25 : 0.45 },
            i === 2 ? 1.3 : 1.45 + i * 0.08,
          );
        });
        tl.fromTo(
          q('.s2 .lean'),
          { x: px(tall ? 240 : 380), rotation: -2 },
          { x: 0, rotation: -12, duration: 1.1, ease: 'power3.out' },
          0.25,
        );
        subtitle(tl, '.s2', 0.5);
      },

      /* The story. The footage plays; the ghost peeks in from the side. */
      (tl) => {
        bars(tl, false);
        tl.fromTo(
          q('.s3 .ig'),
          { scale: 1.08 },
          { scale: 1, duration: 2.4, ease: 'power2.out' },
          0,
        );
        tl.fromTo(q('.s3 .fb'), { x: px(30) }, { x: px(-10), duration: 2.4, ease: 'none' }, 0);
        tl.fromTo(q('.s3 .spill'), { opacity: 0 }, { opacity: 1, duration: 0.8 }, 0);
        tl.fromTo(
          q('.s3 .peek'),
          tall ? { x: px(120), y: px(30), rotation: 0 } : { x: px(110), y: 0, rotation: 0 },
          { x: 0, y: 0, rotation: tall ? -12 : 10, duration: 1, ease: 'power3.out' },
          0.7,
        );
        subtitle(tl, '.s3', 0.5);
      },

      /* The switches. The bars open; the popup takes the light; each switch
         turns on with a tick. */
      (tl) => {
        bars(tl, true);
        popup.current?.setSwitches(Array(SWITCH_COUNT).fill(false));
        popup.current?.focusRow(-1);
        tl.fromTo(q('.s4 .glow4'), { opacity: 0 }, { opacity: 1, duration: 1 }, 0);
        tl.fromTo(
          q('.s4 .popup-in'),
          { autoAlpha: 0, y: px(60), rotationY: -26 },
          { autoAlpha: 1, y: 0, rotationY: 0, duration: 1.1, ease: 'power3.out' },
          0.1,
        );
        rise(tl, '.s4 .copy h2 .rise > span', 0.2, 0.12);
        tl.fromTo(
          q('.s4 .copy p'),
          { autoAlpha: 0, y: px(14) },
          { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out' },
          0.55,
        );
        tl.fromTo(
          q('.s4 .peek4'),
          { x: px(tall ? 60 : 110), rotation: 0 },
          { x: 0, rotation: -14, duration: 1, ease: 'power3.out' },
          0.7,
        );
        for (let i = 0; i < SWITCH_COUNT; i += 1) {
          cue(
            tl,
            () => {
              popup.current?.setSwitches(Array.from({ length: SWITCH_COUNT }, (_, j) => j <= i));
              popup.current?.focusRow(i);
              sound.tick();
            },
            0.95 + i * 0.17,
          );
        }
        cue(tl, () => popup.current?.focusRow(-1), 2.1);
      },

      /* The wide. Pull back from the three screens. */
      (tl) => {
        bars(tl, false);
        tl.fromTo(
          q('.s5 .world'),
          { scale: 1.4, y: px(-30) },
          { scale: 1, y: 0, duration: 2.2, ease: 'power3.out' },
          0,
        );
        cue(tl, () => sound.phrase(), 0.4);
        tl.fromTo(q('.s5 .scrim'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0.3);
        rise(tl, '.s5 .mark .rise > span', 0.5, 0.12);
      },

      /* Privacy. The camera keeps pulling back: the whole scene was one
         browser window. Three lines, then the credit. */
      (tl) => {
        bars(tl, false);
        const H = stage.clientHeight;
        tl.fromTo(
          q('.s7 .frame'),
          { scale: 1, y: 0 },
          {
            // Short landscape screens pull back further to clear the lines.
            scale: tall ? 0.6 : H < 560 ? 0.5 : 0.58,
            y: (tall ? -84 : -40) * U,
            duration: 1.4,
            ease: 'power2.inOut',
          },
          0,
        );
        tl.fromTo(q('.s7 .window'), { opacity: 0 }, { opacity: 1, duration: 0.9 }, 0.3);
        tl.fromTo(q('.s7 .scrim'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0.5);
        q('.s7 .local-line').forEach((line, i) => {
          tl.fromTo(
            line,
            { autoAlpha: 0, y: px(8) },
            { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' },
            0.9 + i * 0.25,
          );
          cue(tl, () => sound.tap(), 0.9 + i * 0.25);
        });
        tl.fromTo(
          q('.s7 .local-credit'),
          { autoAlpha: 0, y: px(6) },
          { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' },
          1.75,
        );
        cue(tl, () => sound.tick(), 1.75);
      },

      /* End card. The bars open on the ghost, smiling. */
      (tl) => {
        bars(tl, true);
        tl.fromTo(q('.s6 .glow6'), { opacity: 0 }, { opacity: 1, duration: 1.2 }, 0);
        tl.fromTo(
          q('.s6 .g6'),
          { scale: 0.8, y: px(30), rotation: -4 },
          { scale: 1, y: 0, rotation: 6, duration: 1.3, ease: 'back.out(1.6)' },
          0.15,
        );
        cue(tl, () => sound.chord(), 0.2);
        rise(tl, '.s6 h2 .rise > span', 0.3, 0.12);
        tl.fromTo(
          q('.s6 .store'),
          { autoAlpha: 0, y: px(16) },
          { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power2.out' },
          0.7,
        );
      },
    ];

    /* How loud and how open the score is in each shot: the wall is quiet,
       the receipt lands, the dots are near silent, the story breathes, the
       wide swells, the end card resolves. */
    const LEVEL = [0.1, 0.25, 0.9, 0.12, 0.45, 0.35, 0.8, 0.35, 0.25];

    /* ---------- The ghost match cut ----------
       The outgoing shot holds; the ghost silhouette grows into a mask with
       the next shot already playing inside it, then opens past the frame. */
    const matchCut = (tl: TL, out: HTMLElement, into: HTMLElement, anchor: string) => {
      const W = stage.clientWidth;
      const H = stage.clientHeight;
      const sr = stage.getBoundingClientRect();
      const r = anchor ? el.querySelector(anchor)?.getBoundingClientRect() : null;
      const a =
        r && r.width > 12 && r.right > sr.left && r.left < sr.right && r.bottom > sr.top ? r : null;
      const s0 = a ? a.width / 200 : (H * 0.22) / 250;
      const m = {
        x: a ? a.left - sr.left : W / 2 - 100 * s0,
        y: a ? a.top - sr.top : H / 2 - 125 * s0,
        s: s0,
      };
      const sM = Math.max(s0 * 1.5, (H * 0.55) / 250);
      const sF = Math.max((W * 1.2) / 160, (H * 1.2) / 94);
      const paint = () => {
        into.style.clipPath = ghostPath(m.x, m.y, m.s);
        rim.style.transform = `translate3d(${m.x}px, ${m.y}px, 0) scale(${m.s})`;
      };
      gsap.set(into, { autoAlpha: 1, zIndex: 2 });
      paint();
      tl.to(
        m,
        {
          x: (W / 2 + (m.x + 100 * s0)) / 2 - 100 * sM,
          y: H * 0.47 - 125 * sM,
          s: sM,
          duration: 0.4,
          ease: 'power3.out',
          onUpdate: paint,
        },
        0,
      );
      tl.to(
        m,
        {
          x: W / 2 - 100 * sF,
          y: H / 2 - 149 * sF,
          s: sF,
          duration: 0.35,
          ease: 'power3.in',
          onUpdate: paint,
        },
        0.4,
      );
      tl.fromTo(out, { opacity: 1 }, { opacity: 0.32, duration: 0.35, ease: 'power1.out' }, 0);
      tl.fromTo(rim, { opacity: 0 }, { opacity: 0.85, duration: 0.15 }, 0);
      tl.to(rim, { opacity: 0, duration: 0.2 }, 0.45);
      cue(
        tl,
        () => {
          into.style.clipPath = '';
          gsap.set(into, { zIndex: '' });
          gsap.set(out, { autoAlpha: 0 });
        },
        0.76,
      );
      cue(tl, () => sound.whoosh(), 0);
    };

    /* ---------- The director ---------- */

    let shot = -1;
    let started = false;
    let locked = false;
    let busyUntil = 0;
    let current: TL | null = null;
    let wheelLast = 0;
    let wheelPrev = 0;
    let wheelDelta = 0;
    let wheelDeltaPrev = 0;
    let soundAsked = false;

    const layerOf = (i: number) => q(SHOTS[i].layer)[0] as HTMLElement;

    const media = (i: number, fresh: boolean) => {
      runClip(chatVideo.current, i === 1 || i === 2, fresh && i === 1);
      runClip(igVideo.current, i === 4, fresh && i === 4);
      // Preload only the next shot's footage.
      // The opener's clip waits for the visitor's first sign of intent (see
      // `intent`), so it never competes with the first paint.
      if (i === 3) primeClip(igVideo.current);
    };

    const mark = (i: number) => {
      el.dataset.shot = String(i);
      ticks.forEach((t, j) => {
        t.classList.toggle('is-current', j === i);
        t.classList.toggle('is-past', j < i);
        if (j === i) t.setAttribute('aria-current', 'step');
        else t.removeAttribute('aria-current');
      });
    };

    const setHash = (i: number) => {
      const hash = `#${SHOTS[i].id}`;
      if (location.hash !== hash) history.pushState(null, '', hash);
    };

    /* Build shot `to` and cut to it from the shot on screen. */
    const go = (to: number, opts: { instant?: boolean; push?: boolean } = {}) => {
      const was = shot;
      if (to === was && !opts.instant) return;
      current?.kill();
      measure();
      shot = to;
      mark(to);
      if (opts.push !== false && started) setHash(to);

      const into = layerOf(to);
      const out = was >= 0 ? layerOf(was) : null;
      SHOTS.forEach((s) => {
        const l = q(s.layer)[0] as HTMLElement;
        const live = l === into || l === out;
        if (!live) gsap.set(l, { autoAlpha: 0, zIndex: '' });
        // Layers off screen skip style, layout and paint entirely.
        l.style.contentVisibility = live ? 'visible' : 'hidden';
        l.style.clipPath = '';
      });
      gsap.set(rim, { opacity: 0 });
      if (out && out !== into) gsap.set(out, { autoAlpha: 1, opacity: 1 });

      const tl = gsap.timeline({ paused: true });
      const continuous = was === to - 1 && CONTINUOUS.has(to);
      if (opts.instant || !out || out === into || continuous) {
        gsap.set(into, { autoAlpha: 1, zIndex: '' });
        if (out && out !== into) gsap.set(out, { autoAlpha: 0 });
      } else {
        matchCut(tl, out, into, SHOTS[was].ghost);
      }
      const shotTl = gsap.timeline();
      SHOT[to](shotTl);
      tl.add(shotTl, 0);
      // The current tick fills across the shot; when it is full the next
      // gesture is accepted.
      const fill = ticks[to]?.querySelector('b');
      if (fill) {
        tl.fromTo(
          fill,
          { scaleX: 0 },
          { scaleX: 1, duration: tl.duration() + HOLD, ease: 'none' },
          0,
        );
      }

      media(to, !continuous);
      sound.setIntensity(LEVEL[to]);
      if (opts.instant) {
        tl.progress(1, true);
        tl.kill();
        if (to === 5) popup.current?.setSwitches(Array(SWITCH_COUNT).fill(true));
        busyUntil = 0;
        current = null;
        return;
      }
      current = tl;
      busyUntil = performance.now() + tl.duration() * 1000;
      tl.play();
    };

    /* ---------- Input ---------- */

    const lock = () => {
      if (locked) return;
      locked = true;
      el.classList.add('is-locked');
      obs.enable();
    };
    const unlock = () => {
      if (!locked) return;
      locked = false;
      el.classList.remove('is-locked');
      obs.disable();
    };

    /* Native scroll takes over past the last shot. */
    const release = () => {
      unlock();
      const credits = document.querySelector<HTMLElement>('.credits');
      const top = credits ? credits.getBoundingClientRect().top + scrollY - 72 : innerHeight;
      window.scrollTo({ top: Math.min(top, innerHeight * 0.9), behavior: 'smooth' });
    };

    /* Sound starts inside the visitor's first press, in the same event. */
    const ensureSound = () => {
      try {
        if (!soundAsked) {
          soundAsked = true;
          if (soundPreferred()) sound.arm();
        } else if (sound.on && !sound.running) {
          sound.arm();
        }
      } catch {
        /* No audio here: the film still runs. */
      }
    };

    const start = () => {
      if (started) return;
      started = true;
      el.classList.add('is-started');
      lock();
      go(1);
    };

    const step = (dir: 1 | -1) => {
      if (!started) {
        if (dir > 0) start();
        return;
      }
      const to = shot + dir;
      if (to < 0) return;
      if (to > LAST) {
        release();
        return;
      }
      go(to);
    };

    const jump = (i: number) => {
      if (!locked) {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        lock();
      }
      if (!started) {
        started = true;
        el.classList.add('is-started');
      }
      go(i);
    };

    const skip = () => {
      jump(LAST);
      el.querySelector<HTMLElement>('.s6 .store')?.focus({ preventScroll: true });
    };

    api.current = {
      start: () => {
        ensureSound();
        start();
      },
      jump: (i) => {
        ensureSound();
        jump(i);
      },
      skip: () => {
        ensureSound();
        skip();
      },
    };

    const isWheel = (e: Event | undefined) => e?.type === 'wheel';
    const isTouch = (e: Event | undefined) =>
      !!e && (e.type.startsWith('touch') || (e as PointerEvent).pointerType === 'touch');
    const gesture = (dir: 1 | -1, e?: Event) => {
      const now = performance.now();
      if (now < busyUntil) return;
      // A trackpad's momentum keeps sending wheel events after the swipe; a
      // stream still running when the shot ends is the same gesture, unless,
      // after the cooldown, its delta rises again: a new swipe on top of it.
      if (isWheel(e) && wheelLast - wheelPrev < 160) {
        const rising = wheelDelta > Math.max(8, wheelDeltaPrev * 1.5);
        if (now < busyUntil + COOLDOWN || !rising) return;
      }
      if (isTouch(e)) el.classList.add('has-swiped');
      ensureSound();
      step(dir);
    };

    const obs = Observer.create({
      target: window,
      type: 'wheel,touch,pointer',
      wheelSpeed: -1,
      tolerance: 10,
      dragMinimum: 6,
      preventDefault: true,
      ignore: '.bar',
      onUp: (self) => gesture(1, self.event),
      onDown: (self) => gesture(-1, self.event),
    });
    obs.disable();

    const onWheelStamp = (e: WheelEvent) => {
      wheelPrev = wheelLast;
      wheelLast = performance.now();
      wheelDeltaPrev = wheelDelta;
      wheelDelta = Math.abs(e.deltaY) + Math.abs(e.deltaX);
    };

    const excluded = (t: EventTarget | null) =>
      !!(t as Element | null)?.closest?.('a, button, input, select, textarea, .bar');

    /* The first press anywhere begins the film, with sound. */
    let pressedAt = 0;
    const press = (e: Event) => {
      if (excluded(e.target)) return;
      const now = performance.now();
      if (now - pressedAt < 500) return;
      pressedAt = now;
      ensureSound();
      if (!started && locked && scrollY < 4) start();
    };
    const onPointerDown = (e: PointerEvent) => {
      onMove(e);
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') press(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') press(e);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as Element | null;
      if (t?.closest?.('input, select, textarea, [contenteditable="true"]')) return;
      const onControl = !!t?.closest?.('a, button, summary, [role="button"]');
      const k = e.key;
      const space = k === ' ' || k === 'Spacebar';
      const next = ['ArrowDown', 'ArrowRight', 'PageDown'].includes(k) || (space && !e.shiftKey);
      const prev = ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(k) || (space && e.shiftKey);
      const skipKey = k === 'Escape' || k === 'End';
      const enter = k === 'Enter';
      if (!locked || (!next && !prev && !skipKey && !enter && k !== 'Home')) return;
      if ((space || enter) && onControl) return;
      e.preventDefault();
      ensureSound();
      if (enter) {
        if (!started) start();
        return;
      }
      if (skipKey) {
        if (started && shot < LAST) skip();
        else if (!started) jump(LAST);
        return;
      }
      if (k === 'Home') {
        if (started) jump(0);
        return;
      }
      if (e.repeat || performance.now() < busyUntil) return;
      if (started) el.classList.add('has-keyed');
      step(next ? 1 : -1);
    };

    /* While the film holds the screen the page stays put. */
    const onScroll = () => {
      if (locked && scrollY > 0) window.scrollTo(0, 0);
    };

    /* Tabbing past the film hands the page back to native scroll. */
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as Element | null;
      if (!locked || !t?.getBoundingClientRect || el.contains(t)) return;
      if (t.getBoundingClientRect().top >= el.getBoundingClientRect().bottom - 1) unlock();
    };

    const onPop = () => {
      const i = shotFromHash();
      // Other fragments (skip links) are not shots.
      if (i < 0 && location.hash.length > 1) return;
      jump(i < 0 ? 0 : i);
    };

    // Footage plays only in its shot; the light follows it.
    let raf = 0;
    let frame = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      frame += 1;
      if (frame % 3 || (shot !== 1 && shot !== 2 && shot !== 4)) return;
      const paint = (v: HTMLVideoElement | null, c: HTMLCanvasElement | null, f: Footage) => {
        if (!v || !c || v.readyState < 2 || v.paused) return;
        const k = v.videoWidth / f.size[0];
        const [x, y, w, h] = f.crop;
        c.getContext('2d')?.drawImage(v, x * k, y * k, w * k, h * k, 0, 0, c.width, c.height);
      };
      if (shot === 4) paint(igVideo.current, spill3.current, FOOTAGE.instagram);
      else paint(chatVideo.current, spill1.current, FOOTAGE.messenger);
    };

    // Resizing re-lays the shot on screen at its hold frame.
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (performance.now() >= busyUntil && shot >= 0) go(shot, { instant: true, push: false });
        else measure();
      }, 160);
    };

    let st: ScrollTrigger | null = null;
    try {
      measure();
      seed(spill1.current, FOOTAGE.messenger.glow);
      seed(spill3.current, FOOTAGE.instagram.glow);
      el.classList.add('is-live');

      const linked = shotFromHash();
      if (linked > 0) {
        started = true;
        el.classList.add('is-started');
        go(linked, { instant: true, push: false });
      } else {
        go(0, { push: false });
        // The opener's entrance never holds back the first gesture.
        busyUntil = 0;
      }
      if (scrollY <= 2) lock();

      /* Native scroll before and after the film; the film takes over when
         the page is back at its top. */
      st = ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: '+=2',
        onEnterBack: () => {
          lock();
          busyUntil = Math.max(busyUntil, performance.now() + 400);
        },
        onRefreshInit: measure,
      });

      INTENT.forEach((t) => addEventListener(t, intent, { capture: true, passive: true }));
      stage.addEventListener('pointermove', onMove, { passive: true });
      addEventListener('wheel', onWheelStamp, { capture: true, passive: true });
      addEventListener('pointerdown', onPointerDown, true);
      addEventListener('pointerup', onPointerUp, true);
      addEventListener('touchend', press, true);
      addEventListener('keydown', onKey);
      addEventListener('scroll', onScroll, { passive: true });
      addEventListener('focusin', onFocusIn);
      addEventListener('popstate', onPop);
      addEventListener('resize', onResize);
      raf = requestAnimationFrame(loop);
    } catch {
      fail.current();
    }

    return () => {
      current?.kill();
      st?.kill();
      obs.kill();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(praf);
      window.clearTimeout(resizeTimer);
      INTENT.forEach((t) => removeEventListener(t, intent, true));
      stage.removeEventListener('pointermove', onMove);
      removeEventListener('wheel', onWheelStamp, true);
      removeEventListener('pointerdown', onPointerDown, true);
      removeEventListener('pointerup', onPointerUp, true);
      removeEventListener('touchend', press, true);
      removeEventListener('keydown', onKey);
      removeEventListener('scroll', onScroll);
      removeEventListener('focusin', onFocusIn);
      removeEventListener('popstate', onPop);
      removeEventListener('resize', onResize);
      runClip(chatVideo.current, false);
      runClip(igVideo.current, false);
      el.classList.remove('is-live', 'is-locked', 'is-started');
      api.current = null;
    };
  }, [sound]);

  const onTick = (i: number) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!api.current) return;
    e.preventDefault();
    api.current.jump(i);
  };

  const onSkip = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!api.current) return;
    e.preventDefault();
    api.current.skip();
  };

  return (
    <section className="film" ref={root} aria-label="Ghostify, a short film" data-shot="0">
      <div className="film-stage">
        {/* The wall: the opener. */}
        <div className="layer s0">
          <div className="wall" aria-hidden="true">
            {WALL_OFFSETS.concat(WALL_OFFSETS).map((o, i) => (
              <div className="wall-row" key={i} style={{ '--o': o } as CSSProperties}>
                {WALL_ROWS[i % WALL_ROWS.length].repeat(2)}
              </div>
            ))}
          </div>
          <div className="wipe" aria-hidden="true" />
          <div className="clear at" style={at('clear')} aria-hidden="true" />
          <div className="g0 at" style={at('g0')}>
            <Ghost label="The Ghostify ghost" />
          </div>
          <div className="hero">
            <div className="hero-text">
              <h1>
                <Line>Read without sending Seen.</Line>
              </h1>
              <p>
                A free browser extension that hides your Seen, Typing, and Story View signals on
                Instagram, Messenger, and Facebook.
              </p>
            </div>
            <StoreButtons stores={stores} />
            <div className="begin">
              <button
                type="button"
                className="begin-press"
                aria-label="Begin the film, with sound"
                onClick={() => api.current?.start()}
              >
                <span className="begin-glyph">
                  <Speaker />
                </span>
                <span className="on-mouse">Press anywhere to begin</span>
                <span className="on-touch">Tap anywhere to begin</span>
              </button>
              <div className="begin-keys on-mouse" aria-hidden="true">
                <Kbd>Space</Kbd>
                <span>or</span>
                <Kbd>Enter</Kbd>
                <span>work too</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cold open, and the receipt that never arrives. */}
        <div className="layer s1">
          <canvas
            className="spill at"
            style={at('spill1')}
            ref={spill1}
            width={32}
            height={32}
            aria-hidden="true"
          />
          <div className="drift-screen">
            <img
              className="reflect at"
              style={at('reflect')}
              src={FOOTAGE.messenger.still}
              alt=""
              aria-hidden="true"
            />
            <div className="chat mover at" style={at('chat')}>
              <div className="chat-glow">
                <Clip
                  ref={chatVideo}
                  footage={FOOTAGE.messenger}
                  play
                  className="screen"
                  label="A real Messenger chat, read with Ghostify on"
                />
              </div>
            </div>
          </div>
          <div className="fade" aria-hidden="true" />
          <div className="seen at" style={at('seen')} aria-hidden="true">
            <i>S</i>
            <i>e</i>
            <i>e</i>
            <i>n</i>
            <b className="seen-strike" />
          </div>
          <div className="drift-ghost">
            <div className="ghost-rig mover at" style={at('ghost')}>
              <div className="ghost-in">
                <div className="step">
                  <GhostSilhouette />
                </div>
              </div>
            </div>
          </div>
          <div className="haze at" style={at('haze')} aria-hidden="true" />
          <p className="title" aria-hidden="true">
            <Line>Read without sending Seen.</Line>
          </p>
          <div className="scrim" aria-hidden="true" />
          <p className="sub">
            <Line>You read it. They never get a Seen.</Line>
          </p>
        </div>

        {/* The dots. */}
        <div className="layer s2">
          <Glow at="glow2" src="/media/messenger-typing-glow.webp" />
          <img
            className="typing screen at"
            style={at('typing')}
            src="/media/messenger-typing.webp"
            alt="A real Messenger reply being typed with Hide Typing on"
            loading="lazy"
          />
          <div className="dots at" style={at('dots')} aria-hidden="true">
            <i className="dot" />
            <i className="dot" />
            <i className="dot" />
          </div>
          <div className="lean at" style={at('lean')}>
            <GhostSilhouette rim="left" />
          </div>
          <div className="scrim" aria-hidden="true" />
          <p className="sub">
            <Line>Type, delete, rethink. No dots.</Line>
          </p>
        </div>

        {/* The story. */}
        <div className="layer s3">
          <canvas
            className="spill at"
            style={at('glow3')}
            ref={spill3}
            width={32}
            height={32}
            aria-hidden="true"
          />
          <img
            className="fb screen at"
            style={at('fb')}
            src="/media/facebook-story-soft.webp"
            alt="A real Facebook story, further back"
            loading="lazy"
          />
          <div className="peek at" style={at('peek')}>
            <Ghost eyes="right" light="cool" />
          </div>
          <Clip
            ref={igVideo}
            footage={FOOTAGE.instagram}
            play
            className="ig screen at"
            style={at('ig')}
            label="A real Instagram story, watched with Ghostify on"
          />
          <div className="fade" aria-hidden="true" />
          <div className="scrim" aria-hidden="true" />
          <p className="sub">
            <Line>Watch the story. Your name stays off the list.</Line>
          </p>
        </div>

        {/* The switches. */}
        <div className="layer s4">
          <div className="glow4 at" style={at('glow4')} aria-hidden="true" />
          <div className="peek4 at" style={at('peek4')}>
            <Ghost eyes="left" />
          </div>
          <div className="popup-slot at" style={at('popup')}>
            <div className="tilt">
              <div className="popup-in">
                <RealPopup className="popup" ref={popup} />
              </div>
            </div>
          </div>
          <div className="copy">
            <h2>
              <Line>Pick what</Line> <Line>to hide.</Line>
            </h2>
            <p>Instagram gets its own switches. Messenger and Facebook share theirs.</p>
          </div>
        </div>

        {/* The wide. */}
        <div className="layer s5">
          <World />
          <div className="scrim" aria-hidden="true" />
          <ul className="marks" aria-label="Works on">
            {MARKS.map(([platform, name, x, px]) => (
              <li
                key={platform}
                className="mark"
                style={{ '--mx': x, '--pmx': px } as CSSProperties}
              >
                <span className="rise">
                  <span>
                    <PlatformLogo platform={platform} className="mark-logo" />
                    <span className="mark-name">{name}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Privacy: in your browser. Only the two links take the pointer. */}
        <div className="layer s7">
          <div className="frame">
            <div className="pane">
              <World decor />
            </div>
            <div className="window" aria-hidden="true" />
          </div>
          <div className="scrim" aria-hidden="true" />
          <div className="local">
            <p className="local-lines">
              <span className="local-line">No account.</span>{' '}
              <span className="local-line">No servers.</span>{' '}
              <a className="local-line" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                Open source.
              </a>
            </p>
            <a
              className={`local-credit ${ALL_WORKING ? 'is-ok' : 'is-review'}`}
              href={`${base}/status`}
            >
              {ALL_WORKING ? 'Every switch verified working' : 'Some switches under review'} ·{' '}
              {LAST_VERIFIED}
            </a>
          </div>
        </div>

        {/* End card. */}
        <div className="layer s6" id="install">
          <div className="glow6 at" style={at('glow6')} aria-hidden="true" />
          <div className="end">
            <div className="end-text">
              <div className="g6">
                <Ghost eyes="happy" label="The ghost, eyes closed and smiling" />
              </div>
              <h2>
                <Line>Read now.</Line>
                <Line>Reply when you’re ready.</Line>
              </h2>
            </div>
            <StoreButtons stores={stores} />
          </div>
        </div>

        <svg className="cut-rim" viewBox="0 0 200 250" aria-hidden="true">
          <path d={OUTLINE} />
        </svg>
        <div className="grain" aria-hidden="true" />
        <div className="bar-top" aria-hidden="true" />
        <div className="bar-bottom" aria-hidden="true" />
        <p className="swipe-hint" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="m6 15 6-6 6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Swipe up for the next shot
        </p>
        <div className="film-ui">
          <p className="keys" aria-hidden="true">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
            <span>or</span>
            <Kbd>Space</Kbd>
            <span>to step</span>
          </p>
          <nav className="ticks" aria-label="Shots">
            {SHOTS.map((s, i) => (
              <a
                key={s.id}
                className={`tick${i === 0 ? ' is-current' : ''}`}
                href={`#${s.id}`}
                aria-label={s.name}
                onClick={onTick(i)}
              >
                <i aria-hidden="true">
                  <b />
                </i>
                <span className="tick-tip" aria-hidden="true">
                  {s.name}
                </span>
              </a>
            ))}
          </nav>
          <a className="skip" href="#install" onClick={onSkip}>
            <span className="skip-long">Skip film</span>
            <span className="skip-short">Skip</span>
            <Kbd>Esc</Kbd>
          </a>
        </div>
      </div>
    </section>
  );
}
