/* The receipts on the wall, set apart by space alone. */
export const WALL_ROWS = [
  ['Seen 21:04', 'typing', 'Seen', 'viewed your story'],
  ['typing', 'Seen 9:41', 'viewed your story', 'Seen'],
  ['Seen', 'viewed your story', 'Seen 21:04', 'typing'],
  ['viewed your story', 'typing', 'Seen', 'Seen 9:41'],
  ['Seen 21:04', 'Seen', 'typing', 'viewed your story'],
  ['typing', 'viewed your story', 'Seen 9:41', 'Seen'],
].map((row) => row.map((w) => `${w}  `).join(''));
export const WALL_OFFSETS = [-60, -340, -120, -420, -200, -520, -20, -280];

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
export const LAST = SHOTS.length - 1;
/* Shots that run straight on from the one before, with no cut. Stepping
   back out of one plays it backwards, so the way back is the exact reverse
   of the way in, only a little faster. */
export const CONTINUOUS = new Set([2, 7]);
export const REWIND = 1.5;
/* The rest after a shot before the next gesture is accepted (s). */
export const HOLD = 0.3;
/* Trackpad momentum: a wheel stream that is still running when a shot ends
   is ignored for this long (ms). */
export const COOLDOWN = 1000;
export const SWITCH_COUNT = 6;

/* The typing shot's draft, typed and then taken back, and when each key
   lands (s into the shot): a little uneven, a beat longer at a space, and
   erased faster than it was written. */
export const DRAFT = 'let me think';
export const TYPED: number[] = [];
for (let i = 0, at = 0.5; i < DRAFT.length; i += 1) {
  TYPED.push(at);
  at += DRAFT[i] === ' ' ? 0.14 : 0.064 + ((i * 7) % 3) * 0.013;
}
export const ERASED = Array.from(DRAFT, (_, i) => 1.86 + i * 0.044);

/* The cold open's screen flicker: its opacity steps, and how long they take. */
export const FLICKER = [0, 0.75, 0.1, 0.95, 0.35, 1] as const;
export const FLICKER_TIME = 1;

/* The receipt: when Seen starts to lift out of the chat, and when the ghost
   stops it (s into the shot). */
export const LIFT = 0.55;
export const HIT = 1.8;
/* Privacy: how long the camera takes to pull back from the wide (s). */
export const PULL = 1.4;
/* The wide: one note for each platform as its name rises. */
export const MARK_NOTES = [329.63, 392, 493.88];

export const shotFromHash = () => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id === 'install') return LAST;
  return SHOTS.findIndex((s) => s.id === id);
};
