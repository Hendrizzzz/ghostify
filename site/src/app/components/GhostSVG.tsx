import { useId } from 'react';
import type { CSSProperties } from 'react';

interface GhostSVGProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  eyeColor?: string;
  bodyColor?: string;
}

const GHOST_PATH = 'M24 108V54c0-23.2 16.8-40 40-40s40 16.8 40 40v54c0 4.8-5.5 7.5-9.4 4.6l-9.1-6.8-9.1 6.8a7 7 0 0 1-8.4 0l-4-3-4 3a7 7 0 0 1-8.4 0l-9.1-6.8-9.1 6.8c-3.9 2.9-9.4.2-9.4-4.6Z';
const EYES_PATH = 'M44 60c0-8.8 4.1-15 10-15s10 6.2 10 15-4.1 15-10 15-10-6.2-10-15Zm30 0c0-8.8 4.1-15 10-15s10 6.2 10 15-4.1 15-10 15-10-6.2-10-15Z';
const HIGHLIGHT_PATH = 'M37 38c6.3-9 16-13.7 28.1-13.7 2.2 0 3.9 1.8 3.9 4s-1.8 3.8-4 3.8c-9.3 0-16.7 3.6-21.5 10.5a4 4 0 0 1-6.5-4.6Z';

export function GhostSVG({
  size = 64,
  className = '',
  style,
  eyeColor = '#161314',
  bodyColor = '#F6F1EA',
}: GhostSVGProps) {
  const uid = useId().replace(/:/g, '');
  const bodyGradient = `gs_body_${uid}`;
  const sheen = `gs_sheen_${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id={bodyGradient} x1="34" y1="20" x2="94" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFDF8" />
          <stop offset="52%" stopColor={bodyColor} />
          <stop offset="100%" stopColor="#E6DDD2" />
        </linearGradient>
        <radialGradient id={sheen} cx="42%" cy="26%" r="55%">
          <stop offset="0%" stopColor="white" stopOpacity="0.26" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>

      <path fill="#0B0A08" fillOpacity={0.09} transform="translate(0 4)" d={GHOST_PATH} />
      <path fill={`url(#${bodyGradient})`} stroke="rgba(11,11,12,0.12)" strokeWidth={2} strokeLinejoin="round" d={GHOST_PATH} />
      <path fill={`url(#${sheen})`} d={GHOST_PATH} />
      <path fill={eyeColor} d={EYES_PATH} />
      <path fill="white" fillOpacity={0.45} d={HIGHLIGHT_PATH} />
    </svg>
  );
}

export function GhostMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path fill="#F6F1EA" d={GHOST_PATH} />
      <path fill="#161314" d={EYES_PATH} />
      <path fill="white" fillOpacity={0.45} d={HIGHLIGHT_PATH} />
    </svg>
  );
}
