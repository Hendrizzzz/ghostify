import { useId } from 'react';

export type MetaPlatform = 'instagram' | 'messenger' | 'facebook';

/* The current official marks, drawn inline: the Instagram gradient glyph
   (2022 gradient), the Messenger bubble and bolt (2020 gradient), and the
   Facebook circle "f" (2023 blue). Decorative: callers name the platform. */
export function PlatformLogo({
  platform,
  size = 24,
  className,
}: {
  platform: MetaPlatform;
  size?: number;
  className?: string;
}) {
  const gradientId = `${platform}-${useId().replace(/:/g, '')}`;

  if (platform === 'instagram') {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={gradientId} cx="5" cy="25" r="27" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffd600" />
            <stop offset="0.25" stopColor="#ff7a00" />
            <stop offset="0.5" stopColor="#ff0069" />
            <stop offset="0.75" stopColor="#d300c5" />
            <stop offset="1" stopColor="#7638fa" />
          </radialGradient>
        </defs>
        <rect
          x="2.5"
          y="2.5"
          width="19"
          height="19"
          rx="5.4"
          stroke={`url(#${gradientId})`}
          strokeWidth="2"
        />
        <circle cx="12" cy="12" r="4.4" stroke={`url(#${gradientId})`} strokeWidth="2" />
        <circle cx="17.35" cy="6.65" r="1.3" fill={`url(#${gradientId})`} />
      </svg>
    );
  }

  if (platform === 'messenger') {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 800 800"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={gradientId} cx="150" cy="800" r="880" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0099ff" />
            <stop offset="0.6" stopColor="#a033ff" />
            <stop offset="0.9" stopColor="#ff5280" />
            <stop offset="1" stopColor="#ff7061" />
          </radialGradient>
        </defs>
        <path
          d="M400 0C174.7 0 0 165.1 0 388c0 116.6 47.8 217.4 125.6 287 6.5 5.8 10.5 14 10.7 22.8l2.2 71.2a32 32 0 0 0 44.9 28.3l79.4-35c6.7-3 14.3-3.5 21.4-1.6 36.5 10 75.3 15.4 115.8 15.4 225.3 0 400-165.1 400-388S625.3 0 400 0Z"
          fill={`url(#${gradientId})`}
        />
        <path
          d="m159.8 501.5 117.5-186.4a60 60 0 0 1 86.8-16l93.5 70.1a24 24 0 0 0 28.9-.1l126.2-95.8c16.8-12.8 38.8 7.4 27.6 25.3L522.7 484.9a60 60 0 0 1-86.8 16l-93.5-70.1a24 24 0 0 0-28.9.1l-126.2 95.8c-16.8 12.8-38.8-7.3-27.5-25.2Z"
          fill="#fff"
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="11.6" fill="#fff" />
      <path
        d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"
        fill="#0866ff"
      />
    </svg>
  );
}
