import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getHentaiLatest,
  getHentaiPopular,
  getHentaiSpotlight,
  searchHentai,
  getHentaiGenres,
  getHentaiByGenre,
  getHentaiDetail,
  getHentaiWatch,
} from '../api/hentaiService';
import LoadingSpinner from './LoadingSpinner';
import {
  Flame,
  Search,
  X,
  Play,
  ShieldAlert,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  Tag,
  ImageIcon,
  Download,
  Clapperboard,
  Sparkles,
} from 'lucide-react';

const AGE_KEY = 'animei-age-ok';
const PER_PAGE = 24;

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

/* ---------- 18+ gate ---------- */
function AgeGate({ onConfirm }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 px-6 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/25">
          <ShieldAlert className="h-7 w-7 text-[var(--accent)]" />
        </div>
        <h2 className="text-xl font-bold text-white">Adults only</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          This section contains explicit adult content. You must be 18 or older
          (or of legal age in your region) to continue.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={onConfirm}
            className="btn-cute px-7 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white text-sm"
          >
            I'm 18+ — Enter
          </button>
          <a
            href="/browse"
            className="px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:text-white rounded-full border border-white/[0.1] hover:border-white/[0.2] transition-all"
          >
            Go back
          </a>
        </div>
      </div>
    </div>
  );
}

/* ---------- Grid card ---------- */
function MediaCard({ item, onOpen }) {
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
      onClick={() => onOpen(item.slug)}
      className="group relative block w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] card-hover text-left"
    >
      <figure className="relative aspect-[3/4] overflow-hidden">
        {!failed ? (
          <img
            ref={imgRef}
            data-src={item.image}
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
        {item.type && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide bg-[var(--accent)]/20 text-[var(--accent)] backdrop-blur-md rounded-full border border-[var(--accent)]/25">
              {item.type}
            </span>
          </div>
        )}
        {item.episodes && (
          <div className="absolute bottom-2.5 left-2.5 z-10">
            <span className="px-2.5 py-1 text-[10px] font-bold bg-black/60 text-white/80 backdrop-blur-md rounded-full border border-white/[0.1]">
              {item.episodes}
            </span>
          </div>
        )}
        <div className="absolute bottom-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          <div className="w-11 h-11 flex items-center justify-center rounded-full bg-[var(--accent)] shadow-lg shadow-[var(--accent)]/30">
            <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
          </div>
        </div>
        {item.description && (
          <div className="absolute bottom-0 left-0 right-0 p-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-3 group-hover:translate-y-0">
            <p className="text-xs text-white/70 line-clamp-2 leading-relaxed">
              {item.description.replace(/<[^>]*>/g, '').slice(0, 120)}
              {item.description.length > 120 ? '...' : ''}
            </p>
          </div>
        )}
      </figure>
      <div className="p-3">
        <h3 className="text-sm font-bold text-[var(--text-primary)] leading-snug line-clamp-2 min-h-[2.75em] group-hover:text-[var(--accent)] transition-colors duration-300">
          {item.title}
        </h3>
        {item.titleJapanese ? (
          <p className="mt-1 text-[11px] leading-[1.4] text-[var(--text-muted)] truncate">{item.titleJapanese}</p>
        ) : (
          <p aria-hidden="true" className="mt-1 text-[11px] leading-[1.4] truncate invisible select-none">-</p>
        )}
      </div>
    </button>
  );
}

/* ---------- Spotlight hero ---------- */
function SpotlightHero({ items, onOpen }) {
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
      {items.map((s, i) => (
        <div
          key={`${s.slug}-${i}`}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === index % count ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
        >
          <img
            src={s.image}
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
          <div className="max-w-xl" key={item.slug}>
            <div className="flex items-center gap-2 mb-5 animate-fade-in">
              <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold bg-[var(--accent)]/20 text-[var(--accent)] rounded-full border border-[var(--accent)]/25 backdrop-blur-sm">
                <Flame className="w-3 h-3" />
                Spotlight
              </span>
            </div>
            <h1
              className="text-3xl md:text-4xl lg:text-[3rem] font-bold text-white mb-3 leading-[1.1] line-clamp-2 animate-fade-in-up tracking-tight"
              style={{ animationDelay: '0.15s' }}
            >
              {item.title}
            </h1>
            {item.titleJapanese && (
              <p className="text-base text-[var(--accent)]/60 mb-3 font-medium line-clamp-1 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
                {item.titleJapanese}
              </p>
            )}
            {item.meta && (
              <div className="flex items-center gap-2.5 text-[13px] text-white/50 mb-4 animate-fade-in-up" style={{ animationDelay: '0.32s' }}>
                {item.meta
                  .split('\n')
                  .map((m) => m.trim())
                  .filter(Boolean)
                  .slice(0, 3)
                  .map((m, mi) => (
                    <span key={mi} className="flex items-center gap-2.5">
                      {mi > 0 && <span className="w-1 h-1 bg-white/25 rounded-full" />}
                      <span>{m}</span>
                    </span>
                  ))}
              </div>
            )}
            {item.description && (
              <p
                className="text-sm text-white/45 mb-6 line-clamp-3 leading-relaxed animate-fade-in-up"
                style={{ animationDelay: '0.3s' }}
              >
                {item.description}
              </p>
            )}
            <div className="flex items-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <button
                onClick={() => onOpen(item.slug)}
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-bold text-sm rounded-full transition-all duration-300 hover:shadow-[0_0_30px_rgba(var(--accent-rgb),0.35)] hover:scale-[1.03]"
              >
                <Play size="14" fill="currentColor" />
                Watch Now
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
function HentaiDetail({ slug, onBack, onSelectGenre }) {
  const [detail, setDetail] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [activeEp, setActiveEp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [d, w] = await Promise.all([
          getHentaiDetail(slug),
          getHentaiWatch(slug, 12).catch(() => ({ episodes: [] })),
        ]);
        if (cancelled) return;
        setDetail(d);
        setEpisodes(w.episodes || []);
        setActiveEp(0);
      } catch {
        if (!cancelled) setError('Failed to load this title.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [slug]);

  if (loading) return <LoadingSpinner />;
  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 px-6 text-center">
        <AlertCircle className="w-16 h-16 text-[var(--text-muted)]" />
        <p className="text-lg text-[var(--text-secondary)]">{error || 'Title not found.'}</p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-bold text-sm rounded-full transition-all"
        >
          Go back
        </button>
      </div>
    );
  }

  const ep = episodes[activeEp] || null;
  const embedSrc = ep?.playerMain || ep?.iframe || '';
  const fileSrc = !embedSrc ? ep?.playerBackup || ep?.streamUrl || '' : '';

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

        {/* Player */}
        <div className="rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-black">
          {embedSrc ? (
            <iframe
              key={embedSrc}
              src={embedSrc}
              title={ep?.title || detail.title}
              className="w-full aspect-video"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer"
            />
          ) : fileSrc ? (
            <video
              key={fileSrc}
              src={fileSrc}
              poster={ep?.thumbnail || detail.image}
              className="w-full aspect-video"
              controls
              playsInline
              crossOrigin="anonymous"
            />
          ) : (
            <div className="w-full aspect-video flex items-center justify-center bg-[var(--bg-surface)]">
              <div className="text-center px-4">
                <Clapperboard className="w-14 h-14 mx-auto text-[var(--text-muted)]/50 mb-3" />
                <p className="text-sm text-[var(--text-muted)]">No playable source for this episode yet.</p>
              </div>
            </div>
          )}
        </div>

        {/* Episodes */}
        {episodes.length > 0 && (
          <div className="glass-panel rounded-2xl p-5 mt-5">
            <h3 className="font-bold text-white mb-3 text-sm uppercase tracking-wider">
              Episodes ({episodes.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {episodes.map((e, i) => (
                <button
                  key={e.id || i}
                  onClick={() => {
                    setActiveEp(i);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`group rounded-xl overflow-hidden border text-left transition-all duration-200 ${
                    i === activeEp
                      ? 'border-[var(--accent)]/50 shadow-[0_0_20px_rgba(var(--accent-rgb),0.12)]'
                      : 'border-[var(--border-subtle)] hover:border-[var(--accent)]/30'
                  }`}
                >
                  <div className="relative aspect-video bg-[var(--bg-elevated)] overflow-hidden">
                    {e.thumbnail ? (
                      <img
                        src={e.thumbnail}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-[var(--text-muted)]" />
                      </div>
                    )}
                    {i === activeEp && (
                      <div className="absolute inset-0 bg-[var(--accent)]/15 flex items-center justify-center">
                        <Play className="w-6 h-6 text-white" fill="currentColor" />
                      </div>
                    )}
                  </div>
                  <p className="p-2 text-[11px] font-semibold text-[var(--text-secondary)] line-clamp-2 leading-snug">
                    {e.title}
                  </p>
                </button>
              ))}
            </div>
            {ep?.servers?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {ep.servers.map((s, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full border border-[var(--border-subtle)] text-[var(--text-muted)]"
                  >
                    {s.label || s.type}
                  </span>
                ))}
              </div>
            )}
            {ep?.downloads?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {ep.downloads.map((d, i) => (
                  <a
                    key={i}
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {d.label || 'Download'}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="glass-panel rounded-2xl p-5 md:p-6 mt-5">
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
                {detail.category && (
                  <span className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide bg-[var(--accent)]/15 text-[var(--accent)] rounded-full border border-[var(--accent)]/20">
                    {detail.category}
                  </span>
                )}
                {detail.status && (
                  <span className="px-3 py-1 text-[11px] font-semibold bg-white/[0.06] text-white/60 rounded-full border border-white/[0.08]">
                    {detail.status}
                  </span>
                )}
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">{detail.title}</h1>
              {detail.titleJapanese && (
                <p className="text-sm text-[var(--accent)]/60 mt-1">{detail.titleJapanese}</p>
              )}
              {detail.aired && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <Calendar className="w-3.5 h-3.5" />
                  {detail.aired}
                </p>
              )}
              {detail.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {detail.genres.map((g) => (
                    <button
                      key={g}
                      onClick={() => onSelectGenre?.(g)}
                      title={`Browse ${g}`}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-[var(--accent)]/[0.08] text-[var(--accent)]/80 rounded-full border border-[var(--accent)]/[0.15] hover:bg-[var(--accent)]/[0.15] hover:border-[var(--accent)]/30 transition-all"
                    >
                      <Tag className="w-3 h-3" />
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {detail.synopsis && (
            <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
              <h3 className="font-bold text-white mb-2 text-sm uppercase tracking-wider">Synopsis</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{detail.synopsis}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Main page ---------- */
export default function Hentai() {
  const [allowed, setAllowed] = useState(() => {
    try {
      return localStorage.getItem(AGE_KEY) === 'yes';
    } catch {
      return false;
    }
  });
  const [spotlight, setSpotlight] = useState([]);
  const [latest, setLatest] = useState([]);
  const [popular, setPopular] = useState([]);
  const [genres, setGenres] = useState([]);
  const [activeGenre, setActiveGenre] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailSlug, setDetailSlug] = useState(null);
  const debounceRef = useRef(null);

  const confirmAge = useCallback(() => {
    try {
      localStorage.setItem(AGE_KEY, 'yes');
    } catch {
      // private mode — gate reappears next visit
    }
    setAllowed(true);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [sp, lat, pop, gen] = await Promise.all([
          getHentaiSpotlight(5).catch(() => []),
          getHentaiLatest(1, PER_PAGE).catch(() => []),
          getHentaiPopular(1, 12).catch(() => []),
          getHentaiGenres().catch(() => []),
        ]);
        if (cancelled) return;
        setSpotlight(sp);
        setLatest(lat);
        setPopular(pop);
        setGenres(gen);
        setHasMore(lat.length >= PER_PAGE);
        if (!lat.length && !pop.length && !sp.length) {
          setError('Could not reach the hentai source. Please try again later.');
        }
      } catch {
        if (!cancelled) setError('Could not reach the hentai source. Please try again later.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setActiveGenre('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        setResults(await searchHentai(value.trim(), 1, PER_PAGE));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const clearFilters = () => {
    setQuery('');
    setResults([]);
    setActiveGenre('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  const selectGenre = async (slug) => {
    if (slug === activeGenre) {
      setActiveGenre('');
      return;
    }
    setQuery('');
    setResults([]);
    setActiveGenre(slug);
    setSearching(true);
    try {
      setResults(await getHentaiByGenre(slug, 1, PER_PAGE));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const items = await getHentaiLatest(next, PER_PAGE);
      setPage(next);
      setLatest((prev) => [...prev, ...items]);
      setHasMore(items.length >= PER_PAGE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const openDetail = useCallback((slug) => {
    if (slug) setDetailSlug(slug);
  }, []);

  // From detail-view genre pills: leave detail, browse that genre instead
  const openGenreByName = useCallback(
    async (name) => {
      if (!name) return;
      const match = genres.find((g) => g.name.toLowerCase() === String(name).toLowerCase());
      const slug =
        match?.slug || String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (!slug) return;
      setDetailSlug(null);
      setQuery('');
      setResults([]);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (slug === activeGenre) {
        setActiveGenre('');
        return;
      }
      setActiveGenre(slug);
      setSearching(true);
      try {
        setResults(await getHentaiByGenre(slug, 1, PER_PAGE));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
      window.scrollTo({ top: 0 });
    },
    [genres, activeGenre]
  );

  const showingFiltered = query.trim().length >= 2 || activeGenre !== '';
  const gridItems = showingFiltered ? results : latest;

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] pt-20 relative overflow-x-clip">
      {/* Ambient pink glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[36rem] h-[16rem] bg-[var(--accent)]/[0.05] rounded-full blur-[130px] pointer-events-none" />
      {!allowed && <AgeGate onConfirm={confirmAge} />}

      {detailSlug ? (
        <HentaiDetail slug={detailSlug} onBack={() => setDetailSlug(null)} onSelectGenre={openGenreByName} />
      ) : (
        <div className="animate-fade-in">
          {spotlight.length > 0 && !showingFiltered && (
            <SpotlightHero items={spotlight} onOpen={openDetail} />
          )}

          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            {/* Header + search */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2 shrink-0">
                <Flame className="w-6 h-6 text-[var(--accent)]" fill="currentColor" />
                Hentai
              </h1>
              <div className="relative w-full md:max-w-md md:ml-auto group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--accent)] transition-colors" />
                <input
                  type="text"
                  value={query}
                  onChange={handleSearchChange}
                  placeholder="Search titles..."
                  className="w-full pl-11 pr-10 py-2.5 bg-white/[0.03] border border-[var(--border-subtle)] rounded-full outline-none text-white text-sm placeholder-[var(--text-muted)] focus:border-[var(--accent)]/30 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgba(var(--accent-rgb),0.08)] transition-all duration-300"
                />
                {query && (
                  <button
                    onClick={clearFilters}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--text-muted)] hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Genre chips */}
            {genres.length > 0 && !loading && (
              <div className="flex gap-1.5 overflow-x-auto pb-4 scrollbar-hide mb-2">
                {genres.slice(0, 24).map((g) => (
                  <button
                    key={g.slug}
                    onClick={() => selectGenre(g.slug)}
                    className={`flex-none px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all duration-200 ${
                      activeGenre === g.slug
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm shadow-[var(--accent)]/25'
                        : 'bg-white/[0.03] text-[var(--text-muted)] border-[var(--border-subtle)] hover:bg-[var(--accent)]/[0.08] hover:text-white hover:border-[var(--accent)]/[0.2]'
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <LoadingSpinner />
            ) : error && !gridItems.length && popular.length === 0 ? (
              <div className="text-center py-24">
                <AlertCircle className="w-20 h-20 mx-auto text-[var(--text-muted)]/30 mb-4" />
                <p className="text-xl font-bold text-[var(--text-secondary)] mb-2">Source unreachable</p>
                <p className="text-sm text-[var(--text-muted)]">{error}</p>
              </div>
            ) : (
              <>
                {/* Popular strip */}
                {!showingFiltered && popular.length > 0 && (
                  <section className="mb-10">
                    <div className="flex items-end justify-between mb-4">
                      <div>
                        <h2 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[var(--accent)]/60" />
                          Popular now
                        </h2>
                        <p className="text-sm text-[var(--text-muted)] mt-1">Most watched this week</p>
                      </div>
                    </div>
                    <HorizontalRow>
                      {popular.map((item) => (
                        <div key={item.id} className="flex-none w-[140px] md:w-[170px]">
                          <MediaCard item={item} onOpen={openDetail} />
                        </div>
                      ))}
                    </HorizontalRow>
                  </section>
                )}

                {/* Main grid */}
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">
                    {query.trim()
                      ? `Results for "${query.trim()}"`
                      : activeGenre
                        ? genres.find((g) => g.slug === activeGenre)?.name ?? 'Browse genre'
                        : 'Latest updates'}
                  </h2>
                  {!searching && gridItems.length > 0 && (
                    <span className="px-3 py-1.5 text-xs font-bold bg-[var(--accent)]/10 text-[var(--accent)] rounded-full border border-[var(--accent)]/20">
                      {gridItems.length} titles
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  {query.trim()
                    ? 'Matching titles across the catalog'
                    : activeGenre
                      ? 'Titles filed under this tag'
                      : 'Fresh uploads, updated daily'}
                </p>

                {searching ? (
                  <LoadingSpinner />
                ) : gridItems.length === 0 ? (
                  <div className="text-center py-24">
                    <Search className="w-20 h-20 mx-auto text-[var(--text-muted)]/30 mb-4" />
                    <p className="text-xl font-bold text-[var(--text-secondary)] mb-2">No results found</p>
                    <p className="text-sm text-[var(--text-muted)]">Try a different search term or genre</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
                      {gridItems.map((item) => (
                        <MediaCard key={item.id} item={item} onOpen={openDetail} />
                      ))}
                    </div>
                    {!showingFiltered && hasMore && (
                      <div className="py-10 text-center">
                        <button
                          onClick={loadMore}
                          disabled={loadingMore}
                          className="px-7 py-3 bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 disabled:opacity-50 text-[var(--accent)] font-bold text-sm rounded-full border border-[var(--accent)]/25 transition-all duration-300"
                        >
                          {loadingMore ? 'Loading...' : 'Load more'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
