import { useId } from 'react';

export type MetaPlatform = 'instagram' | 'messenger' | 'facebook';

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
        role="img"
        aria-label="Instagram"
      >
        <defs>
          <radialGradient id={gradientId} cx="30%" cy="107%" r="120%">
            <stop offset="0" stopColor="#fdf497" />
            <stop offset="0.08" stopColor="#fdf497" />
            <stop offset="0.42" stopColor="#fd5949" />
            <stop offset="0.66" stopColor="#d6249f" />
            <stop offset="1" stopColor="#285aeb" />
          </radialGradient>
        </defs>
        <rect width="24" height="24" rx="6.25" fill={`url(#${gradientId})`} />
        <path
          fill="white"
          fillRule="evenodd"
          d="M7.8 3.1h8.4c2.59 0 4.7 2.11 4.7 4.7v8.4c0 2.59-2.11 4.7-4.7 4.7H7.8a4.71 4.71 0 0 1-4.7-4.7V7.8c0-2.59 2.11-4.7 4.7-4.7Zm-.15 1.9A2.66 2.66 0 0 0 5 7.65v8.7A2.66 2.66 0 0 0 7.65 19h8.7A2.66 2.66 0 0 0 19 16.35v-8.7A2.66 2.66 0 0 0 16.35 5h-8.7Zm9.55 1.43a1.17 1.17 0 1 0 0 2.34 1.17 1.17 0 0 0 0-2.34ZM12 7.36A4.64 4.64 0 1 0 12 16.64 4.64 4.64 0 0 0 12 7.36Zm0 1.9a2.74 2.74 0 1 1 0 5.48 2.74 2.74 0 0 1 0-5.48Z"
        />
      </svg>
    );
  }

  if (platform === 'messenger') {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        role="img"
        aria-label="Messenger"
      >
        <defs>
          <linearGradient id={gradientId} x1="7" y1="29" x2="25" y2="3" gradientUnits="userSpaceOnUse">
            <stop stopColor="#006aff" />
            <stop offset="0.48" stopColor="#00b2ff" />
            <stop offset="1" stopColor="#a033ff" />
          </linearGradient>
        </defs>
        <path
          d="M16 3.1C8.54 3.1 3 8.23 3 15.15c0 3.73 1.6 6.98 4.28 9.14v4.43c0 .78.83 1.27 1.5.89l3.85-2.22c1.09.27 2.22.41 3.37.41 7.46 0 13-5.13 13-12.65S23.46 3.1 16 3.1Z"
          fill={`url(#${gradientId})`}
        />
        <path d="m8.65 19.1 5.2-5.52 3.7 3.81 5.82-5.98-5.2 8.54-3.81-3.81-5.71 2.96Z" fill="white" />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="Facebook"
    >
      <circle cx="16" cy="16" r="14" fill="#1877f2" />
      <path
        d="M18.16 29V18.94h3.38l.51-3.93h-3.89v-2.52c0-1.14.32-1.92 1.96-1.92h2.09V7.04c-.36-.05-1.61-.16-3.05-.16-3.01 0-5.08 1.84-5.08 5.22v2.91h-3.41v3.93h3.41V29h4.08Z"
        fill="white"
      />
    </svg>
  );
}
