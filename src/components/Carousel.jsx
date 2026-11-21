import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { TextureCard } from '@/components/ui/texture-card';

// Spotlight: a boxed panel, the poster pinned in a dotted bead frame at left,
// details at right, and a separate bead row as the pager.
export default function Carousel({ items, interval = 7000, imageFor, renderContent, aside, className = '' }) {
  const [index, setIndex] = useState(0);
  const count = items.length;

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), interval);
    return () => clearInterval(t);
  }, [count, interval]);

  if (!count) return null;
  const current = items[index];
  const key = current.id ?? current.slug ?? index;
  const poster = imageFor
    ? imageFor(current, index)
    : current.coverImage?.extraLarge || current.coverImage?.large || current.poster || current.image || current.bannerImage;

  const pagerButton = 'w-11 h-11 hidden sm:flex items-center justify-center bg-[var(--r2)] border-2 border-[var(--r0)] text-[var(--r6)] hover:text-[var(--r0)] hover:bg-[var(--accent)] transition-colors duration-100';

  return (
    <section className={`max-w-7xl mx-auto px-4 sm:px-6 pt-4 ${className}`} aria-roledescription="carousel">
      <div className={aside ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]' : ''}>
      <TextureCard>
        {/* Phones stack the poster above the text so the copy gets the full width. */}
        <div className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)] md:grid-cols-[220px_minmax(0,1fr)] gap-4 sm:gap-8 p-4 sm:p-6 md:p-8">
          <div className="w-32 sm:w-auto self-start aspect-[3/4] border-4 border-dotted border-[var(--accent)] bg-[var(--r1)] overflow-hidden">
            {poster && (
              <img
                key={key}
                src={poster}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover animate-fade-in"
              />
            )}
          </div>
          <div className="min-w-0 flex flex-col justify-center" key={key}>
            {renderContent(current)}
          </div>
        </div>
      </TextureCard>
      {aside}
      </div>

      {count > 1 && (
        <div className="mt-3 flex items-center justify-center sm:justify-between gap-3">
          <button onClick={() => setIndex((index - 1 + count) % count)} aria-label="Previous slide" className={pagerButton}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-wrap items-center justify-center gap-1">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                className="bead-peg p-1.5"
              >
                <span className={`bead ${i === index ? 'bead-lit' : 'bead-hollow'}`} />
              </button>
            ))}
          </div>
          <button onClick={() => setIndex((index + 1) % count)} aria-label="Next slide" className={pagerButton}>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </section>
  );
}
