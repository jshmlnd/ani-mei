// Loading: five beads drop onto the peg row one after another.
export default function LoadingSpinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4" role="status">
      <div className="flex items-end gap-2 h-6" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="bead bead-drop" style={{ animationDelay: `${i * 0.16}s` }} />
        ))}
      </div>
      <p className="text-sm text-[var(--r5)]">{label}</p>
    </div>
  );
}
