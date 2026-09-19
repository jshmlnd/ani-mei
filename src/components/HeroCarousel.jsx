import { Link } from 'react-router-dom';
import Carousel from './Carousel';
import { getDisplayTitle } from '../api/apiService';
import { Info, Play, Sparkles } from 'lucide-react';

export default function HeroCarousel({ animeList }) {
  return (
    <Carousel
      items={animeList}
      className="h-[80vh] min-h-[600px] max-h-[820px]"
      renderContent={(a) => (
        <>
          <div className="flex items-center gap-2 mb-5 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold bg-[var(--accent)]/20 text-[var(--accent)] rounded-full border border-[var(--accent)]/25 backdrop-blur-sm">
              <Sparkles className="w-3 h-3" />
              Featured
            </span>
            {(a.format || a.type) && (
              <span className="px-3 py-1 text-xs font-bold bg-white/[0.08] text-white/70 rounded-full border border-white/[0.1] backdrop-blur-sm">
                {String(a.format || a.type).replace('_', ' ')}
              </span>
            )}
            {a.averageScore && (
              <span className="px-3 py-1 text-xs font-bold bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/25 backdrop-blur-sm">
                {a.averageScore}%
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-[3.25rem] font-bold text-white mb-3 leading-[1.1] line-clamp-2 animate-fade-in-up tracking-tight" style={{ animationDelay: '0.2s' }}>
            {getDisplayTitle(a)}
          </h1>

          {a.title?.romaji && a.title?.romaji !== getDisplayTitle(a) && (
            <p className="text-lg text-[var(--accent)]/60 mb-3 font-medium animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              {a.title.romaji}
            </p>
          )}

          <div className="flex items-center gap-3 text-sm text-white/50 mb-4 animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
            {a.season && a.seasonYear && (
              <span>{a.season.charAt(0) + a.season.slice(1).toLowerCase()} {a.seasonYear}</span>
            )}
            {(a.episodes || a.episodeCount || a._raw?.episodes?.total) && (
              <>
                <span className="w-1 h-1 bg-white/25 rounded-full" />
                <span>{a.episodes || a.episodeCount || a._raw?.episodes?.total} Episodes</span>
              </>
            )}
            {a.studios?.nodes?.[0] && (
              <>
                <span className="w-1 h-1 bg-white/25 rounded-full" />
                <span>{a.studios.nodes[0].name}</span>
              </>
            )}
          </div>

          {(a.description || a.synopsis) && (
            <p className="text-sm text-white/45 mb-6 line-clamp-3 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              {(a.description || a.synopsis || '').replace(/<[^>]*>/g, '')}
            </p>
          )}

          {a.genres && a.genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-7 animate-fade-in-up" style={{ animationDelay: '0.45s' }}>
              {a.genres.slice(0, 5).map((genre) => {
                const g = typeof genre === 'string' ? genre : genre?.name;
                return (
                  <span key={g} className="px-3 py-1 text-xs font-medium bg-[var(--accent)]/[0.08] text-[var(--accent)]/80 rounded-full border border-[var(--accent)]/[0.15] backdrop-blur-sm">
                    {g}
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
            <Link
              to={`/anime/${a.id}`}
              className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-bold text-sm rounded-full transition-all duration-300 hover:shadow-[0_0_30px_rgba(var(--accent-rgb),0.35)] hover:scale-[1.03]"
            >
              <Play size="14" fill="currentColor" />
              Watch Now
            </Link>
            <Link
              to={`/anime/${a.id}`}
              className="inline-flex items-center gap-2 px-6 py-3.5 text-white/60 hover:text-white font-semibold text-sm rounded-full border border-white/[0.12] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/[0.06] backdrop-blur-sm transition-all duration-300"
            >
              <Info size="14" />
              Details
            </Link>
          </div>
        </>
      )}
    />
  );
}