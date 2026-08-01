import { useRef, useEffect } from 'react';

export default function EpisodeSelector({ totalEpisodes, currentEpisode, onEpisodeChange }) {
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
    ranges.push({ start: rStart, end: rEnd, label: `${rStart} - ${rEnd}` });
  }

  useEffect(() => {
    if (!gridRef.current) return;
    const btn = gridRef.current.querySelector(`[data-ep="${currentEpisode}"]`);
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [currentEpisode]);

  return (
    <div className="space-y-3">
      {totalRanges > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {ranges.map((range, idx) => (
            <button
              key={idx}
              className={`flex-none px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-300 ${
                currentRange === idx
                  ? 'bg-[var(--accent)] text-white shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                  : 'bg-white/[0.04] text-[var(--text-muted)] hover:bg-white/[0.08] hover:text-white border border-white/[0.06]'
              }`}
              onClick={() => onEpisodeChange(range.start)}
            >
              {range.label}
            </button>
          ))}
        </div>
      )}

      <div ref={gridRef} className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5 max-h-[280px] overflow-y-auto pr-1 scrollbar-hide">
        {Array.from({ length: end - start + 1 }, (_, i) => {
          const ep = start + i;
          return (
            <button
              key={ep}
              data-ep={ep}
              className={`py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                currentEpisode === ep
                  ? 'bg-[var(--accent)] text-white shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                  : 'bg-white/[0.03] text-[var(--text-muted)] hover:bg-white/[0.08] hover:text-white border border-white/[0.04] hover:border-white/[0.1]'
              }`}
              onClick={() => onEpisodeChange(ep)}
            >
              {ep}
            </button>
          );
        })}
      </div>
    </div>
  );
}
