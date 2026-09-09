import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  searchAnime,
  getTrendingAnime,
  getRecentAnime,
  getTopRatedAnime,
  getPopularAnime,
} from '../api/apiService';
import AnimeCard from '../components/AnimeCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { Search as SearchIcon, Check, Heart } from 'lucide-react';

export default function Search() {
  const [searchParams] = useSearchParams();
  const [animeList, setAnimeList] = useState([]);
  const [pageInfo, setPageInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const query = searchParams.get('keyw') || '';
  const type = searchParams.get('type') || '';

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
    const handleScroll = () => {
      if (loadingMore || !pageInfo?.hasNextPage) return;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 800) {
        loadMore();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore, loadingMore, pageInfo]);

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
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              {query ? <Heart className="w-6 h-6 text-[var(--accent)]" fill="currentColor" /> : null}
              {getTitle()}
            </h1>
            {!loading && animeList.length > 0 && (
              <span className="px-3 py-1.5 text-xs font-bold bg-[var(--accent)]/10 text-[var(--accent)] rounded-full border border-[var(--accent)]/20">
                {animeList.length} results
              </span>
            )}
          </div>

          {loading ? (
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
                  <div className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--text-muted)] bg-[var(--accent)]/[0.05] rounded-full border border-[var(--accent)]/10">
                    <Check className="w-3.5 h-3.5 text-[var(--accent)]" />
                    You've reached the end
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
