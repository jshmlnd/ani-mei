export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-3 border-[var(--accent)]/20 border-t-[var(--accent)] animate-spin" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-3 border-transparent border-b-[var(--accent-deep)]/30 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
      </div>
      <p className="text-xs text-[var(--text-muted)] font-semibold">Loading...</p>
    </div>
  );
}
