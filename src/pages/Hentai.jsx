import { useState, useEffect, useCallback } from 'react';
import { getHentaiAnime } from '../api/apiService';
import AnimeCard from '../components/AnimeCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { AlertTriangle, Search, Check } from 'lucide-react';

export default function Hentai() {
  const [ageVerified, setAgeVerified] = useState(() => sessionStorage.getItem('hentai_age_verified') === 'true');
  const [animeList, setAnimeList] = useState([]);
  const [pageInfo, setPageInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);

  const handleVerify = () => {
    sessionStorage.setItem('hentai_age_verified', 'true');
    setAgeVerified(true);
  };

  useEffect(() => {
    if (!ageVerified) return;
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const result = await getHentaiAnime(1, 20);
        if (!cancelled) {
          setAnimeList(result.media);
          setPageInfo(result.pageInfo);
        }
      } catch {
        if (!cancelled) setAnimeList([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [ageVerified]);

  const loadMore = useCallback(async () => {
    if (pageInfo?.hasNextPage && !loadingMore) {
      setLoadingMore(true);
      const nextPage = page + 1;
      setPage(nextPage);
      try {
        const result = await getHentaiAnime(nextPage, 20);
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
  }, [pageInfo, loadingMore, page]);

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

  if (!ageVerified) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center px-4">
        <div className="glass-panel rounded-2xl p-8 md:p-12 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/15 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-3">Age Verification Required</h1>
          <p className="text-[var(--text-secondary)] text-sm mb-6">
            This section contains content intended for audiences 18 years and older. By entering, you confirm you are of legal age in your jurisdiction.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleVerify}
              className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-bold text-sm rounded-full transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]"
            >
              I am 18+ — Enter
            </button>
            <button
              onClick={() => window.history.back()}
              className="px-6 py-3 text-white/50 hover:text-white font-medium text-sm rounded-full border border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.04] transition-all duration-300"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              +18
              <span className="ml-2 text-sm font-medium px-2.5 py-1 bg-red-500/15 text-red-400 rounded-full border border-red-500/20">18+</span>
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">Hentai anime — mature content</p>
          </div>
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
            <Search className="w-20 h-20 mx-auto text-[var(--text-muted)]/40 mb-4" />
            <p className="text-xl font-bold text-[var(--text-secondary)] mb-2">No content found</p>
            <p className="text-sm text-[var(--text-muted)]">Try again later</p>
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
      </div>
    </div>
  );
}
