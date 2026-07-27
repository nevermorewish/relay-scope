import type { SVGProps } from 'react';

export function RelayScopeLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <defs>
        <linearGradient id="relay-scope-surface" x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4776F4" />
          <stop offset="0.52" stopColor="#635BEB" />
          <stop offset="1" stopColor="#804FD8" />
        </linearGradient>
        <linearGradient id="relay-scope-shine" x1="14" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.26" />
          <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="17" fill="url(#relay-scope-surface)" />
      <rect x="3" y="3" width="58" height="58" rx="16" fill="none" stroke="url(#relay-scope-shine)" strokeWidth="2" />
      <path
        d="M14 33h8l4.5-12 7 25 6.5-18 4 5h6"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="33" r="3" fill="#FFFFFF" />
      <circle cx="50" cy="33" r="3" fill="#FFFFFF" />
    </svg>
  );
}
