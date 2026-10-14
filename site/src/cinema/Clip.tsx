import { forwardRef, type CSSProperties } from 'react';

/* A real screen recording cropped to the app itself, with no browser chrome.
   The crop is done in CSS: the video sits inside a frame the size of the app
   area and is offset so only that area shows, so nothing is re-encoded. A
   still of the same crop holds the frame until the video plays. */

export type Footage = {
  src: string;
  size: readonly [number, number];
  crop: readonly [number, number, number, number];
  /* The stretch of the recording that shows the app (seconds). */
  range: readonly [number, number];
  still: string;
  glow: string;
};

export const FOOTAGE = {
  messenger: {
    src: '/media/messenger-hide-seen',
    size: [864, 782],
    crop: [392, 98, 440, 668],
    range: [4.2, 16.6],
    still: '/media/messenger-chat.webp',
    glow: '/media/messenger-chat-glow.webp',
  },
  instagram: {
    src: '/media/instagram-hide-story',
    size: [859, 782],
    crop: [231, 98, 379, 673],
    range: [3.1, 12.8],
    still: '/media/instagram-story.webp',
    glow: '/media/instagram-story-glow.webp',
  },
  facebook: {
    src: '/media/facebook-hide-story',
    size: [844, 782],
    crop: [253, 93, 349, 621],
    range: [4.1, 9.8],
    still: '/media/facebook-story.webp',
    glow: '/media/facebook-story-glow.webp',
  },
} satisfies Record<string, Footage>;

export function aspect(f: Footage) {
  return `${f.crop[2]} / ${f.crop[3]}`;
}

type Props = {
  footage: Footage;
  label: string;
  className?: string;
  style?: CSSProperties;
  /* Without `play`, the clip is the still alone. */
  play?: boolean;
};

export const Clip = forwardRef<HTMLVideoElement, Props>(function Clip(
  { footage: f, label, className, style, play },
  ref,
) {
  const [W, H] = f.size;
  const [x, y, w, h] = f.crop;
  return (
    <div
      className={`clip ${className ?? ''}`}
      role="img"
      aria-label={label}
      style={{ ...style, aspectRatio: aspect(f), backgroundImage: `url(${f.still})` }}
    >
      {play && (
        <video
          ref={ref}
          data-src={`${f.src}.webm`}
          data-src-mp4={`${f.src}.mp4`}
          data-in={f.range[0]}
          data-out={f.range[1]}
          muted
          playsInline
          preload="none"
          aria-hidden="true"
          style={{
            width: `${(W / w) * 100}%`,
            height: `${(H / h) * 100}%`,
            left: `${(-x / w) * 100}%`,
            top: `${(-y / h) * 100}%`,
          }}
        />
      )}
    </div>
  );
});

/* Gives a clip its source and wires its range; nothing plays yet. */
function load(v: HTMLVideoElement) {
  if (v.getAttribute('src')) return;
  const webm = v.canPlayType('video/webm; codecs="vp9"') || v.canPlayType('video/webm');
  v.src = webm ? v.dataset.src! : v.dataset.srcMp4!;
  const start = Number(v.dataset.in);
  const end = Number(v.dataset.out);
  v.addEventListener('loadedmetadata', () => (v.currentTime = start), { once: true });
  v.addEventListener('playing', () => v.classList.add('is-playing'));
  v.addEventListener('timeupdate', () => {
    if (v.currentTime >= end || v.currentTime < start - 0.5) v.currentTime = start;
  });
}

/* Starts fetching the next shot's clip so it is ready when its shot starts. */
export function primeClip(v: HTMLVideoElement | null) {
  if (!v || v.getAttribute('src')) return;
  v.preload = 'auto';
  load(v);
}

/* Plays a clip's video at its own speed within its range, from the top of
   the range when `restart`; pauses it otherwise. Loads it on first use. */
export function runClip(v: HTMLVideoElement | null, on: boolean, restart = false) {
  if (!v) return;
  if (!on) {
    if (!v.paused) v.pause();
    return;
  }
  load(v);
  if (restart && v.readyState >= 1) v.currentTime = Number(v.dataset.in);
  if (v.paused) v.play().catch(() => {});
}
