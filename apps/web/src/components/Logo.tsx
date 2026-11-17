export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="Flota Segura GPS">
      <rect width="512" height="512" rx="112" fill="#0B4F59" />
      <path d="M256 92c-70 0-126 55-126 124 0 92 126 204 126 204s126-112 126-204c0-69-56-124-126-124z" fill="#fff" />
      <path d="M256 150l-62 26v46c0 40 26 74 62 86 36-12 62-46 62-86v-46z" fill="#0B4F59" />
      <path d="M233 226l17 17 33-35" stroke="#22D3EE" strokeWidth="18" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
