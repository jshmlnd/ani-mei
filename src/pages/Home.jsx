import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getTrendingAnime,
  getPopularAnime,
  getRecentAnime,
  getTopRatedAnime,
} from '../api/apiService';
import HeroCarousel from '../components/HeroCarousel';
import AnimeCard from '../components/AnimeCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { ChevronRight, AlertCircle } from 'lucide-react';

function AnimeRow({ title, subtitle, linkTo, linkText, children }) {
  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white">{title}</h2>
            {subtitle && <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p>}
          </div>
          {linkTo && (
            <Link
              to={linkTo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--accent)] hover:text-white hover:bg-[var(--accent)]/10 rounded-full border border-[var(--accent)]/20 hover:border-[var(--accent)]/40 transition-all duration-300"
            >
              {linkText || 'View All'}
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

export default function Home() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type');

  const showTrending = !type || type === 'TRENDING';
  const showPopular = !type || type === 'TRENDING';
  const showRecent = !type || type === 'NEW';
  const showTopRated = !type || type === 'TOP';

  const [trending, setTrending] = useState([]);
  const [popular, setPopular] = useState([]);
  const [recent, setRecent] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const requests = [];
        if (showTrending) requests.push(getTrendingAnime(1, 10).then(r => ({ key: 'trending', value: r })));
        if (showPopular) requests.push(getPopularAnime(1, 12).then(r => ({ key: 'popular', value: r })));
        if (showRecent) requests.push(getRecentAnime(1, 16).then(r => ({ key: 'recent', value: r })));
        if (showTopRated) requests.push(getTopRatedAnime(1, 12).then(r => ({ key: 'topRated', value: r })));

        const results = await Promise.allSettled(requests);
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const { key, value } = result.value;
            if (key === 'trending') setTrending(value.media);
            else if (key === 'popular') setPopular(value.media);
            else if (key === 'recent') setRecent(value.media);
            else if (key === 'topRated') setTopRated(value.media);
          }
        }
      } catch {
        setError('Failed to load content. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [type, showTrending, showPopular, showRecent, showTopRated]);

  if (loading) return <LoadingSpinner />;
  if (error) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <AlertCircle className="w-16 h-16 text-[var(--text-muted)]" />
      <p className="text-lg text-[var(--text-secondary)]">{error}</p>
      <button className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-bold text-sm rounded-full transition-all" onClick={() => window.location.reload()}>
        Retry
      </button>
    </div>
  );

  return (
    <div>
      {!type && trending.length > 0 && <HeroCarousel animeList={trending} />}

      {type && (
        <div className="pt-24 pb-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
          </div>
        </div>
      )}

      <div className="space-y-2">
        {showPopular && popular.length > 0 && (
          <AnimeRow
            title="Popular Anime"
            subtitle="Most watched right now"
            linkTo="/browse?type=TRENDING"
            linkText="View All"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
              {popular.slice(0, 12).map((anime) => (
                <AnimeCard key={anime.id} anime={anime} />
              ))}
            </div>
          </AnimeRow>
        )}

        {showRecent && recent.length > 0 && (
          <AnimeRow
            title="New Episodes"
            subtitle="Recently updated episodes"
            linkTo="/browse?type=NEW"
            linkText="View All"
          >
            <div className="relative -mx-4 px-4">
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                {recent.map((anime) => (
                  <div key={anime.id} className="flex-none w-[140px] md:w-[170px]">
                    <AnimeCard anime={anime} />
                  </div>
                ))}
              </div>
              <div className="absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-[var(--bg-deep)] to-transparent pointer-events-none" />
            </div>
          </AnimeRow>
        )}

        {showTopRated && topRated.length > 0 && (
          <AnimeRow
            title="Top Rated"
            subtitle="Highest rated anime of all time"
            linkTo="/browse?type=TOP"
            linkText="View All"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
              {topRated.slice(0, 12).map((anime) => (
                <AnimeCard key={anime.id} anime={anime} />
              ))}
            </div>
          </AnimeRow>
        )}

        {!type && (
          <section className="py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="relative overflow-hidden rounded-2xl glass-panel p-8 md:p-12">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/8 via-transparent to-indigo-500/8 pointer-events-none" />
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-[var(--accent)]/10 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
                <div className="relative text-center">
                  <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
                    Stream Your Favorite Anime
                  </h2>
                  <p className="text-[var(--text-secondary)] max-w-xl mx-auto mb-8">
                    Watch thousands of anime episodes for free. No registration required.
                    New episodes added daily.
                  </p>
                  <div className="flex items-center justify-center gap-4 flex-wrap">
                    <Link to="/browse?type=TRENDING" className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-bold text-sm rounded-full transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                      Browse Trending
                    </Link>
                    <Link to="/browse?type=NEW" className="px-6 py-3 text-white/70 hover:text-white font-medium text-sm rounded-full border border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.04] transition-all duration-300">
                      New Releases
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
