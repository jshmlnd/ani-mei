import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  searchAnime,
  getTrendingAnime,
  getRecentAnime,
  getTopRatedAnime,
  getPopularAnime,
} from '../api/apiService';
import { searchManhwa, getManhwaPopular } from '../api/manhwaService';
import AnimeCard from '../components/AnimeCard';
import { ManhwaCard, ManhwaDetail } from '../components/Manhwa';
import LoadingSpinner from '../components/LoadingSpinner';
import { Search as SearchIcon, Check, Heart, Clapperboard, BookOpen } from 'lucide-react';

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // ---- Anime tab state (existing behavior, untouched) ----
  const [animeList, setAnimeList] = useState([]);
  const [pageInfo, setPageInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);

  // ---- Manhwa tab state ----
  const [mangaItems, setMangaItems] = useState([]);
  const [mangaMeta, setMangaMeta] = useState({ exactMatch: null, resolvedFrom: '' });
  const [mangaLoading, setMangaLoading] = useState(false);
  const [mangaDetailId, setMangaDetailId] = useState(null);

  const query = searchParams.get('keyw') || '';
  const type = searchParams.get('type') || '';
  const tab = searchParams.get('tab') === 'manhwa' ? 'manhwa' : 'anime';
  const showTabs = !type && !mangaDetailId;

  const setTab = (t) => {
    setMangaDetailId(null);
    const next = new URLSearchParams(searchParams);
    if (t === 'manhwa') next.set('tab', 'manhwa');
    else next.delete('tab');
    setSearchParams(next);
  };

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        setLoading(true);
        setAnimeList([]);
        setPage(1);

        let result;
        switch (type) {
          case 'TRENDING':
            result = await getTrendingAnime(1, 20);
            break;
          case 'NEW':
            result = await getRecentAnime(1, 20);
            break;
          case 'TOP':
            result = await getTopRatedAnime(1, 20);
            break;
          default:
            if (query) {
              result = await searchAnime(query, 1, 20);
            } else {
              result = await getPopularAnime(1, 20);
            }
        }

        if (result && !controller.signal.aborted) {
          setAnimeList(result.media);
          setPageInfo(result.pageInfo);
        }
      } catch {
        if (!controller.signal.aborted) setAnimeList([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, [query, type]);

  const loadMore = useCallback(async () => {
    if (pageInfo?.hasNextPage && !loadingMore) {
      setLoadingMore(true);
      const nextPage = page + 1;
      setPage(nextPage);
      try {
        let result;
        switch (type) {
          case 'TRENDING':
            result = await getTrendingAnime(nextPage, 20);
            break;
          case 'NEW':
            result = await getRecentAnime(nextPage, 20);
            break;
          case 'TOP':
            result = await getTopRatedAnime(nextPage, 20);
            break;
          default:
            if (query) {
              result = await searchAnime(query, nextPage, 20);
            } else {
              result = await getPopularAnime(nextPage, 20);
            }
        }
        if (result) {
          setAnimeList((prev) => [...prev, ...result.media]);
          setPageInfo(result.pageInfo);
        }
      } catch {
        // keep existing list
      } finally {
        setLoadingMore(false);
      }
    }
  }, [pageInfo, loadingMore, page, type, query]);

  useEffect(() => {
    if (tab !== 'anime' || mangaDetailId) return;
    const handleScroll = () => {
      if (loadingMore || !pageInfo?.hasNextPage) return;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 800) {
        loadMore();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore, loadingMore, pageInfo, tab, mangaDetailId]);

  // ---- Manhwa tab search (best-match via /title fallback) ----
  useEffect(() => {
    if (tab !== 'manhwa') return;
    const controller = new AbortController();
    const fetchManga = async () => {
      try {
        setMangaLoading(true);
        setMangaItems([]);
        setMangaDetailId(null);
        let res;
        if (query) {
          res = await searchManhwa(query);
        } else {
          const items = await getManhwaPopular(20);
          res = { items, exactMatch: null, resolvedFrom: '' };
        }
        if (!controller.signal.aborted) {
          setMangaItems(res.items || []);
          setMangaMeta({ exactMatch: res.exactMatch ?? null, resolvedFrom: res.resolvedFrom || '' });
        }
      } catch {
        if (!controller.signal.aborted) {
          setMangaItems([]);
          setMangaMeta({ exactMatch: null, resolvedFrom: '' });
        }
      } finally {
        if (!controller.signal.aborted) setMangaLoading(false);
      }
    };
    fetchManga();
    return () => controller.abort();
  }, [query, tab]);

  const getTitle = () => {
    if (query) return `Results for "${query}"`;
    if (type === 'TRENDING') return 'New Releases';
    if (type === 'NEW') return 'Latest Episodes';
    if (type === 'TOP') return 'Just Completed';
    return 'All Anime';
  };

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <main className="min-w-0">
          {tab === 'manhwa' && mangaDetailId ? (
            <ManhwaDetail
              key={mangaDetailId}
              id={mangaDetailId}
              onBack={() => setMangaDetailId(null)}
              onOpen={(id) => id && setMangaDetailId(id)}
              onReadChapter={(chapterId) => {
                if (chapterId) navigate(`/manhwa/read/${mangaDetailId}/${chapterId}`);
              }}
            />
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                  {tab === 'anime' && query ? (
                    <Heart className="w-6 h-6 text-[var(--accent)]" fill="currentColor" />
                  ) : tab === 'manhwa' ? (
                    <BookOpen className="w-6 h-6 text-[var(--accent)]" />
                  ) : null}
                  {tab === 'manhwa' && query ? `Manga results for "${query}"` : getTitle()}
                </h1>
                {tab === 'anime' && !loading && animeList.length > 0 && (
                  <span className="px-3 py-1 text-xs font-bold bg-white/[0.06] text-[var(--text-muted)] rounded-full border border-white/[0.06]">
                    {animeList.length} results
                  </span>
                )}
                {tab === 'manhwa' && !mangaLoading && mangaItems.length > 0 && (
                  <span className="px-3 py-1.5 text-xs font-bold bg-[var(--accent)]/10 text-[var(--accent)] rounded-full border border-[var(--accent)]/20">
                    {mangaItems.length} {mangaItems.length === 1 ? 'title' : 'titles'}
                  </span>
                )}
              </div>

              {showTabs && (
                <div className="flex items-center gap-1.5 mb-6">
                  {[
                    { key: 'anime', label: 'Anime', icon: Clapperboard },
                    { key: 'manhwa', label: 'Manga & Manhwa', icon: BookOpen },
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-full border transition-all duration-200 ${
                        tab === t.key
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm shadow-[var(--accent)]/25'
                          : 'bg-white/[0.03] text-[var(--text-muted)] border-[var(--border-subtle)] hover:bg-[var(--accent)]/[0.08] hover:text-white hover:border-[var(--accent)]/[0.2]'
                      }`}
                    >
                      <t.icon className="w-4 h-4" />
                      {t.label}
                    </button>
                  ))}
                  <span className="ml-1 text-[11px] text-[var(--text-muted)]/70 hidden sm:inline">
                    Hentai is excluded from results
                  </span>
                </div>
              )}

              {tab === 'anime' ? (
                loading ? (
                  <LoadingSpinner />
                ) : animeList.length === 0 ? (
                  <div className="text-center py-24">
                    <SearchIcon className="w-20 h-20 mx-auto text-[var(--text-muted)]/30 mb-4" />
                    <p className="text-xl font-bold text-[var(--text-secondary)] mb-2">No results found</p>
                    <p className="text-sm text-[var(--text-muted)]">Try a different search term or genre</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                      {animeList.map((anime) => (
                        <AnimeCard key={anime.id} anime={anime} />
                      ))}
                    </div>

                    {loadingMore && (
                      <div className="py-10">
                        <LoadingSpinner />
                      </div>
                    )}

                    {!pageInfo?.hasNextPage && animeList.length > 0 && (
                      <div className="py-10 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[var(--text-muted)] bg-white/[0.03] rounded-full border border-white/[0.06]">
                          <Check className="w-3.5 h-3.5" />
                          You've reached the end
                        </div>
                      </div>
                    )}
                  </>
                )
              ) : mangaLoading ? (
                <LoadingSpinner />
              ) : mangaItems.length === 0 ? (
                <div className="text-center py-24">
                  <BookOpen className="w-20 h-20 mx-auto text-[var(--text-muted)]/30 mb-4" />
                  <p className="text-xl font-bold text-[var(--text-secondary)] mb-2">No manga found</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {query ? 'Try a different title — results show the closest match' : 'Try searching for a title above'}
                  </p>
                </div>
              ) : (
                <>
                  {mangaMeta.exactMatch === false && (
                    <p className="mb-4 text-xs text-amber-300/80">
                      Showing closest match{mangaMeta.resolvedFrom ? ` for "${mangaMeta.resolvedFrom}"` : ''} — this may not be the exact title.
                    </p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                    {mangaItems.map((item) => (
                      <ManhwaCard
                        key={item.id}
                        item={item}
                        onOpen={(id) => id && setMangaDetailId(id)}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
