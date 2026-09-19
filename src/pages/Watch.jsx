import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getAnimeById,
  getDisplayTitle,
  getEpisodeCount,
  getEpisodeStream,
  getTracksForEpisode,
} from '../api/apiService';
import { stripHtml, formatDate } from '../utils/helpers';
import VideoPlayer from '../components/VideoPlayer';
import EpisodeSelector from '../components/EpisodeSelector';
import ServerSelector from '../components/ServerSelector';
import LoadingSpinner from '../components/LoadingSpinner';
import { AlertCircle, AlertTriangle, CircleOff } from 'lucide-react';

export default function Watch() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [anime, setAnime] = useState(null);
  const [episode, setEpisode] = useState(1);
  const [track, setTrack] = useState('sub');
  const [stream, setStream] = useState(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullDesc, setShowFullDesc] = useState(false);

  // ---- Anime details ----
  useEffect(() => {
    let cancelled = false;
    const fetchAnime = async () => {
      try {
        setLoading(true);
        setError(null);
        setEpisode(1);
        setTrack('sub');
        setStream(null);
        setStreamError(null);
        const data = await getAnimeById(id);
        if (!cancelled) setAnime(data);
      } catch {
        if (!cancelled) setError('Failed to load anime details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (id) fetchAnime();
    return () => { cancelled = true; };
  }, [id]);

  const totalEpisodes = anime ? getEpisodeCount(anime) : 0;

  // Current catalog episode entry (id used by /api/stream/catalog/:epId)
  const currentEpEntry = useMemo(() => {
    if (!anime || !Array.isArray(anime.episodesList)) return null;
    return anime.episodesList.find((e) => e.number === episode) || null;
  }, [anime, episode]);

  const availableTracks = useMemo(
    () => (anime ? getTracksForEpisode(anime, currentEpEntry) : ['sub']),
    [anime, currentEpEntry]
  );

  // Effective track — falls back to the first available track when the
  // preferred one isn't offered for this episode (derived, no effect needed)
  const effectiveTrack = availableTracks.includes(track) ? track : (availableTracks[0] || 'sub');

  // ServerSelector adapter — the backend exposes SUB/DUB tracks per episode
  const servers = useMemo(() => {
    const groups = {};
    for (const t of availableTracks) {
      groups[t] = [{ id: t, linkId: t, name: 'MegaPlay', type: t, track: t }];
    }
    return groups;
  }, [availableTracks]);
  const selectedServer = servers[effectiveTrack]?.[0] || null;

  // ---- Stream ----
  useEffect(() => {
    if (!anime) return;
    let cancelled = false;
    const fetchStream = async () => {
      setStreamLoading(true);
      setStreamError(null);
      setStream(null);
      try {
        const data = await getEpisodeStream({
          catalogEpId: currentEpEntry?.id || null,
          aniId: anime.aniId || null,
          malId: anime.malId || null,
          episode,
          track: effectiveTrack,
        });
        if (!cancelled) setStream(data);
      } catch (e) {
        if (!cancelled) setStreamError(e?.message || 'Failed to load stream — try another server or episode');
      } finally {
        if (!cancelled) setStreamLoading(false);
      }
    };
    fetchStream();
    return () => { cancelled = true; };
  }, [anime, episode, effectiveTrack, currentEpEntry]);

  const handleEpisodeChange = (ep) => {
    const max = Math.max(1, totalEpisodes || 1);
    const clamped = Math.min(Math.max(1, ep), max);
    if (clamped === episode) return;
    setEpisode(clamped);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Previous / Next — prefer catalog order when episodesList exists
  // so gaps in numbering can't land on a missing episode.
  const currentEpIndex = Array.isArray(anime?.episodesList)
    ? anime.episodesList.findIndex((e) => e.number === episode)
    : -1;
  const hasPrevEpisode = currentEpIndex >= 0 ? currentEpIndex > 0 : episode > 1;
  const hasNextEpisode = currentEpIndex >= 0
    ? currentEpIndex < anime.episodesList.length - 1
    : episode < totalEpisodes;

  const goToPrevEpisode = () => {
    if (!hasPrevEpisode) return;
    if (currentEpIndex >= 0) {
      handleEpisodeChange(anime.episodesList[currentEpIndex - 1].number);
    } else {
      handleEpisodeChange(episode - 1);
    }
  };

  const goToNextEpisode = () => {
    if (!hasNextEpisode) return;
    if (currentEpIndex >= 0) {
      handleEpisodeChange(anime.episodesList[currentEpIndex + 1].number);
    } else {
      handleEpisodeChange(episode + 1);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <AlertCircle className="w-16 h-16 text-[var(--text-muted)]" />
      <p className="text-lg text-[var(--text-secondary)]">{error}</p>
      <button
        className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-bold text-sm rounded-full transition-all duration-300"
        onClick={() => navigate('/')}
      >
        Go Home
      </button>
    </div>
  );
  if (!anime) return null;

  const title = getDisplayTitle(anime);
  const description = stripHtml(anime.description || anime.synopsis || '');
  const relations = anime.relations?.edges?.filter(
    (e) => e.relationType === 'SEQUEL' || e.relationType === 'PREQUEL' || e.relationType === 'RELATED'
  ) || [];
  const hasStream = !!(stream?.m3u8);

  return (
    <div className="min-h-screen bg-[var(--bg-deep)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-5">
            {/* Video Player */}
            {streamLoading ? (
              <div className="w-full aspect-video bg-[var(--bg-surface)] rounded-2xl flex items-center justify-center border border-[var(--border-subtle)]">
                <div className="text-center">
                  <div className="w-10 h-10 mx-auto rounded-full border-2 border-[var(--accent)]/20 border-t-[var(--accent)] animate-spin" />
                  <p className="text-sm text-[var(--text-muted)] mt-3">Loading stream...</p>
                </div>
              </div>
            ) : streamError ? (
              <div className="w-full aspect-video bg-[var(--bg-surface)] rounded-2xl flex items-center justify-center border border-[var(--border-subtle)]">
                <div className="text-center px-4">
                  <AlertTriangle className="w-14 h-14 mx-auto text-red-400/50 mb-3" />
                  <p className="text-sm text-red-400/80 font-medium">{streamError}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Try a different track or episode</p>
                </div>
              </div>
            ) : !hasStream ? (
              <div className="w-full aspect-video bg-[var(--bg-surface)] rounded-2xl flex items-center justify-center border border-[var(--border-subtle)]">
                <div className="text-center px-4">
                  <CircleOff className="w-14 h-14 mx-auto text-red-400/50 mb-3" />
                  <p className="text-sm text-red-400/80 font-medium">Stream unavailable for this episode</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Try selecting a different episode</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden border border-[var(--border-subtle)]">
                <VideoPlayer
                  key={`${anime.id}-${episode}-${effectiveTrack}`}
                  src={stream.m3u8}
                  extSubtitles={stream.subtitles}
                  intro={stream.intro}
                  outro={stream.outro}
                  poster={anime.bannerImage || anime.coverImage?.large || anime.poster}
                  title={`${title} - Episode ${episode}`}
                />
              </div>
            )}

            {/* Episode Navigation */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                type="button"
                disabled={!hasPrevEpisode}
                onClick={goToPrevEpisode}
                className="btn btn-dash rounded-full border-[var(--accent)]/80 text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                Previous Episode
              </button>
              <button
                type="button"
                disabled={!hasNextEpisode}
                onClick={goToNextEpisode}
                className="btn btn-dash rounded-full border-[var(--accent)]/80 text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                Next Episode
              </button>
            </div>

            {/* Server Selector */}
            <div className="glass-panel rounded-2xl p-5">
              <ServerSelector
                servers={servers}
                selected={selectedServer}
                onSelect={(srv) => {
                  if (srv?.track) setTrack(srv.track);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                loading={false}
                error={null}
              />
              {anime.aniId && (
                <p className="mt-3 text-[10px] text-[var(--text-muted)]/50 truncate">
                  AniList #{anime.aniId}{anime.malId ? ` · MAL #${anime.malId}` : ''}
                </p>
              )}
            </div>

            {/* Episode Info */}
            <div className="glass-panel rounded-2xl p-5">
              <div className="flex items-center gap-2 text-sm mb-3">
                <span className="px-3 py-1.5 text-xs font-bold bg-[var(--accent)]/15 text-[var(--accent)] rounded-full border border-[var(--accent)]/20">
                  EP {episode}
                </span>
                <span className="text-[var(--text-muted)]">/ {totalEpisodes} Episodes</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">{title}</h1>
              {anime.title?.romaji && anime.title?.romaji !== title && (
                <p className="text-sm text-[var(--accent)]/60 mt-1">{anime.title.romaji}</p>
              )}

              <div className="flex flex-wrap gap-1.5 mt-3">
                {anime.genres?.map((genre) => {
                  const g = typeof genre === 'string' ? genre : genre?.name;
                  return (
                    <span key={g} className="px-3 py-1 text-xs font-medium bg-[var(--accent)]/[0.08] text-[var(--accent)]/80 rounded-full border border-[var(--accent)]/[0.15]">
                      {g}
                    </span>
                  );
                })}
              </div>

              {relations.length > 0 && (
                <div className="mt-4 p-3 bg-[var(--accent)]/[0.03] rounded-xl border border-[var(--accent)]/[0.08]">
                  <p className="text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wider">Related</p>
                  <div className="flex flex-wrap gap-2">
                    {relations.map((rel) => (
                      <button
                        key={rel.node.id}
                        className="px-3 py-1 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-full border border-[var(--accent)]/20 transition-all duration-200"
                        onClick={() => navigate(`/anime/ani-${rel.node.id}`)}
                      >
                        {rel.relationType}: {rel.node.title?.english || rel.node.title?.romaji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Episode Selector */}
            <div className="glass-panel rounded-2xl p-5">
              <h3 className="font-bold text-white mb-3 text-sm uppercase tracking-wider">Episodes</h3>
              <EpisodeSelector
                totalEpisodes={totalEpisodes}
                currentEpisode={episode}
                onEpisodeChange={handleEpisodeChange}
              />
            </div>

            {/* Synopsis */}
            <div className="glass-panel rounded-2xl p-5">
              <h3 className="font-bold text-white mb-3 text-sm uppercase tracking-wider">Synopsis</h3>
              <p className={`text-sm text-[var(--text-secondary)] leading-relaxed ${!showFullDesc ? 'line-clamp-4' : ''}`}>
                {description}
              </p>
              {description.length > 300 && (
                <button
                  className="mt-2 text-xs font-semibold text-[var(--accent)] cursor-pointer hover:text-white transition-colors duration-200"
                  onClick={() => setShowFullDesc(!showFullDesc)}
                >
                  {showFullDesc ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="glass-panel rounded-2xl p-5 top-20">
              <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Anime Details</h3>
              <div className="space-y-4">
                {(anime.coverImage?.large || anime.poster) && (
                  <div className="relative rounded-xl overflow-hidden">
                    <img
                      src={anime.coverImage?.large || anime.poster}
                      alt={title}
                      className="w-full aspect-[3/4] object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                )}
                <div className="space-y-2.5 text-sm">
                  {(anime.format || anime.type) && (
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Format</span>
                      <span className="text-[var(--text-secondary)] font-medium">{String(anime.format || anime.type).replace('_', ' ')}</span>
                    </div>
                  )}
                  {anime.status && (
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Status</span>
                      <span className="text-[var(--text-secondary)] font-medium">{anime.status}</span>
                    </div>
                  )}
                  {totalEpisodes > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Episodes</span>
                      <span className="text-[var(--text-secondary)] font-medium">{totalEpisodes}</span>
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
                <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
                  <h4 className="font-bold text-sm text-white mb-3 uppercase tracking-wider">Characters</h4>
                  <div className="space-y-2.5">
                    {anime.characters.nodes.map((char, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[var(--accent)]/[0.05] transition-colors duration-200">
                        <img
                          src={char.image?.large}
                          alt={char.name?.full}
                          className="w-9 h-9 rounded-full object-cover ring-2 ring-[var(--accent)]/20"
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
