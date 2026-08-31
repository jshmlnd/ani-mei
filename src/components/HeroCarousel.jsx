import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getDisplayTitle } from '../api/apiService';
import { Info, Play, ChevronLeft, ChevronRight } from 'lucide-react';

export default function HeroCarousel({ animeList }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToSlide = useCallback((index) => {
    if (isTransitioning || index === currentIndex) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 700);
  }, [isTransitioning, currentIndex]);

  useEffect(() => {
    if (!animeList || animeList.length <= 1) return;
    const timer = setInterval(() => {
      goToSlide((currentIndex + 1) % animeList.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [animeList, goToSlide, currentIndex]);

  if (!animeList || animeList.length === 0) return null;

  const currentAnime = animeList[currentIndex];

  return (
    <div className="relative w-full h-[75vh] min-h-[550px] max-h-[750px] overflow-hidden">
      {animeList.map((anime, index) => (
        <div
          key={anime.id}
          className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
            index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
        >
          <div className="absolute inset-0">
            <img
              src={anime.bannerImage || anime.coverImage?.large || anime.poster || anime._raw?.poster}
              alt={getDisplayTitle(anime)}
              className={`w-full h-full object-cover ${
                index === currentIndex ? 'animate-ken-burns' : ''
              }`}
              loading={index === 0 ? 'eager' : 'lazy'}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-deep)] via-[var(--bg-deep)]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-deep)] via-transparent to-[var(--bg-deep)]/30" />
          </div>
        </div>
      ))}

      <div className="absolute inset-0 z-20 flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-xl" key={currentIndex}>
            <div className="flex items-center gap-2 mb-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              {(currentAnime.format || currentAnime.type) && (
                <span className="px-2.5 py-1 text-xs font-bold bg-[var(--accent)]/20 text-[var(--accent)] rounded-full border border-[var(--accent)]/30">
                  {String(currentAnime.format || currentAnime.type).replace('_', ' ')}
                </span>
              )}
              {currentAnime.averageScore && (
                <span className="px-2.5 py-1 text-xs font-bold bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
                  {currentAnime.averageScore}%
                </span>
              )}
              {currentAnime.status && (
                <span className="px-2.5 py-1 text-xs font-medium bg-white/[0.06] text-white/60 rounded-full border border-white/[0.08]">
                  {currentAnime.status}
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-3 leading-[1.1] line-clamp-2 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              {getDisplayTitle(currentAnime)}
            </h1>

            {currentAnime.title?.romaji && currentAnime.title?.romaji !== getDisplayTitle(currentAnime) && (
              <p className="text-lg text-white/50 mb-3 font-medium animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                {currentAnime.title.romaji}
              </p>
            )}

            <div className="flex items-center gap-3 text-sm text-white/60 mb-4 animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
              {currentAnime.season && currentAnime.seasonYear && (
                <span>{currentAnime.season.charAt(0) + currentAnime.season.slice(1).toLowerCase()} {currentAnime.seasonYear}</span>
              )}
              {(currentAnime.episodes || currentAnime.episodeCount || currentAnime._raw?.episodes?.total) && (
                <>
                  <span className="w-1 h-1 bg-white/30 rounded-full" />
                  <span>{currentAnime.episodes || currentAnime.episodeCount || currentAnime._raw?.episodes?.total} Episodes</span>
                </>
              )}
              {currentAnime.studios?.nodes?.[0] && (
                <>
                  <span className="w-1 h-1 bg-white/30 rounded-full" />
                  <span>{currentAnime.studios.nodes[0].name}</span>
                </>
              )}
              {!currentAnime.season && currentAnime.type && !currentAnime.studios?.nodes?.[0] && currentAnime.score && (
                <>
                  <span className="w-1 h-1 bg-white/30 rounded-full" />
                  <span>Score {currentAnime.score}</span>
                </>
              )}
            </div>

            {(currentAnime.description || currentAnime.synopsis) && (
              <p className="text-sm text-white/50 mb-5 line-clamp-3 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                {(currentAnime.description || currentAnime.synopsis || '').replace(/<[^>]*>/g, '')}
              </p>
            )}

            {currentAnime.genres && currentAnime.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6 animate-fade-in-up" style={{ animationDelay: '0.45s' }}>
                {currentAnime.genres.slice(0, 5).map((genre) => {
                  const g = typeof genre === 'string' ? genre : genre?.name;
                  return (
                    <span key={g} className="px-2.5 py-1 text-xs font-medium bg-white/[0.06] text-white/70 rounded-full border border-white/[0.08]">
                      {g}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
              <Link
                to={`/anime/${currentAnime.id}`}
                className="group inline-flex items-center gap-2.5 px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-bold text-sm rounded-full transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]"
              >
                <Play size="13"/>
                Watch Now
              </Link>
              <Link
                to={`/anime/${currentAnime.id}`}
                className="inline-flex items-center gap-2 px-5 py-3 text-white/70 hover:text-white font-medium text-sm rounded-full border border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.04] transition-all duration-300"
              >
                <Info size="13" />
                Details
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5">
        {animeList.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`transition-all duration-500 rounded-full ${
              index === currentIndex
                ? 'w-10 h-2.5 bg-[var(--accent)] shadow-[0_0_12px_rgba(168,85,247,0.5)]'
                : 'w-2.5 h-2.5 bg-white/25 hover:bg-white/45'
            }`}
          />
        ))}
      </div>

      {animeList.length > 1 && (
        <>
          <button
            onClick={() => goToSlide((currentIndex - 1 + animeList.length) % animeList.length)}
            className="absolute left-5 top-1/2 -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center rounded-full glass-panel-light hover:bg-white/[0.1] text-white/60 hover:text-white transition-all duration-300"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => goToSlide((currentIndex + 1) % animeList.length)}
            className="absolute right-5 top-1/2 -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center rounded-full glass-panel-light hover:bg-white/[0.1] text-white/60 hover:text-white transition-all duration-300"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
}
