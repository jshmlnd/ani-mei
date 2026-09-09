import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getDisplayTitle } from '../api/apiService';
import { Info, Play, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

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
    <div className="relative w-full h-[80vh] min-h-[600px] max-h-[820px] overflow-hidden">
      {/* Background slides */}
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
            {/* Soft pink-tinted gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-deep)] via-[var(--bg-deep)]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-deep)] via-transparent to-[var(--bg-deep)]/50" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--bg-deep)]" />
            {/* Pink ambient tint */}
            <div className="absolute inset-0 bg-[var(--accent)]/[0.03]" />
          </div>
        </div>
      ))}

      {/* Decorative sparkles */}
      <div className="absolute top-20 right-[15%] w-2 h-2 rounded-full bg-[var(--accent)] animate-sparkle" style={{ animationDelay: '0s' }} />
      <div className="absolute top-32 right-[25%] w-1.5 h-1.5 rounded-full bg-[var(--accent)]/60 animate-sparkle" style={{ animationDelay: '1s' }} />
      <div className="absolute bottom-32 right-[20%] w-2 h-2 rounded-full bg-[var(--accent-deep)]/50 animate-sparkle" style={{ animationDelay: '2s' }} />

      {/* Content */}
      <div className="absolute inset-0 z-20 flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-xl" key={currentIndex}>
            {/* Badges */}
            <div className="flex items-center gap-2 mb-5 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold bg-[var(--accent)]/20 text-[var(--accent)] rounded-full border border-[var(--accent)]/25 backdrop-blur-sm">
                <Sparkles className="w-3 h-3" />
                Featured
              </span>
              {(currentAnime.format || currentAnime.type) && (
                <span className="px-3 py-1 text-xs font-bold bg-white/[0.08] text-white/70 rounded-full border border-white/[0.1] backdrop-blur-sm">
                  {String(currentAnime.format || currentAnime.type).replace('_', ' ')}
                </span>
              )}
              {currentAnime.averageScore && (
                <span className="px-3 py-1 text-xs font-bold bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/25 backdrop-blur-sm">
                  {currentAnime.averageScore}%
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-[3.25rem] font-bold text-white mb-3 leading-[1.1] line-clamp-2 animate-fade-in-up tracking-tight" style={{ animationDelay: '0.2s' }}>
              {getDisplayTitle(currentAnime)}
            </h1>

            {/* Romaji title */}
            {currentAnime.title?.romaji && currentAnime.title?.romaji !== getDisplayTitle(currentAnime) && (
              <p className="text-lg text-[var(--accent)]/60 mb-3 font-medium animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                {currentAnime.title.romaji}
              </p>
            )}

            {/* Meta info */}
            <div className="flex items-center gap-3 text-sm text-white/50 mb-4 animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
              {currentAnime.season && currentAnime.seasonYear && (
                <span>{currentAnime.season.charAt(0) + currentAnime.season.slice(1).toLowerCase()} {currentAnime.seasonYear}</span>
              )}
              {(currentAnime.episodes || currentAnime.episodeCount || currentAnime._raw?.episodes?.total) && (
                <>
                  <span className="w-1 h-1 bg-white/25 rounded-full" />
                  <span>{currentAnime.episodes || currentAnime.episodeCount || currentAnime._raw?.episodes?.total} Episodes</span>
                </>
              )}
              {currentAnime.studios?.nodes?.[0] && (
                <>
                  <span className="w-1 h-1 bg-white/25 rounded-full" />
                  <span>{currentAnime.studios.nodes[0].name}</span>
                </>
              )}
            </div>

            {/* Description */}
            {(currentAnime.description || currentAnime.synopsis) && (
              <p className="text-sm text-white/45 mb-6 line-clamp-3 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                {(currentAnime.description || currentAnime.synopsis || '').replace(/<[^>]*>/g, '')}
              </p>
            )}

            {/* Genres */}
            {currentAnime.genres && currentAnime.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-7 animate-fade-in-up" style={{ animationDelay: '0.45s' }}>
                {currentAnime.genres.slice(0, 5).map((genre) => {
                  const g = typeof genre === 'string' ? genre : genre?.name;
                  return (
                    <span key={g} className="px-3 py-1 text-xs font-medium bg-[var(--accent)]/[0.08] text-[var(--accent)]/80 rounded-full border border-[var(--accent)]/[0.15] backdrop-blur-sm">
                      {g}
                    </span>
                  );
                })}
              </div>
            )}

            {/* CTA buttons */}
            <div className="flex items-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
              <Link
                to={`/anime/${currentAnime.id}`}
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-bold text-sm rounded-full transition-all duration-300 hover:shadow-[0_0_30px_rgba(var(--accent-rgb),0.35)] hover:scale-[1.03]"
              >
                <Play size="14" fill="currentColor" />
                Watch Now
              </Link>
              <Link
                to={`/anime/${currentAnime.id}`}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-white/60 hover:text-white font-semibold text-sm rounded-full border border-white/[0.12] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/[0.06] backdrop-blur-sm transition-all duration-300"
              >
                <Info size="14" />
                Details
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
        {animeList.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`transition-all duration-500 rounded-full ${
              index === currentIndex
                ? 'w-8 h-2.5 bg-[var(--accent)]'
                : 'w-2.5 h-2.5 bg-white/20 hover:bg-[var(--accent)]/40'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Navigation arrows */}
      {animeList.length > 1 && (
        <>
          <button
            onClick={() => goToSlide((currentIndex - 1 + animeList.length) % animeList.length)}
            className="absolute left-5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 flex items-center justify-center rounded-full glass-panel-light hover:bg-[var(--accent)]/[0.1] text-white/50 hover:text-[var(--accent)] transition-all duration-300 hover:scale-110"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => goToSlide((currentIndex + 1) % animeList.length)}
            className="absolute right-5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 flex items-center justify-center rounded-full glass-panel-light hover:bg-[var(--accent)]/[0.1] text-white/50 hover:text-[var(--accent)] transition-all duration-300 hover:scale-110"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
}
