import { useId } from 'react';

/* The Ghostify mascot as vector art, built on the brand mark's proportions.
   Vector edges stay exact at any size, and the motion (hem ripple, float,
   blink) runs in the browser's animation engine, not in script. Eyes follow
   --gx / --gy, set by the page from the pointer. */

const SIDE = 196;
const NOTCH = 207;
const EDGES = [180, 140, 100, 60, 20];

function bodyPath(drops: readonly number[]) {
  let d = `M20 ${SIDE} V102 C20 54 56 18 100 18 C144 18 180 54 180 102 V${SIDE}`;
  for (let i = 0; i < 4; i += 1) {
    const xr = EDGES[i];
    const xl = EDGES[i + 1];
    const m = (xr + xl) / 2;
    const b = drops[i];
    const yl = i === 3 ? SIDE : NOTCH;
    const startCtrl = i === 0 ? `${xr} ${b - 4}` : `${xr - 3} ${NOTCH + 8}`;
    const endCtrl = i === 3 ? `${xl} ${b - 4}` : `${xl + 3} ${NOTCH + 8}`;
    d += ` C${startCtrl} ${m + 13} ${b} ${m} ${b} C${m - 13} ${b} ${endCtrl} ${xl} ${yl}`;
  }
  return `${d} Z`;
}

// Three hem poses with identical commands, so the browser can morph them.
const POSES = [
  bodyPath([226, 222, 227, 223]),
  bodyPath([221, 227, 222, 228]),
  bodyPath([225, 223, 228, 221]),
];

type Props = {
  className?: string;
  still?: boolean;
  /* follow: eyes track --gx/--gy. left/right: looking off to one side.
     happy: eyes closed in two soft arcs. */
  eyes?: 'follow' | 'left' | 'right' | 'happy';
  /* warm: the ghost's own light. cool: lit from the side by a screen. */
  light?: 'warm' | 'cool';
  label?: string;
};

export function Ghost({ className, still, eyes = 'follow', light = 'warm', label }: Props) {
  const id = useId().replace(/:/g, '');
  const body = `gb-${id}`;
  const side = `gs-${id}`;
  const foot = `gf-${id}`;
  const shine = `gh-${id}`;
  const floor = `gl-${id}`;

  return (
    <svg
      className={`ghost eyes-${eyes}${still ? ' is-still' : ''} ${className ?? ''}`}
      viewBox="0 0 200 250"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        {light === 'cool' ? (
          <radialGradient id={body} cx="0.85" cy="0.3" r="1">
            <stop offset="0" stopColor="#e6eeff" />
            <stop offset="0.45" stopColor="#9aa6c4" />
            <stop offset="1" stopColor="#1a1a22" />
          </radialGradient>
        ) : (
          <radialGradient id={body} cx="0.36" cy="0.2" r="0.95">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.5" stopColor="#f6f2ec" />
            <stop offset="0.82" stopColor="#e6e0ea" />
            <stop offset="1" stopColor="#d4cce2" />
          </radialGradient>
        )}
        <linearGradient id={side} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="0.18" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.72" stopColor="#5d4f94" stopOpacity="0" />
          <stop offset="1" stopColor="#5d4f94" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id={foot} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0.7" stopColor="#5d4f94" stopOpacity="0" />
          <stop offset="1" stopColor="#5d4f94" stopOpacity="0.16" />
        </linearGradient>
        <radialGradient id={shine} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={floor} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#8873cf" stopOpacity="0.38" />
          <stop offset="1" stopColor="#8873cf" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse className="ghost-floor" cx="100" cy="240" rx="70" ry="8" fill={`url(#${floor})`} />

      <g className="ghost-body">
        {[body, side, foot].map((fill) => (
          <path key={fill} d={POSES[0]} fill={`url(#${fill})`}>
            {!still && (
              <animate
                attributeName="d"
                dur="3.6s"
                repeatCount="indefinite"
                calcMode="spline"
                keyTimes="0;0.33;0.66;1"
                keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"
                values={`${POSES[0]};${POSES[1]};${POSES[2]};${POSES[0]}`}
              />
            )}
          </path>
        ))}
        {light === 'warm' && (
          <ellipse
            cx="68"
            cy="50"
            rx="30"
            ry="18"
            fill={`url(#${shine})`}
            transform="rotate(-32 68 50)"
          />
        )}
        {eyes === 'happy' ? (
          <g fill="none" stroke="#151214" strokeWidth="6" strokeLinecap="round">
            <path d="M66 104 Q78 92 90 104" />
            <path d="M110 104 Q122 92 134 104" />
          </g>
        ) : (
          <g className="ghost-eyes">
            <g className="ghost-eye">
              <ellipse cx="78" cy="104" rx="10.5" ry="15" fill="#151214" />
              <circle cx={eyes === 'right' ? 81 : 74.6} cy="97.5" r="3.3" fill="#fff" />
            </g>
            <g className="ghost-eye">
              <ellipse cx="122" cy="104" rx="10.5" ry="15" fill="#151214" />
              <circle cx={eyes === 'right' ? 125 : 118.6} cy="97.5" r="3.3" fill="#fff" />
            </g>
          </g>
        )}
      </g>
    </svg>
  );
}

const RIM = { right: 'translate(5 -3)', left: 'translate(-6 -2)', top: 'translate(0 -6)' };

/* The ghost back-lit by a screen: a dark body with a violet rim on the side
   facing the light. `soft` is the same shot thrown out of focus, for a
   crossfaded focus pull (the blur is never animated). */
export function GhostSilhouette({
  className,
  soft,
  rim = 'right',
}: {
  className?: string;
  soft?: boolean;
  rim?: keyof typeof RIM;
}) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      className={`ghost-silhouette ${className ?? ''}`}
      viewBox="0 0 200 250"
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <filter id={`rim-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
        {soft && (
          <filter id={`soft-${id}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        )}
      </defs>
      <g filter={soft ? `url(#soft-${id})` : undefined}>
        <path
          d={POSES[0]}
          transform={RIM[rim]}
          fill="#b9a8ff"
          opacity="0.85"
          filter={`url(#rim-${id})`}
        />
        <path d={POSES[0]} fill="#09080b" />
      </g>
    </svg>
  );
}
