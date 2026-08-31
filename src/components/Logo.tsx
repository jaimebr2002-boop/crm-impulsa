export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="block shrink-0">
      <defs>
        <linearGradient id="impulsa-logo-gradient" x1="0" y1="32" x2="32" y2="0">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="32" height="32" rx="9" fill="url(#impulsa-logo-gradient)" />
      <rect x="7" y="17" width="4.2" height="8" rx="2" fill="white" opacity="0.95" />
      <rect x="13.4" y="12" width="4.2" height="13" rx="2" fill="white" opacity="0.95" />
      <rect x="19.8" y="7" width="4.2" height="18" rx="2" fill="white" />
    </svg>
  );
}
