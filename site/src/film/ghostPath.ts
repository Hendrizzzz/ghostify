/* The ghost's outline in its 200 × 250 box, as coordinate pairs, for the
   match cut's mask. */
export const OUTLINE =
  'M20 196 L20 102 C20 54 56 18 100 18 C144 18 180 54 180 102 L180 196 C180 222 173 226 160 226 C147 226 143 215 140 207 C137 215 133 222 120 222 C107 222 103 215 100 207 C97 215 93 227 80 227 C67 227 63 215 60 207 C57 215 53 223 40 223 C27 223 20 219 20 196 Z';
const PAIR = /(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g;
export const ghostPath = (x: number, y: number, s: number) =>
  `path('${OUTLINE.replace(
    PAIR,
    (_, a: string, b: string) =>
      `${(x + Number(a) * s).toFixed(1)} ${(y + Number(b) * s).toFixed(1)}`,
  )}')`;
