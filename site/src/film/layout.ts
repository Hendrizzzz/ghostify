import type { CSSProperties } from 'react';
import type { MetaPlatform } from '../components/PlatformLogo';

type R = readonly [x: number, y: number, w: number];

/* Where things sit, in canvas units: [widescreen, vertical, short vertical]. */
export const AT = {
  g0: [
    [576, 118, 128],
    [159, 128, 72],
    [167, 84, 56],
  ],
  clear: [
    [140, -150, 1000],
    [-185, -60, 760],
    [-185, -110, 760],
  ],
  spill1: [
    [560, -110, 880],
    [-160, 40, 710],
    [-160, -20, 710],
  ],
  chat: [
    [900, 104, 300],
    [0, 0, 390],
    [0, 0, 390],
  ],
  chatFar: [
    [720, 166, 210],
    [120, 190, 170],
    [140, 100, 150],
  ],
  reflect: [
    [720, 488, 210],
    [120, 451, 170],
    [140, 331, 150],
  ],
  ghost: [
    [96, 172, 300],
    [246, 514, 120],
    [250, 330, 110],
  ],
  ghostFar: [
    [262, 262, 236],
    [24, 446, 140],
    [36, 300, 120],
  ],
  haze: [
    [-200, 380, 640],
    [-160, 560, 460],
    [-160, 400, 460],
  ],
  seen: [
    [470, 236, 0],
    [24, 542, 0],
    [24, 372, 0],
  ],
  seenFrom: [
    [930, 400, 0],
    [190, 450, 0],
    [190, 300, 0],
  ],
  glow2: [
    [20, -60, 840],
    [-150, 20, 690],
    [-150, -10, 690],
  ],
  typing: [
    [150, 110, 500],
    [16, 132, 358],
    [16, 92, 358],
  ],
  draft: [
    [676, 304, 0],
    [24, 462, 0],
    [24, 408, 0],
  ],
  lean: [
    [1010, 230, 340],
    [226, 556, 220],
    [236, 392, 200],
  ],
  glow3: [
    [230, -130, 960],
    [-160, -40, 710],
    [-160, -60, 710],
  ],
  fb: [
    [900, 160, 222],
    [250, 140, 150],
    [250, 100, 150],
  ],
  ig: [
    [580, 96, 262],
    [0, 0, 390],
    [0, -16, 390],
  ],
  peek: [
    [434, 244, 220],
    [262, 466, 160],
    [266, 318, 140],
  ],
  glow4: [
    [560, 60, 640],
    [-40, 250, 470],
    [-40, 180, 470],
  ],
  popup: [
    [730, 100, 390],
    [88, 270, 280],
    [120, 254, 230],
  ],
  peek4: [
    [600, 230, 190],
    [4, 370, 130],
    [8, 300, 112],
  ],
  w0: [
    [250, 178, 169],
    [20, 300, 104],
    [20, 268, 104],
  ],
  w1: [
    [528, 150, 224],
    [133, 268, 124],
    [133, 236, 124],
  ],
  w2: [
    [862, 180, 168],
    [266, 300, 104],
    [266, 268, 104],
  ],
  wGlow0: [
    [120, 100, 440],
    [-80, 200, 300],
    [-80, 168, 300],
  ],
  wGlow1: [
    [430, 60, 420],
    [40, 170, 310],
    [40, 138, 310],
  ],
  wGlow2: [
    [740, 100, 440],
    [170, 200, 300],
    [170, 168, 300],
  ],
  wGhost: [
    [610, 462, 60],
    [175, 432, 40],
    [175, 400, 40],
  ],
  glow6: [
    [340, 0, 600],
    [-60, 80, 510],
    [-60, 40, 510],
  ],
} as const satisfies Record<string, readonly [R, R, R]>;

export type Key = keyof typeof AT;

export function at(key: Key, extra?: CSSProperties): CSSProperties {
  const [w, t, s] = AT[key];
  return {
    ...extra,
    '--x': w[0],
    '--y': w[1],
    '--w': w[2],
    '--px': t[0],
    '--py': t[1],
    '--pw': t[2],
    '--qx': s[0],
    '--qy': s[1],
    '--qw': s[2],
  } as CSSProperties;
}

/* The vertical cut's two takes: a phone 844 units tall and one 660 tall. */
export const TALL = 844;
export const SHORT = 660;
/* The widescreen cut stops growing here, so a 4K screen is not blown up. */
export const MAX_U = 2.5;

/* The wide's platform marks, each centred under its own screen: canvas x for
   [widescreen, vertical]. */
export const MARKS: ReadonlyArray<readonly [MetaPlatform, string, number, number]> = [
  ['instagram', 'Instagram', 334, 72],
  ['messenger', 'Messenger', 640, 195],
  ['facebook', 'Facebook', 946, 318],
];
