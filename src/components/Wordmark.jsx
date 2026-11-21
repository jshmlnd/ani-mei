// Animei wordmark set in the world's dot type: "ani" in ink, "mei" in bead pink.
export default function Wordmark({ className = 'text-2xl' }) {
  return (
    <span className={`inline-flex items-baseline leading-none select-none ${className}`}>
      <span className="text-[var(--r7)]">ani</span>
      <span className="text-[var(--accent)]">mei</span>
    </span>
  );
}
