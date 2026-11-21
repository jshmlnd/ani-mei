import { GradientHeading } from '@/components/ui/gradient-heading';
import { MinimalCard } from '@/components/ui/minimal-card';
import { TextureCard } from '@/components/ui/texture-card';
import { useState, useEffect, useCallback } from 'react';
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
import HorizontalRow from './HorizontalRow';
import Carousel from './Carousel';
import {
  BookOpen,
  ArrowLeft,
  AlertCircle,
  ImageIcon,
  Clock,
  Tag,
  Sparkles,
  Check,
  ListOrdered,
  ExternalLink,
} from '@/components/icons';

const PER_PAGE = 24;
const SOURCE_DOWN_MSG =
  'The manhwa source is currently unreachable. Loaded titles will appear here once it is back online.';

/* ---------- Grid card ---------- */
export function ManhwaCard({ item, onOpen }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <button
      onClick={() => onOpen(item.hid || item.slug || item.id)}
      className="group relative h-full card-hover text-left"
    >
      <MinimalCard className="h-full p-1.5">
      <figure className="relative aspect-[3/4] overflow-hidden">
        {!failed ? (
          <img
            src={item.thumbnail || item.image}
            alt={item.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`w-full h-full object-cover transition-all duration-700 ease-out  ${
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
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--r0)] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        {item.description && (
          <div className="absolute bottom-0 left-0 right-0 p-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-3 group-hover:translate-y-0">
            <p className="text-xs text-[var(--r6)] line-clamp-2 leading-relaxed">
              {item.description.replace(/<[^>]*>/g, '').slice(0, 120)}
              {item.description.length > 120 ? '...' : ''}
            </p>
          </div>
        )}
        {item.type && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="px-2.5 py-1 text-[10px] uppercase tracking-wide bg-[var(--r3)] text-[var(--accent)] border border-[var(--r4)]">
              {item.type}
            </span>
          </div>
        )}
        {item.latestChapter && (
          <div className="absolute bottom-2.5 left-2.5 z-10">
            <span className="px-2.5 py-1 text-[10px] bg-[var(--r0)] text-[var(--r6)] border border-[var(--r4)]">
              {item.latestChapter}
            </span>
          </div>
        )}
        <div className="absolute bottom-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          <div className="w-11 h-11 flex items-center justify-center bg-[var(--accent)]">
            <BookOpen className="w-5 h-5 text-[var(--r7)]" />
          </div>
        </div>
      </figure>
      <div className="p-3">
        <h3 className="text-sm text-[var(--text-primary)] leading-snug line-clamp-2 group-hover:text-[var(--accent)] transition-colors duration-300">
          {item.title}
        </h3>
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[var(--text-muted)]">
          {item.status && <span>{item.status}</span>}
          {item.status && item.updatedAt && <span className="w-0.5 h-0.5 bg-[var(--text-muted)]" />}
          {item.updatedAt && <span className="truncate">{item.updatedAt}</span>}
        </div>
      </div>
    </MinimalCard>
    </button>
  );
}

/* ---------- Trending hero ---------- */
function TrendingHero({ items, onOpen }) {
  return (
    <Carousel
      items={items}
      interval={8000}
      imageFor={(m) => m.image}
      renderContent={(item) => (
        <>
          <h1
            className="text-2xl sm:text-3xl lg:text-[2.75rem] text-[var(--r7)] mb-3 leading-[1.1] animate-fade-in-up"
            style={{ animationDelay: '0.15s' }}
          >
            {item.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {item.status && (
              <span className="px-3 py-1 text-xs bg-[var(--r3)] text-[var(--r5)] border border-[var(--r4)]">
                {item.status}
              </span>
            )}
          </div>
          {item.altTitle && (
            <p className="text-base text-[var(--accent)] mb-3 line-clamp-1 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
              {item.altTitle}
            </p>
          )}
          {item.description && (
            <p
              className="text-sm text-[var(--r5)] mb-6 line-clamp-3 leading-relaxed animate-fade-in-up"
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
                  className="px-3 py-1 text-xs bg-[var(--r3)] text-[var(--accent)] border border-[var(--r4)]"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <button
              onClick={() => onOpen(item.hid || item.slug || item.id)}
              className="inline-flex items-center gap-2.5 px-7 py-3 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-[var(--r0)] text-base border-2 border-[var(--r0)] shadow-[inset_0_-4px_0_var(--accent-deep)] transition-colors duration-100"
            >
              <BookOpen size="14" />
              Read Now
            </button>
          </div>
        </>
      )}
    />
  );
}

/* ---------- Detail view ---------- */
export function ManhwaDetail({ id, onBack, onOpen, onReadChapter }) {
  const [detail, setDetail] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chaptersAsc, setChaptersAsc] = useState([]);
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
      try {
        setChaptersLoading(true);
        let all = [];
        let page = 1;
        let hasNext = true;
        while (hasNext) {
          const res = await getChaptersForTitle(id, { page, order: 'asc' });
          if (cancelled) return;
          all = all.concat(res.chapters);
          hasNext = !!res.pageInfo?.hasNext;
          page++;
          setChaptersAsc([...all]);
        }
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
  }, [id]);

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
          className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-[var(--r0)] text-sm transition-all"
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
          className="mb-5 inline-flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--r7)] border border-[var(--r4)] hover:border-[var(--accent)] hover:bg-[var(--r3)] transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to browse
        </button>

        <TextureCard><div className="p-5 md:p-6">
          <div className="flex flex-col sm:flex-row gap-5">
            {detail.image && (
              <img
                src={detail.image}
                alt={detail.title}
                referrerPolicy="no-referrer"
                className="w-36 sm:w-44 shrink-0 aspect-[3/4] object-cover border border-[var(--border-subtle)]"
              />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {detail.type && (
                  <span className="px-3 py-1 text-[11px] uppercase tracking-wide bg-[var(--r3)] text-[var(--accent)] border border-[var(--r4)]">
                    {detail.type}
                  </span>
                )}
                {detail.status && (
                  <span className="px-3 py-1 text-[11px] bg-[var(--r3)] text-[var(--r5)] border border-[var(--r4)]">
                    {detail.status}
                  </span>
                )}
              </div>
              <GradientHeading as="h1" variant="animei" size="xs" className="leading-tight">{detail.title}</GradientHeading>
              {detail.exactMatch === false && (
                <p className="mt-1.5 text-xs text-[var(--warn)]">
                  Showing closest match{detail.resolvedFrom ? ` for "${detail.resolvedFrom}"` : ''} — this may not be the exact title.
                </p>
              )}
              {detail.altTitle && (
                <p className="text-sm text-[var(--accent)] mt-1 line-clamp-1">{detail.altTitle}</p>
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
                  by <span className="text-[var(--text-secondary)]">{detail.authors.slice(0, 3).join(', ')}</span>
                </p>
              )}
              {detail.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {detail.genres.map((g) => (
                    <span
                      key={g}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-[var(--r3)] text-[var(--accent)] border border-[var(--r4)]"
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
              <h3 className="text-[var(--r7)] mb-2 text-sm uppercase tracking-wider">Synopsis</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{detail.description}</p>
            </div>
          )}
        </div></TextureCard>

        {/* Chapters */}
        <TextureCard className="mt-5"><div className="p-5 md:p-6">
          <h3 className="text-[var(--r7)] mb-1 text-sm uppercase tracking-wider flex items-center gap-2">
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
                        className="flex items-center gap-3 px-3.5 py-2.5 border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all group"
                      >
                        <span className="px-2.5 py-1 text-[11px] text-[var(--text-secondary)] border border-[var(--r4)] shrink-0">
                          {label}
                        </span>
                        <span className="flex-1 min-w-0 text-xs text-[var(--text-secondary)] truncate">
                          {sub || 'External source'}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide bg-[var(--r3)] text-[var(--warn)] border border-[var(--warn)] shrink-0">
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
                      className="flex items-center gap-3 px-3.5 py-2.5 border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all text-left group"
                    >
                      <span className="px-2.5 py-1 text-[11px] bg-[var(--r3)] text-[var(--accent)] border border-[var(--r4)] shrink-0">
                        {label}
                      </span>
                      <span className="flex-1 min-w-0 text-xs text-[var(--text-secondary)] group-hover:text-[var(--r7)] truncate transition-colors">
                        {sub || `${ch.pages > 0 ? `${ch.pages} pages` : 'Read now'}`}
                      </span>
                      <BookOpen className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent)] shrink-0 transition-colors" />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div></TextureCard>

        {recommendations.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg md:text-xl text-[var(--r7)] mb-4">
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
                <GradientHeading as="h1" variant="animei" size="sm" className="leading-tight">Manhwa</GradientHeading>
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-1.5">Korean comics — new chapters daily</p>
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : sourceDown ? (
              <div className="text-center py-24">
                <AlertCircle className="w-20 h-20 mx-auto text-[var(--text-muted)] mb-4" />
                <p className="text-xl text-[var(--text-secondary)] mb-2">Source unreachable</p>
                <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">{SOURCE_DOWN_MSG}</p>
              </div>
            ) : (
              <>
                {popular.length > 0 && (
                  <section className="mb-10">
                    <div className="mb-4">
                      <h2 className="text-lg md:text-xl text-[var(--r7)] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[var(--accent)]" />
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
                    <h2 className="text-lg md:text-xl text-[var(--r7)]">Latest updates</h2>
                    {latest.length > 0 && (
                      <span className="px-3 py-1.5 text-xs bg-[var(--r3)] text-[var(--accent)] border border-[var(--r4)]">
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
                          className="px-7 py-3 bg-[var(--r3)] hover:bg-[var(--r4)] text-[var(--accent)] text-sm border-2 border-[var(--r0)] shadow-[inset_0_-4px_0_var(--r2)] transition-colors duration-100"
                        >
                          {loadingMore ? 'Loading...' : 'Load more'}
                        </button>
                      </div>
                    ) : (
                      <div className="py-10 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 text-xs text-[var(--text-muted)] border border-[var(--r4)]">
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
                      <h2 className="text-lg md:text-xl text-[var(--r7)] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[var(--accent)]" />
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
