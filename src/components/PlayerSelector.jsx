import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MonitorPlay, ChevronDown } from 'lucide-react';

const PLAYERS = [
  { id: 'hlsjs', label: 'HLS.js', description: 'Custom player' },
  { id: 'plyr', label: 'Plyr', description: 'Modern & lightweight' },
  { id: 'videojs', label: 'video.js', description: 'Feature-rich' },
  { id: 'shaka', label: 'Shaka', description: 'Google player' },
];

export default function PlayerSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const ref = useRef(null);

  const stopPropagation = useCallback((e) => e.stopPropagation(), []);

  const positionMenu = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      zIndex: 99999,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    positionMenu();
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleScroll = () => setOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, positionMenu]);

  const current = PLAYERS.find((p) => p.id === value) || PLAYERS[0];

  return (
    <div ref={ref} className="relative" onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white/70 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] rounded-lg border border-white/[0.08] transition-all duration-200"
        title="Switch video player"
      >
        <MonitorPlay className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          className="w-48 bg-[var(--bg-surface)] rounded-xl shadow-2xl shadow-black/50 border border-white/[0.08] overflow-hidden animate-fade-in"
          style={{ ...menuStyle, animationDuration: '0.15s' }}
          onMouseDown={stopPropagation}
          onTouchStart={stopPropagation}
        >
          <div className="p-1">
            {PLAYERS.map((player) => (
              <button
                key={player.id}
                onClick={(e) => { e.stopPropagation(); onChange(player.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${
                  value === player.id
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span className="font-medium">{player.label}</span>
                <span className="block text-[10px] text-[var(--text-muted)] mt-0.5">{player.description}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
