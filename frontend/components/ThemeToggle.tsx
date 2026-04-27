export default function ThemeToggle() {
  return (
    <button
      type="button"
      data-theme-toggle="true"
      aria-label="Toggle theme"
      title="Toggle theme"
      className="relative z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition-colors hover:bg-[var(--soft-bg-hover)]"
      style={{ borderColor: 'var(--line)', background: 'var(--panel-strong)', color: 'var(--muted)' }}
    >
      <ThemeIcon className="h-4 w-4" />
    </button>
  )
}

function ThemeIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.25" />
      <path d="M12 19.25v2.25" />
      <path d="m5.28 5.28 1.6 1.6" />
      <path d="m17.12 17.12 1.6 1.6" />
      <path d="M2.5 12h2.25" />
      <path d="M19.25 12h2.25" />
      <path d="m5.28 18.72 1.6-1.6" />
      <path d="m17.12 6.88 1.6-1.6" />
    </svg>
  )
}
