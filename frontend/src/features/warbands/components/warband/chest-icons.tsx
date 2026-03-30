export function ChestClosedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="12" width="20" height="9" rx="1" />
      <rect x="2" y="5" width="20" height="7" rx="2" />
      <rect x="10" y="10.5" width="4" height="3" rx="1" />
    </svg>
  );
}

export function ChestOpenIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="12" width="20" height="9" rx="1" />
      <path d="M2 12 L4 4 L20 4 L22 12" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}
