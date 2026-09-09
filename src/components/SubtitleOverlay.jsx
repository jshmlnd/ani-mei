import { useMemo } from 'react';
import { findActiveCues } from '../utils/vtt';

function renderSegments(segments) {
  return segments.map((s, i) => {
    const className = [
      s.italic ? 'italic text-[var(--accent)]' : '',
      s.bold ? 'font-bold' : '',
      s.underline ? 'underline' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <span key={i} className={className || undefined}>
        {s.text}
      </span>
    );
  });
}

// Custom-rendered subtitle overlay. Draws parsed WebVTT cues as styled DOM
// instead of relying on the browser's native cue renderer, giving full
// control over look and positioning. Syncs off the player's currentTime.
export default function SubtitleOverlay({ cues, currentTime }) {
  const active = useMemo(() => findActiveCues(cues, currentTime), [cues, currentTime]);
  if (!active.length) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-20 z-10 flex flex-col items-center gap-1.5 px-6 text-center">
      {active.map((cue, ci) => (
        <div
          key={`${cue.start}-${ci}`}
          className="animate-fade-in rounded-xl bg-black/65 px-4 py-1.5 backdrop-blur-[2px]"
          style={{
            animationDuration: '0.18s',
            textAlign: cue.align === 'left' ? 'left' : cue.align === 'right' ? 'right' : 'center',
          }}
        >
          {cue.lines.map((line, li) => (
            <div
              key={li}
              className="text-[clamp(14px,2.4vw,22px)] font-bold leading-snug text-white"
              style={{
                textShadow:
                  '0 1px 3px rgba(0,0,0,0.9), 0 0 14px rgba(0,0,0,0.65)',
              }}
            >
              {renderSegments(line)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
