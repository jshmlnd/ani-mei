// Read-only bead strip: opened episodes filled pink, current lit, the rest hollow.
// Long shows fold into at most `max` beads, each standing for a run of episodes.
export default function BeadStrip({ total, current, seen = [], max = 28, className = '' }) {
  if (!total) return null;
  const per = Math.ceil(total / max);
  const beads = Math.ceil(total / per);
  const seenSet = new Set(seen);
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} aria-hidden="true">
      {Array.from({ length: beads }, (_, i) => {
        const from = i * per + 1;
        const to = Math.min(total, from + per - 1);
        const isCurrent = current >= from && current <= to;
        const isSeen = !isCurrent && [...Array(to - from + 1)].some((_, k) => seenSet.has(from + k));
        return (
          <span
            key={i}
            className={`bead ${isCurrent ? 'bead-lit' : isSeen ? '' : 'bead-hollow'}`}
            style={{ '--b': '12px' }}
          />
        );
      })}
    </div>
  );
}
