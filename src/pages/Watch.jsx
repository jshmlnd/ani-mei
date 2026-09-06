import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getAnimeById,
  getDisplayTitle,
  getEpisodeCount,
  getStreamUrl,
  getAnimeServers,
  getServers,
  getStreamByLinkId,
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
  const [streamUrl, setStreamUrl] = useState('');
  const [streamFallback, setStreamFallback] = useState('');
  const [streamHeaders, setStreamHeaders] = useState({});
  const [iframeHtml, setIframeHtml] = useState('');
  const [skipData, setSkipData] = useState(null);
  const [sourceInfo, setSourceInfo] = useState(null);
  const streamHeadersRef = useRef(streamHeaders);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullDesc, setShowFullDesc] = useState(false);

  // server selector state — fetched from /servers/:slug/:episode
  const [servers, setServers] = useState({});
  const [flatServers, setFlatServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [serversLoading, setServersLoading] = useState(false);
  const [serversError, setServersError] = useState(null);
  const [resolvedSlug, setResolvedSlug] = useState('');

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

  // Fetch servers for current episode via server-selector API
  // Prefers direct slug if available (stream lists guarantee a valid slug),
  // falling back to title-search for legacy AniList entries.
  useEffect(() => {
    if (!anime) return;
    let cancelled = false;
    const fetchServers = async () => {
      setServersLoading(true);
      setServersError(null);
      setServers({});
      setFlatServers([]);
      setSelectedServer(null);
      // clear previous stream while new episode servers load
      setStreamUrl('');
      setStreamFallback('');
      setStreamHeaders({});
      setIframeHtml('');
      setSkipData(null);
      setSourceInfo(null);
      setStreamError(null);
      try {
        const directSlug = anime.slug || (typeof anime.id === 'string' && anime.id.includes('-') ? anime.id : null) || (typeof id === 'string' && id.includes('-') ? id : null);
        // 1) Try direct slug path (fast, exact match to stream API)
        if (directSlug && directSlug.includes('-')) {
          try {
            const direct = await getServers(directSlug, episode);
            if (cancelled) return;
            if (direct.flat?.length || Object.keys(direct.servers || {}).length) {
              setServers(direct.servers || {});
              setFlatServers(direct.flat || []);
              setResolvedSlug(direct.slug || directSlug);
              const preferred = direct.servers?.sub?.[0] || direct.servers?.dub?.[0] || (direct.flat || [])[0] || null;
              if (preferred) setSelectedServer(preferred);
              return;
            }
          } catch (_e) { void _e; }
        }
        // 2) Fallback: title-based search ranking (for AniList numeric IDs or missing slug)
        const title = anime.title?.english || anime.title?.romaji || getDisplayTitle(anime) || '';
        const data = await getAnimeServers(title, episode);
        if (cancelled) return;
        const srv = data.servers || {};
        const flat = data.flat || [];
        setServers(srv);
        setFlatServers(flat);
        setResolvedSlug(data.slug || directSlug || '');
        // auto-pick best server: prefer SUB first, then first flat entry
        const preferred = srv.sub?.[0] || srv.dub?.[0] || flat[0] || null;
        if (preferred) {
          setSelectedServer(preferred);
        } else if (!flat.length && !Object.keys(srv).length) {
          // No servers found — will fallback to legacy stream attempt in stream effect
          setServersError(null);
        }
      } catch (e) {
        if (!cancelled) setServersError(e?.message || 'Failed to load servers');
      } finally {
        if (!cancelled) setServersLoading(false);
      }
    };
    fetchServers();
    return () => { cancelled = true; };
  }, [anime, episode, id]);

  // Fetch stream for the selected server; fallback to legacy getStreamUrl if no servers
  useEffect(() => {
    if (!anime) return;
    // If servers are still loading, wait
    if (serversLoading) return;

    let cancelled = false;

    const fetchStream = async () => {
      setStreamLoading(true);
      setStreamError(null);
      try {
        if (selectedServer?.linkId) {
          const data = await getStreamByLinkId(selectedServer.linkId, streamHeadersRef.current);
          if (cancelled) return;
          
          // PRIMARY: Worker iframe (preserves subtitles, qualities, sandbox)
          if (data.iframe) {
            setIframeHtml(data.iframe);
            setStreamUrl('');       // No HLS source
            setStreamFallback(data.url || '');  // Embed URL as fallback
            setStreamHeaders(data.m3u8Headers || {});
            setSkipData(data.skipData || null);
            setSourceInfo(data.sourceInfo || null);
            return;
          }
          
          // SECONDARY: Direct m3u8 playback (if worker couldn't provide iframe)
          if (data.m3u8) {
            setIframeHtml('');      // Clear iframe
            setStreamUrl(data.m3u8);
            setStreamFallback(data.url || '');
            setStreamHeaders(data.m3u8Headers || {});
            setSkipData(data.skipData || null);
            setSourceInfo(data.sourceInfo || null);
            return;
          }
          
          // Server returned empty → fallback to legacy
          throw new Error('Server returned no stream');
        }

        // No server selected (empty server list) → legacy fallback via getStreamUrl
        // This keeps old behavior for titles where /servers returns nothing
        if (!flatServers.length && Object.keys(servers).length === 0 && !serversLoading) {
          const title = anime.title?.english || anime.title?.romaji || '';
          const data = await getStreamUrl(title, episode);
          if (cancelled) return;
          if (data.iframe) {
            setIframeHtml(data.iframe);
            setStreamUrl('');
            setStreamFallback(data.url || '');
            setStreamHeaders(data.m3u8Headers || {});
            setSkipData(data.skipData || null);
            setSourceInfo(data.sourceInfo || null);
            return;
          }
          if (data.m3u8) {
            setIframeHtml('');
            setStreamUrl(data.m3u8);
            setStreamFallback(data.url || '');
            setStreamHeaders(data.m3u8Headers || {});
            setSkipData(data.skipData || null);
            setSourceInfo(data.sourceInfo || null);
            return;
          }
          // if legacy also empty, we show unavailable (handled by render)
          return;
        }

        // Edge: servers exist but none selected yet
        setStreamUrl('');
        setStreamFallback('');
        setIframeHtml('');
      } catch (_err) {
        void _err;
        if (cancelled) return;
        // Try legacy as last resort before showing error
        try {
          const title = anime.title?.english || anime.title?.romaji || '';
          const fallback = await getStreamUrl(title, episode);
          if (fallback?.iframe) {
            setIframeHtml(fallback.iframe);
            setStreamUrl('');
            setStreamFallback(fallback.url || '');
            setStreamHeaders(fallback.m3u8Headers || {});
            setSkipData(fallback.skipData || null);
            setSourceInfo(fallback.sourceInfo || null);
            return;
          }
          if (fallback?.m3u8 || fallback?.embedUrl) {
            setIframeHtml('');
            setStreamUrl(fallback.m3u8 || '');
            setStreamFallback(fallback.embedUrl || fallback.url || '');
            setStreamHeaders(fallback.m3u8Headers || {});
            setSkipData(fallback.skipData || null);
            setSourceInfo(fallback.sourceInfo || null);
            return;
          }
        } catch (_e) { void _e; }
        setStreamError('Failed to load stream \u2014 try another server or episode');
      } finally {
        if (!cancelled) setStreamLoading(false);
      }
    };

    fetchStream();
    return () => { cancelled = true; };
  }, [anime, episode, selectedServer, servers, flatServers, serversLoading]);

  // Keep the ref in sync with streamHeaders state
  useEffect(() => {
    streamHeadersRef.current = streamHeaders;
  }, [streamHeaders]);

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
  const description = stripHtml(anime.description || anime.synopsis || '');
  const relations = anime.relations?.edges?.filter(
    (e) => e.relationType === 'SEQUEL' || e.relationType === 'PREQUEL' || e.relationType === 'RELATED'
  ) || [];

  return (
    <div className="min-h-screen bg-[var(--bg-deep)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-5">
            {serversLoading || streamLoading ? (
              <div className="w-full aspect-video bg-[var(--bg-surface)] rounded-xl flex items-center justify-center glow-shadow">
                <div className="text-center">
                  <span className="loading loading-spinner loading-lg text-[var(--accent)]"></span>
                  <p className="text-sm text-[var(--text-muted)] mt-3">{serversLoading ? 'Loading servers...' : 'Loading stream...'}</p>
                </div>
              </div>
            ) : streamError ? (
              <div className="w-full aspect-video bg-[var(--bg-surface)] rounded-xl flex items-center justify-center glow-shadow">
                <div className="text-center px-4">
                  <AlertTriangle className="w-14 h-14 mx-auto text-red-400/50 mb-3" />
                  <p className="text-sm text-red-400/80 font-medium">{streamError}</p>
                </div>
              </div>
            ) : !streamUrl && !streamFallback && !iframeHtml ? (
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
                  iframeHtml={iframeHtml}
                  skipData={skipData}
                  sourceInfo={sourceInfo}
                  onIframeError={() => {
                    setIframeHtml('');
                    if (streamFallback) setStreamUrl(streamFallback);
                  }}
                  poster={anime.bannerImage || anime.coverImage?.large || anime.poster}
                  title={`${title} - Episode ${episode}`}
                />
              </div>
            )}

            <div className="glass-panel rounded-xl p-5">
              <ServerSelector
                servers={servers}
                flat={flatServers}
                selected={selectedServer}
                onSelect={(srv) => {
                  setSelectedServer(srv);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                loading={serversLoading}
                error={serversError}
              />
              {resolvedSlug && !serversLoading && (
                <p className="mt-3 text-[10px] text-[var(--text-muted)]/60 truncate">
                  Source: {resolvedSlug}
                </p>
              )}
            </div>

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
                {anime.genres?.map((genre) => {
                  const g = typeof genre === 'string' ? genre : genre?.name;
                  return (
                    <span key={g} className="px-2.5 py-1 text-xs font-medium bg-white/[0.05] text-[var(--text-secondary)] rounded-full border border-white/[0.06]">
                      {g}
                    </span>
                  );
                })}
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
                {(anime.coverImage?.large || anime.poster) && (
                  <div className="relative rounded-lg overflow-hidden">
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