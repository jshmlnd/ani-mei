import ScoreBead from './ScoreBead';
import { MinimalCard } from '@/components/ui/minimal-card';
import { Link } from 'react-router-dom';
import { getDisplayTitle } from '../api/apiService';
import { useState } from 'react';
import { ImageIcon, Play } from '@/components/icons';

export default function AnimeCard({ anime, className = '' }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const title = getDisplayTitle(anime);
  const coverImage = anime.coverImage?.large || anime.coverImage?.medium || anime.poster || anime._raw?.poster;
  const displayEpisodes = anime.episodes ?? anime.episodeCount ?? anime._raw?.episodes?.total ?? anime._raw?.episodes?.sub;
  const displayFormat = anime.format || anime.type || anime._raw?.type;

  return (
    <Link
      to={`/anime/${anime.id}`}
      className={`group relative block h-full card-hover  ${className}`}
    >
      <MinimalCard className="h-full p-1.5">
      <figure className="relative aspect-[3/4] overflow-hidden">
        {!imageError && (
          <img
            src={coverImage}
            alt={title}
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover transition-all duration-700 ease-out  group-hover:brightness-110 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}

        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-[var(--bg-elevated)] flex items-center justify-center">
            <div className="animate-shimmer w-full h-full" />
          </div>
        )}

        {imageError && (
          <div className="absolute inset-0 bg-[var(--bg-elevated)] flex items-center justify-center">
            <div className="text-center px-4">
              <ImageIcon className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-2" />
              <p className="text-xs text-[var(--text-muted)] line-clamp-2">{title}</p>
            </div>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--r0)] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Score badge */}
        {anime.averageScore && (
          <div className="absolute top-2.5 right-2.5 z-10">
            <ScoreBead score={anime.averageScore} className="px-2 py-1 text-xs text-[var(--r7)] bg-[var(--r0)] border-2 border-[var(--r0)]" />
          </div>
        )}

        {/* Format badge */}
        {displayFormat && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="px-2.5 py-1 text-[10px] uppercase tracking-wide bg-[var(--r3)] text-[var(--accent)] border border-[var(--r4)]">
              {String(displayFormat).replace('_', ' ')}
            </span>
          </div>
        )}

        {/* Airing badge */}
        {anime.nextAiringEpisode && (
          <div className="absolute bottom-14 left-2.5 z-10">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] bg-[var(--r0)] text-[var(--mint)]"><span className="bead bead-mint" style={{ '--b': '8px' }} />
              Ep {anime.nextAiringEpisode.episode} airing
            </span>
          </div>
        )}

        {/* Play button on hover */}
        <div className="absolute bottom-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          <div className="w-11 h-11 flex items-center justify-center bg-[var(--accent)]">
            <Play className="w-5 h-5 text-[var(--r0)]" />
          </div>
        </div>

        {/* Bottom info on hover */}
        <div className="absolute bottom-0 left-0 right-0 p-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-3 group-hover:translate-y-0">
          <p className="text-xs text-[var(--r6)] line-clamp-2 leading-relaxed">
            {(anime.description || anime.synopsis || '').replace(/<[^>]*>/g, '').slice(0, 120)}
            {(anime.description || anime.synopsis || '').length > 120 ? '...' : ''}
          </p>
        </div>
      </figure>

      <div className="p-3">
        <h3 className="text-sm text-[var(--text-primary)] leading-snug line-clamp-2 group-hover:text-[var(--accent)] transition-colors duration-300">
          {title}
        </h3>
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[var(--text-muted)]">
          {displayEpisodes && <span>{displayEpisodes} eps</span>}
          {anime.season && anime.seasonYear && (
            <>
              <span className="w-1 h-1 bg-[var(--text-muted)]" />
              <span>{anime.season.charAt(0) + anime.season.slice(1).toLowerCase()} {anime.seasonYear}</span>
            </>
          )}
          {!anime.season && anime.type && displayEpisodes && (
            <>
              <span className="w-1 h-1 bg-[var(--text-muted)]" />
              <span>{anime.type}</span>
            </>
          )}
        </div>
      </div>
    </MinimalCard>
    </Link>
  );
}
