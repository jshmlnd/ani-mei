import { useRef, useEffect } from 'react';

// Bead strip: every episode is a bead on the peg row. Episodes Jimei has
// opened are filled pink, the one playing is lit, the rest are hollow.
export default function EpisodeSelector({ totalEpisodes, currentEpisode, onEpisodeChange, seen = [] }) {
  const seenSet = new Set(seen);
  const episodesPerRange = 100;
  const totalRanges = Math.ceil(totalEpisodes / episodesPerRange);
  const currentRange = Math.floor((currentEpisode - 1) / episodesPerRange);
  const start = currentRange * episodesPerRange + 1;
  const end = Math.min(start + episodesPerRange - 1, totalEpisodes);
  const gridRef = useRef(null);

  const ranges = [];
  for (let i = 0; i < totalRanges; i++) {
    const rStart = i * episodesPerRange + 1;
    const rEnd = Math.min(rStart + episodesPerRange - 1, totalEpisodes);
    ranges.push({ start: rStart, end: rEnd, label: `${rStart}–${rEnd}` });
  }

  useEffect(() => {
    if (!gridRef.current) return;
    // Scroll only the bead grid, never the page, so the player stays in view.
    const grid = gridRef.current;
    const btn = grid.querySelector(`[data-ep="${currentEpisode}"]`);
    if (btn) grid.scrollTo({ top: btn.offsetTop - grid.clientHeight / 2, behavior: 'smooth' });
  }, [currentEpisode]);

  return (
    <div className="space-y-3">
      {totalRanges > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label="Episode ranges">
          {ranges.map((range, idx) => (
            <button
              key={idx}
              role="tab"
              aria-selected={currentRange === idx}
              className={`flex-none px-3 py-1 text-sm tabular border-2 transition-colors duration-100 ${
                currentRange === idx
                  ? 'bg-[var(--accent)] text-[var(--r0)] border-[var(--r0)]'
                  : 'bg-[var(--r3)] text-[var(--r6)] border-[var(--r0)] hover:text-[var(--r7)] hover:bg-[var(--r4)]'
              }`}
              onClick={() => onEpisodeChange(range.start)}
            >
              {range.label}
            </button>
          ))}
        </div>
      )}

      <div
        ref={gridRef}
        className="relative grid grid-cols-8 sm:grid-cols-10 md:grid-cols-[repeat(14,minmax(0,1fr))] gap-y-2 max-h-[300px] overflow-y-auto pr-1"
      >
        {Array.from({ length: end - start + 1 }, (_, i) => {
          const ep = start + i;
          const state = ep === currentEpisode ? 'lit' : seenSet.has(ep) ? 'seen' : 'hollow';
          return (
            <button
              key={ep}
              data-ep={ep}
              aria-label={`Episode ${ep}${state === 'seen' ? ', opened' : ''}`}
              aria-current={state === 'lit' ? 'true' : undefined}
              className="bead-peg group flex flex-col items-center gap-1 py-1.5 cursor-pointer"
              onClick={() => onEpisodeChange(ep)}
            >
              <span
                className={`bead ${state === 'lit' ? 'bead-lit animate-bead-place' : state === 'seen' ? '' : 'bead-hollow'}`}
              />
              <span
                className={`text-xs tabular ${
                  state === 'lit' ? 'text-[var(--accent)]' : 'text-[var(--r5)] group-hover:text-[var(--r7)]'
                }`}
              >
                {ep}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
