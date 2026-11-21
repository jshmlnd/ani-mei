import { TextureButton } from '@/components/ui/texture-button';
import { GradientHeading } from '@/components/ui/gradient-heading';
import { TextureCard } from '@/components/ui/texture-card';
import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getHome,
  getDisplayTitle,
} from '../api/apiService';
import HeroCarousel from '../components/HeroCarousel';
import AnimeCard from '../components/AnimeCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { ChevronRight, ChevronLeft, AlertCircle, Heart } from '@/components/icons';
import BeadStrip from '../components/BeadStrip';
import { recentShows } from '@/lib/progress';

// Spotlight side column: shows Jimei opened on this device (newest first, with
// their bead strips), topped up with more trending titles so it is never sparse.
function AsideItem({ it }) {
  return (
    <Link to={it.to} className="card-hover flex gap-3 bg-[var(--r1)] p-2">
      <div className="w-12 flex-none aspect-[3/4] bg-[var(--r3)] overflow-hidden flex items-center justify-center">
        {it.poster ? (
          <img src={it.poster} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="bead bead-hollow" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex flex-col justify-center gap-1">
        <p className="text-sm text-[var(--r7)] line-clamp-2 leading-snug">{it.title}</p>
        {it.meta && <p className="text-xs text-[var(--r5)] tabular">{it.meta}</p>}
        {it.strip}
      </div>
    </Link>
  );
}

function AsideGroup({ title, items }) {
  if (!items.length) return null;
  return (
    <div>
      <h2 className="text-lg text-[var(--r7)] flex items-center gap-2 mb-3">
        <span className="bead bead-lit mr-1" style={{ '--b': '12px' }} aria-hidden="true" />
        {title}
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-2">
        {items.map((it) => <AsideItem key={it.key} it={it} />)}
      </div>
    </div>
  );
}

function SpotlightAside({ shows, more }) {
  const continuing = shows.slice(0, 4).map((s) => ({
    key: s.id,
    to: `/anime/${s.id}?ep=${s.episode}`,
    poster: s.poster,
    title: s.title,
    meta: `Episode ${s.episode}${s.total ? ` of ${s.total}` : ''}`,
    strip: s.total > 0 && <BeadStrip total={s.total} current={s.episode} seen={s.seen} max={9} />,
  }));
  const seenIds = new Set(shows.map((s) => String(s.id)));
  const extra = more
    .filter((a) => !seenIds.has(String(a.id)))
    .slice(0, Math.max(0, 4 - continuing.length))
    .map((a) => ({
      key: a.id,
      to: `/anime/${a.id}`,
      poster: a.coverImage?.large || a.poster,
      title: getDisplayTitle(a),
      meta: [a.format || a.type, a.episodes && `${a.episodes} eps`].filter(Boolean).join(' · ').replace('_', ' '),
    }));
  if (!continuing.length && !extra.length) return null;
  return (
    <TextureCard>
      <div className="p-4 space-y-5">
        <AsideGroup title="Continue for Jimei" items={continuing} />
        <AsideGroup title="Also trending" items={extra} />
      </div>
    </TextureCard>
  );
}

function AnimeRow({ title, subtitle, linkTo, linkText, children }) {
  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-xl md:text-2xl text-[var(--r7)] flex items-center gap-2">
              <span className="bead bead-lit mr-1" style={{ '--b': '12px' }} aria-hidden="true" />
              {title}
            </h2>
            {subtitle && <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p>}
          </div>
          {linkTo && (
            <Link
              to={linkTo}
              className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 px-4 py-2 text-sm text-[var(--accent)] hover:text-[var(--r7)] hover:bg-[var(--r3)] border-2 border-[var(--r4)] hover:border-[var(--accent)] transition-colors duration-100"
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
  const [continueList] = useState(() => recentShows(8));

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
        className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-[var(--r0)] text-sm transition-all duration-300"
        onClick={() => window.location.reload()}
      >
        Retry
      </button>
    </div>
  );

  return (
    <div className="pt-16">
      {!type && trending.length > 0 && (
        <HeroCarousel animeList={trending} aside={<SpotlightAside shows={continueList} more={trending.slice(1)} />} />
      )}

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
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-[var(--r0)] text-[var(--r7)] flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 hover:bg-[var(--r3)]"
                onClick={() => recentScrollRef.current?.scrollBy({ left: -400, behavior: 'smooth' })}
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-[var(--r0)] text-[var(--r7)] flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 hover:bg-[var(--r3)]"
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
              <TextureCard><div className="relative overflow-hidden p-8 md:p-12">
                <div className="relative text-center">
                  <div className="inline-flex items-center gap-2 mb-4">
                    <Heart className="w-5 h-5 text-[var(--accent)] animate-heart-beat" fill="currentColor" />
                    <GradientHeading as="h2" variant="animei" size="sm" className="leading-tight">
                      Stream Your Favorite Anime
                    </GradientHeading>
                    <Heart className="w-5 h-5 text-[var(--accent)] animate-heart-beat" fill="currentColor" />
                  </div>
                  <p className="text-[var(--text-secondary)] max-w-xl mx-auto mb-8 leading-relaxed">
                    Pick something from the rows above, or jump straight to what's trending. No account needed.
                  </p>
                  <div className="flex items-center justify-center gap-4 flex-wrap">
                    <TextureButton asChild variant="accent" size="lg" className="w-auto">
                      <Link to="/search?type=TRENDING">Browse Trending</Link>
                    </TextureButton>
                    <TextureButton asChild variant="secondary" size="lg" className="w-auto">
                      <Link to="/search?type=NEW">New Releases</Link>
                    </TextureButton>
                  </div>
                </div>
              </div></TextureCard>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
