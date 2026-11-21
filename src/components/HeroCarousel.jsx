import { Link } from 'react-router-dom';
import Carousel from './Carousel';
import ScoreBead from './ScoreBead';
import BeadStrip from './BeadStrip';
import { getDisplayTitle } from '../api/apiService';
import { progressFor } from '@/lib/progress';
import { Info, Play } from '@/components/icons';
import { TextureButton } from '@/components/ui/texture-button';

export default function HeroCarousel({ animeList, aside }) {
  return (
    <Carousel
      items={animeList}
      aside={aside}
      renderContent={(a) => {
        const title = getDisplayTitle(a);
        const total = a.episodes || a.episodeCount || a._raw?.episodes?.total || 0;
        const progress = progressFor(a.id);
        const resumeEp = progress?.episode || 1;
        return (
          <>
            <h1 className="text-2xl sm:text-3xl lg:text-[2.75rem] text-[var(--r7)] mb-2 leading-[1.15] animate-fade-in-up">
              {title}
            </h1>

            {a.title?.romaji && a.title.romaji !== title && (
              <p className="text-base sm:text-lg text-[var(--accent)] mb-3 animate-fade-in-up">{a.title.romaji}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--r5)] mb-3">
              {(a.format || a.type) && <span className="text-[var(--accent)]">{String(a.format || a.type).replace('_', ' ')}</span>}
              {a.averageScore && <ScoreBead score={a.averageScore} className="text-[var(--r7)]" />}
              {a.season && a.seasonYear && (
                <span>{a.season.charAt(0) + a.season.slice(1).toLowerCase()} {a.seasonYear}</span>
              )}
              {a.studios?.nodes?.[0] && <span>{a.studios.nodes[0].name}</span>}
            </div>

            {(a.description || a.synopsis) && (
              <p className="hidden sm:block text-sm text-[var(--r6)] mb-4 line-clamp-3 leading-relaxed max-w-[65ch]">
                {(a.description || a.synopsis || '').replace(/<[^>]*>/g, '')}
              </p>
            )}

            {total > 0 && (
              <div className="mb-5">
                <p className="text-xs text-[var(--r5)] mb-2 tabular">
                  {progress ? `Episode ${resumeEp} of ${total} · ${progress.seen.length} opened` : `${total} episodes`}
                </p>
                <BeadStrip total={total} current={progress?.episode} seen={progress?.seen} />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <TextureButton asChild variant="accent" size="lg" className="w-auto">
                <Link to={`/anime/${a.id}${progress ? `?ep=${resumeEp}` : ''}`}>
                  <Play className="w-5 h-5" />
                  {progress ? `Continue EP ${resumeEp}` : 'Watch now'}
                </Link>
              </TextureButton>
              <TextureButton asChild variant="secondary" size="lg" className="w-auto">
                <Link to={`/anime/${a.id}`}><Info className="w-5 h-5" />Details</Link>
              </TextureButton>
            </div>
          </>
        );
      }}
    />
  );
}
