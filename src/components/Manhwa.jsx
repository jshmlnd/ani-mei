import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getManhwaLatest,
  getManhwaTrending,
  getManhwaPopular,
  getManhwaCollections,
  getTitleForId,
  getChaptersForTitle,
  chapterLabel,
} from '../api/manhwaService';
import LoadingSpinner from './LoadingSpinner';
import {
  BookOpen,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ImageIcon,
  Clock,
  Tag,
  Sparkles,
  Check,
  ListOrdered,
  ExternalLink,
} from 'lucide-react';

const PER_PAGE = 24;
const SOURCE_DOWN_MSG =
  'The manhwa source is currently unreachable. Loaded titles will appear here once it is back online.';

/* ---------- Horizontal scroll row ---------- */
function HorizontalRow({ children }) {
  const scrollRef = useRef(null);
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });
  const anim = useRef({ target: null, raf: null });

  // Animated glide to an absolute scroll position (cancels any in-flight glide)
  const animateTo = (target, duration = 500) => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    target = Math.min(Math.max(target, 0), Math.max(max, 0));
    if (anim.current.raf) cancelAnimationFrame(anim.current.raf);
    anim.current.target = target;
    const start = el.scrollLeft;
    const dist = target - start;
    if (Math.abs(dist) < 1) {
      anim.current.target = null;
      anim.current.raf = null;
      return;
    }
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      el.scrollLeft = start + dist * eased;
      if (t < 1) {
        anim.current.raf = requestAnimationFrame(tick);
      } else {
        anim.current.raf = null;
        anim.current.target = null;
      }
    };
    anim.current.raf = requestAnimationFrame(tick);
  };

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const base = anim.current.target ?? el.scrollLeft;
    animateTo(base + dir * 400, 500);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    const smoothTo = (target) => {
      animateTo(target, 180);
    };

    // Vertical wheel -> smooth horizontal glide (lets the page scroll at the ends)
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      if ((e.deltaY > 0 && el.scrollLeft >= max - 1) || (e.deltaY < 0 && el.scrollLeft <= 0))
        return;
      e.preventDefault();
      const base = anim.current.target ?? el.scrollLeft;
      const next = clamp(base + e.deltaY, 0, max);
      smoothTo(next);
    };

    // Mouse drag to scroll
    const onDown = (e) => {
      if (anim.current.raf) cancelAnimationFrame(anim.current.raf);
      anim.current.target = null;
      drag.current = { down: true, startX: e.pageX, startLeft: el.scrollLeft, moved: false };
    };
    const onMove = (e) => {
      if (!drag.current.down) return;
      const dx = e.pageX - drag.current.startX;
      if (Math.abs(dx) > 5) drag.current.moved = true;
      if (drag.current.moved) el.scrollLeft = drag.current.startLeft - dx;
    };
    const onUp = () => {
      drag.current.down = false;
    };
    // Suppress card clicks after a drag
    const onClickCapture = (e) => {
      if (drag.current.moved) {
        e.preventDefault();
        e.stopPropagation();
        drag.current.moved = false;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('click', onClickCapture, true);
    return () => {
      if (anim.current.raf) cancelAnimationFrame(anim.current.raf);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  return (
    <div className="relative group/scroll">
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide cursor-grab active:cursor-grabbing select-none">
        {children}
      </div>
      <button
        type="button"
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 hover:bg-black/90 hover:scale-110"
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 hover:bg-black/90 hover:scale-110"
        onClick={() => scroll(1)}
        aria-label="Scroll right"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

/* ---------- Grid card ---------- */
export function ManhwaCard({ item, onOpen }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const load = () => {
      if (img.dataset.src) img.src = img.dataset.src;
      else setFailed(true);
    };
    if (!('IntersectionObserver' in window)) {
      load();
      return;
    }
    let done = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          done = true;
          load();
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(img);
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        load();
        observer.disconnect();
      }
    }, 1500);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return (
    <button
      onClick={() => onOpen(item.hid || item.slug || item.id)}
      className="group relative rounded-2xl overflow-hidden bg-[var(--bg-surface)] card-hover text-left"
    >
      <figure className="relative aspect-[3/4] overflow-hidden">
        {!failed ? (
          <img
            ref={imgRef}
            data-src={item.thumbnail || item.image}
            alt={item.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-[1.06] ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : null}
        {!loaded && !failed && (
          <div className="absolute inset-0 bg-[var(--bg-elevated)]">
            <div className="animate-shimmer w-full h-full" />
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 bg-[var(--bg-elevated)] flex items-center justify-center">
            <div className="text-center px-4">
              <ImageIcon className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-2" />
              <p className="text-xs text-[var(--text-muted)] line-clamp-2">{item.title}</p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        {item.description && (
          <div className="absolute bottom-0 left-0 right-0 p-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-3 group-hover:translate-y-0">
            <p className="text-xs text-white/70 line-clamp-2 leading-relaxed">
              {item.description.replace(/<[^>]*>/g, '').slice(0, 120)}
              {item.description.length > 120 ? '...' : ''}
            </p>
          </div>
        )}
        {item.type && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide bg-[var(--accent)]/20 text-[var(--accent)] backdrop-blur-md rounded-full border border-[var(--accent)]/25">
              {item.type}
            </span>
          </div>
        )}
        {item.latestChapter && (
          <div className="absolute bottom-2.5 left-2.5 z-10">
            <span className="px-2.5 py-1 text-[10px] font-bold bg-black/60 text-white/80 backdrop-blur-md rounded-full border border-white/[0.1]">
              {item.latestChapter}
            </span>
          </div>
        )}
        <div className="absolute bottom-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          <div className="w-11 h-11 flex items-center justify-center rounded-full bg-[var(--accent)] shadow-lg shadow-[var(--accent)]/30">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
        </div>
      </figure>
      <div className="p-3">
        <h3 className="text-sm font-bold text-[var(--text-primary)] leading-snug line-clamp-2 group-hover:text-[var(--accent)] transition-colors duration-300">
          {item.title}
        </h3>
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[var(--text-muted)]">
          {item.status && <span>{item.status}</span>}
          {item.status && item.updatedAt && <span className="w-0.5 h-0.5 bg-[var(--text-muted)] rounded-full" />}
          {item.updatedAt && <span className="truncate">{item.updatedAt}</span>}
        </div>
      </div>
    </button>
  );
}

/* ---------- Trending hero ---------- */
function TrendingHero({ items, onOpen }) {
  const [index, setIndex] = useState(0);
  const count = items.length;

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 8000);
    return () => clearInterval(t);
  }, [count]);

  if (!count) return null;
  const item = items[index % count];

  return (
    <div className="relative w-full h-[62vh] min-h-[440px] max-h-[640px] overflow-hidden">
      {items.map((m, i) => (
        <div
          key={`${m.id}-${i}`}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === index % count ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
        >
          <img
            src={m.image}
            alt=""
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover ${
              i === index % count ? 'animate-ken-burns' : ''
            }`}
            loading={i === 0 ? 'eager' : 'lazy'}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-deep)] via-[var(--bg-deep)]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-deep)] via-transparent to-[var(--bg-deep)]/50" />
          <div className="absolute inset-0 bg-[var(--accent)]/[0.03]" />
        </div>
      ))}

      <div className="absolute inset-0 z-20 flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-xl" key={item.id}>
            <div className="flex items-center gap-2 mb-5 animate-fade-in">
              <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold bg-[var(--accent)]/20 text-[var(--accent)] rounded-full border border-[var(--accent)]/25 backdrop-blur-sm">
                <Sparkles className="w-3 h-3" />
                Trending Manhwa
              </span>
              {item.status && (
                <span className="px-3 py-1 text-xs font-medium bg-white/[0.08] text-white/60 rounded-full border border-white/[0.1] backdrop-blur-sm">
                  {item.status}
                </span>
              )}
            </div>
            <h1
              className="text-3xl md:text-4xl lg:text-[3rem] font-bold text-white mb-3 leading-[1.1] line-clamp-2 animate-fade-in-up tracking-tight"
              style={{ animationDelay: '0.15s' }}
            >
              {item.title}
            </h1>
            {item.altTitle && (
              <p className="text-base text-[var(--accent)]/60 mb-3 font-medium line-clamp-1 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
                {item.altTitle}
              </p>
            )}
            {item.description && (
              <p
                className="text-sm text-white/45 mb-6 line-clamp-3 leading-relaxed animate-fade-in-up"
                style={{ animationDelay: '0.3s' }}
              >
                {item.description}
              </p>
            )}
            {item.genres && item.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6 animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
                {item.genres.slice(0, 5).map((g) => (
                  <span
                    key={g}
                    className="px-3 py-1 text-xs font-medium bg-[var(--accent)]/[0.08] text-[var(--accent)]/80 rounded-full border border-[var(--accent)]/[0.15] backdrop-blur-sm"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <button
                onClick={() => onOpen(item.hid || item.slug || item.id)}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-bold text-sm rounded-full transition-all duration-300 hover:shadow-[0_0_30px_rgba(var(--accent-rgb),0.35)] hover:scale-[1.03]"
              >
                <BookOpen size="14" />
                Read Now
              </button>
            </div>
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
                  i === index % count ? 'w-8 h-2.5 bg-[var(--accent)]' : 'w-2.5 h-2.5 bg-white/20 hover:bg-[var(--accent)]/40'
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

/* ---------- Detail view ---------- */
export function ManhwaDetail({ id, onBack, onOpen, onReadChapter }) {
  const [detail, setDetail] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chaptersAsc, setChaptersAsc] = useState([]);
  const [chaptersPage, setChaptersPage] = useState(1);
  const [chaptersHasNext, setChaptersHasNext] = useState(false);
  const [chaptersLoading, setChaptersLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const d = await getTitleForId(id);
        if (cancelled) return;
        setDetail(d);
        setRecommendations(d.recommendations || []);
        // Webtoon /wt/title preloads episode list — render instantly
        if (Array.isArray(d._episodes) && d._episodes.length) {
          setChaptersAsc(d._episodes);
          setChaptersPage(1);
          setChaptersHasNext(false);
        }
      } catch {
        if (!cancelled) setError(SOURCE_DOWN_MSG);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const loadChapters = async () => {
      // Skip refetch when detail already supplied episodes (Webtoon)
      if (Array.isArray(detail?._episodes) && detail._episodes.length) return;
      try {
        setChaptersLoading(true);
        const res = await getChaptersForTitle(id, { page: 1, limit: 100, order: 'asc' });
        if (cancelled) return;
        setChaptersAsc(res.chapters);
        setChaptersPage(1);
        setChaptersHasNext(!!res.pageInfo?.hasNext);
      } catch {
        // chapters stay empty — detail still renders
      } finally {
        if (!cancelled) setChaptersLoading(false);
      }
    };
    // NOTE: state resets on id change via parent key={detailId} remount
    loadChapters();
    return () => {
      cancelled = true;
    };
  }, [id, detail]);

  const loadMoreChapters = () => {
    if (chaptersLoading || !chaptersHasNext) return;
    setChaptersLoading(true);
    getChaptersForTitle(id, { page: chaptersPage + 1, limit: 100, order: 'asc' })
      .then((res) => {
        setChaptersAsc((prev) => [...prev, ...res.chapters]);
        setChaptersPage((p) => p + 1);
        setChaptersHasNext(!!res.pageInfo?.hasNext);
      })
      .catch(() => setChaptersHasNext(false))
      .finally(() => setChaptersLoading(false));
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 px-6 text-center">
        <AlertCircle className="w-16 h-16 text-[var(--text-muted)]" />
        <p className="text-lg text-[var(--text-secondary)] max-w-md">{error || 'Title not found.'}</p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-bold text-sm rounded-full transition-all"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-10">
        <button
          onClick={onBack}
          className="mb-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-white rounded-full border border-white/[0.08] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/[0.06] transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to browse
        </button>

        <div className="glass-panel rounded-2xl p-5 md:p-6">
          <div className="flex flex-col sm:flex-row gap-5">
            {detail.image && (
              <img
                src={detail.image}
                alt={detail.title}
                referrerPolicy="no-referrer"
                className="w-36 sm:w-44 shrink-0 aspect-[3/4] object-cover rounded-xl border border-[var(--border-subtle)]"
              />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {detail.type && (
                  <span className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide bg-[var(--accent)]/15 text-[var(--accent)] rounded-full border border-[var(--accent)]/20">
                    {detail.type}
                  </span>
                )}
                {detail.status && (
                  <span className="px-3 py-1 text-[11px] font-semibold bg-white/[0.06] text-white/60 rounded-full border border-white/[0.08]">
                    {detail.status}
                  </span>
                )}
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">{detail.title}</h1>
              {detail.exactMatch === false && (
                <p className="mt-1.5 text-xs text-amber-300/80">
                  Showing closest match{detail.resolvedFrom ? ` for "${detail.resolvedFrom}"` : ''} — this may not be the exact title.
                </p>
              )}
              {detail.altTitle && (
                <p className="text-sm text-[var(--accent)]/60 mt-1 line-clamp-1">{detail.altTitle}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                {detail.latestChapter && (
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    {detail.latestChapter}
                  </span>
                )}
                {detail.updatedAt && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {detail.updatedAt}
                  </span>
                )}
                {detail.year && <span>{detail.year}</span>}
              </div>
              {detail.authors.length > 0 && (
                <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                  by <span className="text-[var(--text-secondary)] font-medium">{detail.authors.slice(0, 3).join(', ')}</span>
                </p>
              )}
              {detail.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {detail.genres.map((g) => (
                    <span
                      key={g}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-[var(--accent)]/[0.08] text-[var(--accent)]/80 rounded-full border border-[var(--accent)]/[0.15]"
                    >
                      <Tag className="w-3 h-3" />
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {detail.description && (
            <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
              <h3 className="font-bold text-white mb-2 text-sm uppercase tracking-wider">Synopsis</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{detail.description}</p>
            </div>
          )}
        </div>

        {/* Chapters */}
        <div className="glass-panel rounded-2xl p-5 md:p-6 mt-5">
          <h3 className="font-bold text-white mb-1 text-sm uppercase tracking-wider flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-[var(--accent)]" />
            Chapters{chaptersAsc.length > 0 && ` (${chaptersAsc.length})`}
          </h3>
          {chaptersLoading && chaptersAsc.length === 0 ? (
            <div className="py-6">
              <LoadingSpinner />
            </div>
          ) : chaptersAsc.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-3">
              No readable chapters found for this title yet.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 mt-3 max-h-[420px] overflow-y-auto pr-1">
                {[...chaptersAsc].reverse().map((ch) => {
                  const label = chapterLabel(ch);
                  const sub = ch.title && ch.title !== label ? ch.title : '';
                  if (!ch.readable && ch.externalUrl) {
                    return (
                      <a
                        key={ch.id}
                        href={ch.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Opens the official source in a new tab — no readable pages here"
                        className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/[0.04] transition-all group"
                      >
                        <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-white/[0.05] text-[var(--text-secondary)] border border-white/[0.06] shrink-0">
                          {label}
                        </span>
                        <span className="flex-1 min-w-0 text-xs font-medium text-[var(--text-secondary)] truncate">
                          {sub || 'External source'}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-amber-500/10 text-amber-300/80 border border-amber-500/20 shrink-0">
                          External
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent)] shrink-0 transition-colors" />
                      </a>
                    );
                  }
                  return (
                    <button
                      key={ch.id}
                      onClick={() => onReadChapter?.(ch.id)}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/[0.04] transition-all text-left group"
                    >
                      <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 shrink-0">
                        {label}
                      </span>
                      <span className="flex-1 min-w-0 text-xs font-medium text-[var(--text-secondary)] group-hover:text-white truncate transition-colors">
                        {sub || `${ch.pages > 0 ? `${ch.pages} pages` : 'Read now'}`}
                      </span>
                      <BookOpen className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent)] shrink-0 transition-colors" />
                    </button>
                  );
                })}
              </div>
              {chaptersHasNext && (
                <div className="pt-4 text-center">
                  <button
                    onClick={loadMoreChapters}
                    disabled={chaptersLoading}
                    className="px-6 py-2 bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 disabled:opacity-50 text-[var(--accent)] font-bold text-xs rounded-full border border-[var(--accent)]/25 transition-all"
                  >
                    {chaptersLoading ? 'Loading...' : 'Load older chapters'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {recommendations.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg md:text-xl font-bold text-white tracking-tight mb-4">
              You may also like
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
              {recommendations.slice(0, 12).map((item) => (
                <ManhwaCard key={item.id} item={item} onOpen={onOpen} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ---------- Main page ---------- */
export default function Manhwa() {
  const [trending, setTrending] = useState([]);
  const [latest, setLatest] = useState([]);
  const [popular, setPopular] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sourceDown, setSourceDown] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  // Deep-link support: /manhwa?title=<id> opens detail directly (used by
  // navbar manga suggestions). The URL is the source of truth so browser
  // back/forward stays in sync without extra state.
  const detailId = searchParams.get('title');
  const [shelves, setShelves] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [tr, lat, pop, sh] = await Promise.all([
          getManhwaTrending(8).catch(() => []),
          getManhwaLatest(PER_PAGE).catch(() => []),
          getManhwaPopular(12).catch(() => []),
          getManhwaCollections(4).catch(() => []),
        ]);
        if (cancelled) return;
        setTrending(tr);
        setLatest(lat);
        setPopular(pop);
        setShelves(sh);
        setSourceDown(!tr.length && !lat.length && !pop.length && !sh.length);
      } catch {
        if (!cancelled) setSourceDown(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const items = await getManhwaLatest(PER_PAGE);
      // /latest is page-1-only upstream: hide the button when nothing new arrives
      const known = new Set(latest.map((m) => m.id));
      const fresh = items.filter((m) => !known.has(m.id));
      if (fresh.length === 0) {
        setHasMore(false);
      } else {
        setLatest((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
        });
        setPage(next);
      }
    } catch {
      // leave list as-is
    } finally {
      setLoadingMore(false);
    }
  };

  const openDetail = useCallback(
    (id) => {
      if (id) setSearchParams({ title: id });
    },
    [setSearchParams]
  );

  const openRecommendation = useCallback(
    (id) => {
      if (id) {
        setSearchParams({ title: id });
        window.scrollTo({ top: 0 });
      }
    },
    [setSearchParams]
  );

  const closeDetail = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] pt-20 relative overflow-x-clip">
      {/* Ambient pink glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[36rem] h-[16rem] bg-[var(--accent)]/[0.05] rounded-full blur-[130px] pointer-events-none" />
      {detailId ? (
        <ManhwaDetail
          key={detailId}
          id={detailId}
          onBack={closeDetail}
          onOpen={openRecommendation}
          onReadChapter={(chapterId) => {
            if (chapterId) navigate(`/manhwa/read/${detailId}/${chapterId}`);
          }}
        />
      ) : (
        <div className="animate-fade-in">
          {trending.length > 0 && <TrendingHero items={trending} onOpen={openDetail} />}

          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-[var(--accent)]" />
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Manhwa</h1>
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-1.5">Korean comics — new chapters daily</p>
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : sourceDown ? (
              <div className="text-center py-24">
                <AlertCircle className="w-20 h-20 mx-auto text-[var(--text-muted)]/30 mb-4" />
                <p className="text-xl font-bold text-[var(--text-secondary)] mb-2">Source unreachable</p>
                <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">{SOURCE_DOWN_MSG}</p>
              </div>
            ) : (
              <>
                {popular.length > 0 && (
                  <section className="mb-10">
                    <div className="mb-4">
                      <h2 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[var(--accent)]/60" />
                        Most followed
                      </h2>
                      <p className="text-sm text-[var(--text-muted)] mt-1">Loved by readers</p>
                    </div>
                    <HorizontalRow>
                      {popular.map((item) => (
                        <div key={item.id} className="flex-none w-[140px] md:w-[170px]">
                          <ManhwaCard item={item} onOpen={openDetail} />
                        </div>
                      ))}
                    </HorizontalRow>
                  </section>
                )}

                <div className="mb-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">Latest updates</h2>
                    {latest.length > 0 && (
                      <span className="px-3 py-1.5 text-xs font-bold bg-[var(--accent)]/10 text-[var(--accent)] rounded-full border border-[var(--accent)]/20">
                        {latest.length} titles
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mt-1">Fresh chapters</p>
                </div>
                {latest.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-sm text-[var(--text-muted)]">No titles right now — check back later.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
                      {latest.map((item) => (
                        <ManhwaCard key={item.id} item={item} onOpen={openDetail} />
                      ))}
                    </div>
                    {hasMore ? (
                      <div className="py-10 text-center">
                        <button
                          onClick={loadMore}
                          disabled={loadingMore}
                          className="px-7 py-3 bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 disabled:opacity-50 text-[var(--accent)] font-bold text-sm rounded-full border border-[var(--accent)]/25 transition-all duration-300"
                        >
                          {loadingMore ? 'Loading...' : 'Load more'}
                        </button>
                      </div>
                    ) : (
                      <div className="py-10 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--text-muted)] bg-[var(--accent)]/[0.05] rounded-full border border-[var(--accent)]/10">
                          <Check className="w-3.5 h-3.5 text-[var(--accent)]" />
                          You're all caught up
                        </div>
                      </div>
                    )}
                  </>
                )}

                {shelves.map((shelf) => (
                  <section key={shelf.id} className="mb-10">
                    <div className="mb-4">
                      <h2 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[var(--accent)]/60" />
                        {shelf.name}
                      </h2>
                      {shelf.description && (
                        <p className="text-sm text-[var(--text-muted)] mt-1">{shelf.description}</p>
                      )}
                    </div>
                    <HorizontalRow>
                      {shelf.titles.map((item) => (
                        <div key={item.id} className="flex-none w-[140px] md:w-[170px]">
                          <ManhwaCard item={item} onOpen={openDetail} />
                        </div>
                      ))}
                    </HorizontalRow>
                  </section>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
