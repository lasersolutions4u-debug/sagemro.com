import { useId } from 'react';

export function BrandMark({ className = '', title = 'SAGEMRO' }) {
  const idBase = useId().replace(/:/g, '');
  const gradientId = `${idBase}-sagemro-mark-bg`;
  const beamId = `${idBase}-sagemro-mark-beam`;

  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="4" y="4" width="56" height="56" rx="16" fill={`url(#${gradientId})`} />
      <path d="M15 46.5h34l-5.4 7.5H20.4L15 46.5Z" fill="#fff7d6" opacity="0.96" />
      <path d="M17.8 46.5h28.4" stroke="#2a1a0a" strokeWidth="2.4" strokeLinecap="round" opacity="0.42" />
      <path d="M24 13h16l2.8 16.3-7.4 8.7h-6.8l-7.4-8.7L24 13Z" fill="#fff7d6" stroke="#ffffff" strokeWidth="1.2" />
      <path d="M26.2 15.5h11.6l1.9 11.4-5.9 6.7h-3.6l-5.9-6.7 1.9-11.4Z" fill="#2a1a0a" opacity="0.18" />
      <path d="M18 13h28" stroke="#fff7d6" strokeWidth="4.2" strokeLinecap="round" />
      <path d="M19.5 13h25" stroke="#2a1a0a" strokeWidth="1.6" strokeLinecap="round" opacity="0.35" />
      <path d="M29 38h6l2.2 6.8H26.8L29 38Z" fill="#2a1a0a" opacity="0.72" />
      <path d="M32 40.5v9.5" stroke={`url(#${beamId})`} strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="32" cy="50" r="2.2" fill="#fff7d6" />
      <path d="M45.5 23.5l4 4 4-6" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
      <defs>
        <linearGradient id={gradientId} x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D" />
          <stop offset="0.5" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#92400E" />
        </linearGradient>
        <linearGradient id={beamId} x1="32" y1="40.5" x2="32" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#fef3c7" />
        </linearGradient>
      </defs>
    </svg>
  );
}
