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
import { Search as SearchIcon, Check } from 'lucide-react';

const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
  'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural',
  'Thriller', 'Mecha', 'Military', 'Music', 'Psychological', 'Shounen',
];

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [animeList, setAnimeList] = useState([]);
  const [pageInfo, setPageInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const query = searchParams.get('keyw') || '';
  const type = searchParams.get('type') || '';
  const genre = searchParams.get('genre') || '';

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
  }, [query, type, genre]);

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
    if (type === 'TRENDING') return 'Trending Anime';
    if (type === 'NEW') return 'New Releases';
    if (type === 'TOP') return 'Top Rated Anime';
    if (genre) return `${genre} Anime`;
    return 'All Anime';
  };

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-56 shrink-0">
            <div className="glass-panel rounded-xl p-4 sticky top-20">
              <h3 className="font-bold text-white text-sm mb-3">Browse by Genre</h3>
              <div className="flex flex-wrap lg:flex-col gap-1.5">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-300 ${
                      genre === g
                        ? 'bg-[var(--accent)] text-white shadow-[0_0_16px_rgba(168,85,247,0.3)]'
                        : 'bg-white/[0.04] text-[var(--text-secondary)] hover:bg-white/[0.08] hover:text-white border border-white/[0.06]'
                    }`}
                    onClick={() => {
                      const params = new URLSearchParams(searchParams);
                      if (genre === g) {
                        params.delete('genre');
                      } else {
                        params.set('genre', g);
                        params.delete('type');
                        params.delete('keyw');
                      }
                      setSearchParams(params);
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl md:text-3xl font-black text-white">{getTitle()}</h1>
              {!loading && animeList.length > 0 && (
                <span className="px-3 py-1 text-xs font-bold bg-white/[0.06] text-[var(--text-muted)] rounded-full border border-white/[0.06]">
                  {animeList.length} results
                </span>
              )}
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : animeList.length === 0 ? (
              <div className="text-center py-24">
                <SearchIcon className="w-20 h-20 mx-auto text-[var(--text-muted)]/40 mb-4" />
                <p className="text-xl font-bold text-[var(--text-secondary)] mb-2">No results found</p>
                <p className="text-sm text-[var(--text-muted)]">Try a different search term or genre</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
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
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
