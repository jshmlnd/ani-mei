import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getHome,
} from '../api/apiService';
import HeroCarousel from '../components/HeroCarousel';
import AnimeCard from '../components/AnimeCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { ChevronRight, ChevronLeft, AlertCircle, Sparkles, Heart } from 'lucide-react';

function AnimeRow({ title, subtitle, linkTo, linkText, children }) {
  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--accent)]/60" />
              {title}
            </h2>
            {subtitle && <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p>}
          </div>
          {linkTo && (
            <Link
              to={linkTo}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:text-white hover:bg-[var(--accent)]/10 rounded-full border border-[var(--accent)]/20 hover:border-[var(--accent)]/40 transition-all duration-300"
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

  const showMain = !type || type === 'TRENDING';
  const showRecent = !type || type === 'NEW';
  const showTopRated = !type || type === 'TOP';

  const [trending, setTrending] = useState([]);
  const [popular, setPopular] = useState([]);
  const [recent, setRecent] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const recentScrollRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const home = await getHome();
        if (showMain) {
          setTrending(home.trending);
          setPopular(home.newReleases);
        }
        if (showRecent) setRecent(home.latestEpisodes);
        if (showTopRated) setTopRated(home.finishedAir);
      } catch {
        setError('Failed to load content. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [type, showMain, showRecent, showTopRated]);

  if (loading) return <LoadingSpinner />;
  if (error) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <AlertCircle className="w-16 h-16 text-[var(--text-muted)]" />
      <p className="text-lg text-[var(--text-secondary)]">{error}</p>
      <button
        className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-bold text-sm rounded-full transition-all duration-300 hover:shadow-[0_0_20px_rgba(var(--accent-rgb),0.25)]"
        onClick={() => window.location.reload()}
      >
        Retry
      </button>
    </div>
  );

  return (
    <div>
      {!type && trending.length > 0 && <HeroCarousel animeList={trending} />}

      <div className="space-y-2 pb-8">
        {showMain && popular.length > 0 && (
          <AnimeRow
            title="New Releases"
            subtitle="Fresh titles — guaranteed streamable"
            linkTo="/search?type=TRENDING"
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
            title="Latest Episodes"
            subtitle="Recently updated"
            linkTo="/search?type=NEW"
            linkText="View All"
          >
            <div className="relative group/scroll">
              <div ref={recentScrollRef} className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide scroll-smooth">
                {recent.map((anime) => (
                  <div key={anime.id} className="flex-none w-[140px] md:w-[170px]">
                    <AnimeCard anime={anime} />
                  </div>
                ))}
              </div>
              <button
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 hover:bg-black/90 hover:scale-110"
                onClick={() => recentScrollRef.current?.scrollBy({ left: -400, behavior: 'smooth' })}
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 hover:bg-black/90 hover:scale-110"
                onClick={() => recentScrollRef.current?.scrollBy({ left: 400, behavior: 'smooth' })}
                aria-label="Scroll right"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </AnimeRow>
        )}

        {showTopRated && topRated.length > 0 && (
          <AnimeRow
            title="Just Completed"
            subtitle="Finished airing — binge-ready"
            linkTo="/search?type=TOP"
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
              <div className="relative overflow-hidden rounded-3xl glass-panel p-8 md:p-12">
                {/* Pink ambient decorations */}
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/[0.05] via-transparent to-[var(--accent-deep)]/[0.05] pointer-events-none" />
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-[var(--accent)]/[0.06] rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-[var(--accent-deep)]/[0.06] rounded-full blur-[80px] pointer-events-none" />
                {/* Sparkles */}
                <div className="absolute top-6 right-8 w-2 h-2 rounded-full bg-[var(--accent)] animate-sparkle" style={{ animationDelay: '0.5s' }} />
                <div className="absolute bottom-8 left-12 w-1.5 h-1.5 rounded-full bg-[var(--accent)]/60 animate-sparkle" style={{ animationDelay: '1.5s' }} />
                <div className="relative text-center">
                  <div className="inline-flex items-center gap-2 mb-4">
                    <Heart className="w-5 h-5 text-[var(--accent)] animate-heart-beat" fill="currentColor" />
                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                      Stream Your Favorite Anime
                    </h2>
                    <Heart className="w-5 h-5 text-[var(--accent)] animate-heart-beat" fill="currentColor" />
                  </div>
                  <p className="text-[var(--text-secondary)] max-w-xl mx-auto mb-8 leading-relaxed">
                    Watch thousands of anime episodes for free. No registration required.
                    New episodes added daily.
                  </p>
                  <div className="flex items-center justify-center gap-4 flex-wrap">
                    <Link
                      to="/search?type=TRENDING"
                      className="px-7 py-3 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-bold text-sm rounded-full transition-all duration-300 hover:shadow-[0_0_30px_rgba(var(--accent-rgb),0.3)] hover:scale-[1.03]"
                    >
                      Browse Trending
                    </Link>
                    <Link
                      to="/search?type=NEW"
                      className="px-7 py-3 text-white/60 hover:text-white font-semibold text-sm rounded-full border border-white/[0.1] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/[0.06] transition-all duration-300"
                    >
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
