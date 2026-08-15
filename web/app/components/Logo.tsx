export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <circle cx="20" cy="19" r="10.5" stroke="currentColor" strokeWidth="2.4" />
      <path d="M26.5 25.5 L33 32" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M29.5 28.5 L33.5 32.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 22.5 L18 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
