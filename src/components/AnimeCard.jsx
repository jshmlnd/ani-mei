import { Link } from 'react-router-dom';
import { getDisplayTitle } from '../api/apiService';
import { useState, useRef, useEffect } from 'react';
import { ImageIcon, Star, Play } from 'lucide-react';

export default function AnimeCard({ anime, className = '' }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          img.src = img.dataset.src;
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(img);
    return () => observer.disconnect();
  }, []);

  const title = getDisplayTitle(anime);
  const coverImage = anime.coverImage?.large || anime.coverImage?.medium || anime.poster || anime._raw?.poster;
  const displayEpisodes = anime.episodes ?? anime.episodeCount ?? anime._raw?.episodes?.total ?? anime._raw?.episodes?.sub;
  const displayFormat = anime.format || anime.type || anime._raw?.type;

  return (
    <Link
      to={`/anime/${anime.id}`}
      className={`group relative rounded-xl overflow-hidden bg-[var(--bg-surface)] card-hover ${className}`}
    >
      <figure className="relative aspect-[3/4] overflow-hidden">
        {!imageError && (
          <img
            ref={imgRef}
            data-src={coverImage}
            alt={title}
            className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}

        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-[var(--bg-elevated)] animate-pulse flex items-center justify-center">
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

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />

        {anime.averageScore && (
          <div className="absolute top-2 right-2 z-10">
            <div className="flex items-center gap-1 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded-full border border-white/[0.08]">
              <Star className="w-3 h-3 text-amber-400" fill="currentColor" />
              <span className="text-xs font-bold text-white">{anime.averageScore}</span>
            </div>
          </div>
        )}

        {displayFormat && (
          <div className="absolute top-2 left-2 z-10">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[var(--accent)]/20 text-[var(--accent)] backdrop-blur-sm rounded-md border border-[var(--accent)]/20">
              {String(displayFormat).replace('_', ' ')}
            </span>
          </div>
        )}

        {anime.nextAiringEpisode && (
          <div className="absolute bottom-12 left-2 z-10">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 backdrop-blur-sm rounded-md border border-emerald-500/20">
              Ep {anime.nextAiringEpisode.episode} airing
            </span>
          </div>
        )}

        <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--accent)] shadow-lg shadow-[var(--accent-glow)]">
            <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
          </div>
        </div>
      </figure>

      <div className="p-3">
        <h3 className="text-sm font-bold text-[var(--text-primary)] leading-tight line-clamp-2 group-hover:text-[var(--accent)] transition-colors duration-300">
          {title}
        </h3>
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[var(--text-muted)]">
          {displayEpisodes && <span>{displayEpisodes} eps</span>}
          {anime.season && anime.seasonYear && (
            <>
              <span className="w-0.5 h-0.5 bg-[var(--text-muted)] rounded-full" />
              <span>{anime.season.charAt(0) + anime.season.slice(1).toLowerCase()} {anime.seasonYear}</span>
            </>
          )}
          {!anime.season && anime.type && displayEpisodes && (
            <>
              <span className="w-0.5 h-0.5 bg-[var(--text-muted)] rounded-full" />
              <span>{anime.type}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
