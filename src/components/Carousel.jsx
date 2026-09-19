import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Carousel({ items, interval = 7000, imageFor, renderContent, className = '' }) {
  const [index, setIndex] = useState(0);
  const count = items.length;

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), interval);
    return () => clearInterval(t);
  }, [count, interval]);

  if (!count) return null;
  const current = items[index];

  const backdrop = (item, i) =>
    imageFor ? imageFor(item, i) : item.bannerImage || item.coverImage?.large || item.poster || item.image;

  return (
    <div className={`relative w-full h-[62vh] min-h-[440px] max-h-[640px] overflow-hidden ${className}`}>
      {items.map((item, i) => (
        <div
          key={item.id ?? item.slug ?? i}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === index ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
        >
          <img
            src={backdrop(item, i)}
            alt=""
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover ${i === index ? 'animate-ken-burns' : ''}`}
            loading={i === 0 ? 'eager' : 'lazy'}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-deep)] via-[var(--bg-deep)]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-deep)] via-transparent to-[var(--bg-deep)]/50" />
          <div className="absolute inset-0 bg-[var(--accent)]/[0.03]" />
        </div>
      ))}

      <div className="absolute inset-0 z-20 flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-xl" key={current.id ?? current.slug ?? index}>
            {renderContent(current)}
          </div>
        </div>
      </div>

      {count > 1 && (
        <>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`transition-all duration-500 rounded-full ${
                  i === index ? 'w-8 h-2.5 bg-[var(--accent)]' : 'w-2.5 h-2.5 bg-white/20 hover:bg-[var(--accent)]/40'
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => setIndex((index - 1 + count) % count)}
            aria-label="Previous slide"
            className="absolute left-5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 flex items-center justify-center rounded-full glass-panel-light hover:bg-[var(--accent)]/[0.1] text-white/50 hover:text-[var(--accent)] transition-all duration-300 hover:scale-110"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIndex((index + 1) % count)}
            aria-label="Next slide"
            className="absolute right-5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 flex items-center justify-center rounded-full glass-panel-light hover:bg-[var(--accent)]/[0.1] text-white/50 hover:text-[var(--accent)] transition-all duration-300 hover:scale-110"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
}