import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getAnimeById,
  getDisplayTitle,
  getEpisodeCount,
  getStreamUrl,
} from '../api/apiService';
import { stripHtml, formatDate } from '../utils/helpers';
import VideoPlayer from '../components/VideoPlayer';
import EpisodeSelector from '../components/EpisodeSelector';
import LoadingSpinner from '../components/LoadingSpinner';
import { AlertCircle, AlertTriangle, CircleOff } from 'lucide-react';

export default function Watch() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [anime, setAnime] = useState(null);
  const [episode, setEpisode] = useState(1);
  const [streamUrl, setStreamUrl] = useState('');
  const [streamFallback, setStreamFallback] = useState('');
  const [streamHeaders, setStreamHeaders] = useState({});
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullDesc, setShowFullDesc] = useState(false);

  useEffect(() => {
    const fetchAnime = async () => {
      try {
        setLoading(true);
        const data = await getAnimeById(id);
        setAnime(data);
      } catch {
        setError('Failed to load anime details');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchAnime();
  }, [id]);

  useEffect(() => {
    if (!anime) return;
    let cancelled = false;
    const fetchStream = async () => {
      setStreamLoading(true);
      setStreamError(null);
      try {
        const title = anime.title?.english || anime.title?.romaji || '';
        const data = await getStreamUrl(title, episode);
        if (!cancelled) {
          setStreamUrl(data.m3u8 || data.embedUrl || '');
          setStreamFallback(!data.m3u8 && data.embedUrl ? data.embedUrl : '');
          setStreamHeaders(data.m3u8Headers || {});
        }
      } catch {
        if (!cancelled) {
          setStreamError('Failed to load stream \u2014 try again later');
        }
      } finally {
        if (!cancelled) setStreamLoading(false);
      }
    };
    fetchStream();
    return () => { cancelled = true; };
  }, [anime, episode]);

  const handleEpisodeChange = (ep) => {
    setEpisode(ep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <LoadingSpinner />;
  if (error) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <AlertCircle className="w-16 h-16 text-[var(--text-muted)]" />
      <p className="text-lg text-[var(--text-secondary)]">{error}</p>
      <button className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-bold text-sm rounded-full transition-all" onClick={() => navigate('/')}>
        Go Home
      </button>
    </div>
  );
  if (!anime) return null;

  const title = getDisplayTitle(anime);
  const totalEpisodes = getEpisodeCount(anime);
  const description = stripHtml(anime.description);
  const relations = anime.relations?.edges?.filter(
    (e) => e.relationType === 'SEQUEL' || e.relationType === 'PREQUEL'
  ) || [];

  return (
    <div className="min-h-screen bg-[var(--bg-deep)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-5">
            {streamLoading ? (
              <div className="w-full aspect-video bg-[var(--bg-surface)] rounded-xl flex items-center justify-center glow-shadow">
                <div className="text-center">
                  <span className="loading loading-spinner loading-lg text-[var(--accent)]"></span>
                  <p className="text-sm text-[var(--text-muted)] mt-3">Loading stream...</p>
                </div>
              </div>
            ) : streamError ? (
              <div className="w-full aspect-video bg-[var(--bg-surface)] rounded-xl flex items-center justify-center glow-shadow">
                <div className="text-center px-4">
                  <AlertTriangle className="w-14 h-14 mx-auto text-red-400/50 mb-3" />
                  <p className="text-sm text-red-400/80 font-medium">{streamError}</p>
                </div>
              </div>
            ) : !streamUrl ? (
              <div className="w-full aspect-video bg-[var(--bg-surface)] rounded-xl flex items-center justify-center glow-shadow">
                <div className="text-center px-4">
                  <CircleOff className="w-14 h-14 mx-auto text-red-400/50 mb-3" />
                  <p className="text-sm text-red-400/80 font-medium">Stream unavailable for this episode</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Try selecting a different episode</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden glow-shadow">
                <VideoPlayer
                  src={streamUrl}
                  fallbackSrc={streamFallback}
                  headers={streamHeaders}
                  poster={anime.bannerImage || anime.coverImage?.large}
                  title={`${title} - Episode ${episode}`}
                />
              </div>
            )}

            <div className="glass-panel rounded-xl p-5">
              <div className="flex items-center gap-2 text-sm mb-3">
                <span className="px-2.5 py-1 text-xs font-bold bg-[var(--accent)]/15 text-[var(--accent)] rounded-full">
                  EP {episode}
                </span>
                <span className="text-[var(--text-muted)]">/ {totalEpisodes} Episodes</span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white">{title}</h1>
              {anime.title?.romaji && anime.title?.romaji !== title && (
                <p className="text-sm text-[var(--text-muted)] mt-1">{anime.title.romaji}</p>
              )}

              <div className="flex flex-wrap gap-1.5 mt-3">
                {anime.genres?.map((genre) => (
                  <span key={genre} className="px-2.5 py-1 text-xs font-medium bg-white/[0.05] text-[var(--text-secondary)] rounded-full border border-white/[0.06]">
                    {genre}
                  </span>
                ))}
              </div>

              {relations.length > 0 && (
                <div className="mt-4 p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                  <p className="text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wider">Related</p>
                  <div className="flex flex-wrap gap-2">
                    {relations.map((rel) => (
                      <button
                        key={rel.node.id}
                        className="px-2.5 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-full border border-[var(--accent)]/20 transition-all"
                        onClick={() => navigate(`/anime/${rel.node.id}`)}
                      >
                        {rel.relationType}: {rel.node.title?.english || rel.node.title?.romaji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="glass-panel rounded-xl p-5">
              <h3 className="font-bold text-white mb-3">Episodes</h3>
              <EpisodeSelector
                totalEpisodes={totalEpisodes}
                currentEpisode={episode}
                onEpisodeChange={handleEpisodeChange}
              />
            </div>

            <div className="glass-panel rounded-xl p-5">
              <h3 className="font-bold text-white mb-3">Synopsis</h3>
              <p className={`text-sm text-[var(--text-secondary)] leading-relaxed ${!showFullDesc ? 'line-clamp-4' : ''}`}>
                {description}
              </p>
              {description.length > 300 && (
                <button
                  className="mt-2 text-xs font-medium text-[var(--accent)] hover:text-white transition-colors"
                  onClick={() => setShowFullDesc(!showFullDesc)}
                >
                  {showFullDesc ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass-panel rounded-xl p-5 sticky top-20">
              <h3 className="font-bold text-white mb-4">Anime Details</h3>
              <div className="space-y-4">
                {anime.coverImage?.large && (
                  <div className="relative rounded-lg overflow-hidden">
                    <img
                      src={anime.coverImage.large}
                      alt={title}
                      className="w-full aspect-[3/4] object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                )}
                <div className="space-y-2.5 text-sm">
                  {anime.format && (
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Format</span>
                      <span className="text-[var(--text-secondary)] font-medium">{anime.format.replace('_', ' ')}</span>
                    </div>
                  )}
                  {anime.status && (
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Status</span>
                      <span className="text-[var(--text-secondary)] font-medium">{anime.status}</span>
                    </div>
                  )}
                  {anime.episodes && (
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Episodes</span>
                      <span className="text-[var(--text-secondary)] font-medium">{anime.episodes}</span>
                    </div>
                  )}
                  {anime.season && anime.seasonYear && (
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Season</span>
                      <span className="text-[var(--text-secondary)] font-medium">{anime.season.charAt(0) + anime.season.slice(1).toLowerCase()} {anime.seasonYear}</span>
                    </div>
                  )}
                  {anime.startDate?.year && (
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Aired</span>
                      <span className="text-[var(--text-secondary)] font-medium">{formatDate(anime.startDate)}</span>
                    </div>
                  )}
                  {anime.averageScore && (
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Score</span>
                      <span className="text-amber-400 font-bold">{anime.averageScore}%</span>
                    </div>
                  )}
                  {anime.studios?.nodes?.[0] && (
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Studio</span>
                      <span className="text-[var(--text-secondary)] font-medium">{anime.studios.nodes[0].name}</span>
                    </div>
                  )}
                </div>
              </div>

              {anime.characters?.nodes?.length > 0 && (
                <div className="mt-5 pt-5 border-t border-white/[0.06]">
                  <h4 className="font-bold text-sm text-white mb-3">Characters</h4>
                  <div className="space-y-2.5">
                    {anime.characters.nodes.map((char, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                        <img
                          src={char.image?.large}
                          alt={char.name?.full}
                          className="w-9 h-9 rounded-full object-cover ring-2 ring-white/[0.06]"
                          loading="lazy"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{char.name?.full}</p>
                          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Main</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
