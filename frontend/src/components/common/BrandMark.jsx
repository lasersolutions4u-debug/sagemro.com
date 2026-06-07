import { useId } from 'react';

export function BrandMark({ className = '', title = 'SAGEMRO' }) {
  const gradientId = `${useId().replace(/:/g, '')}-sagemro-mark-bg`;

  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="4" y="4" width="56" height="56" rx="17" fill={`url(#${gradientId})`} />
      <g opacity="0.96">
        <rect x="29" y="10" width="6" height="10" rx="2.2" fill="#fff7d6" transform="rotate(0 32 32)" />
        <rect x="29" y="10" width="6" height="10" rx="2.2" fill="#fff7d6" transform="rotate(45 32 32)" />
        <rect x="29" y="10" width="6" height="10" rx="2.2" fill="#fff7d6" transform="rotate(90 32 32)" />
        <rect x="29" y="10" width="6" height="10" rx="2.2" fill="#fff7d6" transform="rotate(135 32 32)" />
        <rect x="29" y="10" width="6" height="10" rx="2.2" fill="#fff7d6" transform="rotate(180 32 32)" />
        <rect x="29" y="10" width="6" height="10" rx="2.2" fill="#fff7d6" transform="rotate(225 32 32)" />
        <rect x="29" y="10" width="6" height="10" rx="2.2" fill="#fff7d6" transform="rotate(270 32 32)" />
        <rect x="29" y="10" width="6" height="10" rx="2.2" fill="#fff7d6" transform="rotate(315 32 32)" />
      </g>
      <circle cx="32" cy="32" r="18.2" fill="rgba(255,255,255,0.16)" stroke="#ffffff" strokeWidth="3.2" />
      <path
        d="M32 21.5 41.1 26.7v10.6L32 42.5l-9.1-5.2V26.7L32 21.5Z"
        fill="rgba(146,64,14,0.32)"
        stroke="#fff7d6"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="4.6" fill="#fff7d6" />
      <path d="M46 16.5v5.2M43.4 19.1h5.2" stroke="#fff7d6" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="46.7" cy="27.2" r="1.9" fill="#ffffff" />
      <defs>
        <linearGradient id={gradientId} x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBBF24" />
          <stop offset="0.52" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#92400E" />
        </linearGradient>
      </defs>
    </svg>
  );
}
