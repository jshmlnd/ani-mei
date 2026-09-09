import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import { AlertTriangle, Play, Pause, SkipBack, SkipForward, VolumeX, Volume1, Volume2, Minimize2, Maximize2, Subtitles, Gauge, PictureInPicture, PictureInPicture2 } from 'lucide-react';
import SubtitleOverlay from './SubtitleOverlay';
import { parseVtt } from '../utils/vtt';

const MAX_HLS_RETRIES = 2;

// Parsed-VTT cache keyed by subtitle URL (module-level so it survives
// episode remounts; capped inside ensureParsedCues).
const cueCache = new Map();

// Map a subtitle label to a BCP-47 language code for the <track> srclang attribute
const LANG_CODE_MAP = {
  english: 'en', spanish: 'es', indonesian: 'id', thai: 'th', portuguese: 'pt',
  french: 'fr', german: 'de', italian: 'it', arabic: 'ar', russian: 'ru',
  hindi: 'hi', malay: 'ms', vietnamese: 'vi', turkish: 'tr', japanese: 'ja',
  korean: 'ko', chinese: 'zh', dutch: 'nl', polish: 'pl', ukrainian: 'uk',
};

function langCodeFor(sub) {
  if (!sub) return 'en';
  if (sub.lang && /^[a-z]{2,3}(-[A-Z]{2})?$/.test(sub.lang)) return sub.lang;
  const fromLabel = LANG_CODE_MAP[String(sub.label || '').toLowerCase().trim()];
  if (fromLabel) return fromLabel;
  return 'en';
}

// Native (<track>) cue lift in px from the bottom of the video.
// Controls hidden -> bottom-28 (112px); controls visible -> above the control bar.
const CUE_LIFT_CONTROLS_VISIBLE = 128;
const CUE_LIFT_CONTROLS_HIDDEN = 112;

export default function VideoPlayer({ 
  src, 
  headers = {}, 
  poster, 
  title, 
  fallbackSrc, 
  iframeHtml, 
  skipData,
  sourceInfo,
  extSubtitles = [],
  intro = null,
  outro = null,
  onIframeError 
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quality, setQuality] = useState(-1);
  const [availableLevels, setAvailableLevels] = useState([]);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPip, setIsPip] = useState(false);
  const [subtitles, setSubtitles] = useState([]);
  // Initial external track = API `default` flag, else first track
  const getInitialExt = () => {
    const d = extSubtitles.findIndex((s) => s.isDefault);
    return d >= 0 ? d : 0;
  };
  const [selectedSubtitle, setSelectedSubtitle] = useState(() => (extSubtitles.length > 0 ? getInitialExt() : -1));
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  // ext index -> true when both proxied + raw URLs failed to load
  const [failedSubs, setFailedSubs] = useState({});
  // ext index -> { status: 'loading' | 'ready' | 'error', cues: [] } for the custom renderer
  const [parsedTracks, setParsedTracks] = useState({});
  const lastSubtitleRef = useRef(null);
  const retriedRef = useRef({});
  const initialExtRef = useRef(getInitialExt());
  const [doubleTapSide, setDoubleTapSide] = useState(null);
  const hideControlsTimer = useRef(null);
  const containerRef = useRef(null);
  const headersRef = useRef(headers);
  const hlsStartedRef = useRef(false);
  const hlsTimeoutRef = useRef(null);
  const hlsRetryRef = useRef(0);
  const doubleTapTimerRef = useRef(null);
  const doubleTapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);

  useEffect(() => {
    headersRef.current = headers;
  }, [headers]);

  // Check if we have iframe HTML from worker (PRIMARY mode)
  const hasIframeHtml = iframeHtml && iframeHtml.includes('<iframe');
  const [iframeFailed, setIframeFailed] = useState(false);

  // Reset iframeFailed when iframeHtml changes (new server/episode selected)
  useEffect(() => {
    setIframeFailed(false);
    setIframeLoaded(false);
  }, [iframeHtml]);

  // Parse iframe HTML to extract src and attributes
  const parseIframeHtml = useCallback((html) => {
    if (!html) return { src: '', attrs: {} };
    const match = html.match(/<iframe\s+([^>]+)>/i);
    if (!match) return { src: '', attrs: {} };
    const attrStr = match[1];
    const attrs = {};
    const attrRegex = /(\w+)=["']([^"']*)["']/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
    return { src: attrs.src || '', attrs };
  }, []);

  const isIOS = typeof navigator !== 'undefined'
    && (/iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const isEchoEmbed = iframeHtml?.includes('echovideo') || iframeHtml?.includes('/embed-') || src?.includes('echovideo') || src?.includes('/embed-');
  const blockEchoOnIOS = isIOS && isEchoEmbed;

  // Check if provider is known to block embedding (echovideo, etc.)
  const providerDomain = sourceInfo?.domain || '';
  const isProblematicProvider = ['echovideo', 'play.echovideo', 'myvidplay'].some(d => 
    providerDomain.includes(d) || iframeHtml?.includes(d) || fallbackSrc?.includes(d)
  );

  // Fallback from iframe to m3u8 when iframe fails (CSP, 403, etc.)
  const handleIframeError = useCallback(() => {
    if (fallbackSrc && !iframeFailed) {
      setIframeFailed(true);
      onIframeError?.();
    }
  }, [fallbackSrc, iframeFailed, onIframeError]);

  // Iframe load timeout - fallback to m3u8 if iframe doesn't load in 10 seconds
  const [iframeLoaded, setIframeLoaded] = useState(false);
  useEffect(() => {
    if (!hasIframeHtml || iframeFailed || iframeLoaded || isProblematicProvider) return;
    const timer = setTimeout(() => {
      if (!iframeLoaded && !iframeFailed && fallbackSrc) {
        setIframeFailed(true);
        onIframeError?.();
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [hasIframeHtml, iframeFailed, iframeLoaded, fallbackSrc, onIframeError, isProblematicProvider]);

  const getProxyUrl = useCallback((targetUrl) => {
    // Only proxy actual m3u8 segment URLs, NOT embed pages
    const isM3u8Segment = targetUrl && (targetUrl.includes('.m3u8') || targetUrl.includes('/m3u8') || targetUrl.includes('hls'))
      && !targetUrl.includes('embed') && !targetUrl.includes('echovideo') && !targetUrl.includes('myvidplay');
    
    if (!isM3u8Segment) return targetUrl; // Return raw URL for embed pages
    
    // No proxy available - use direct URL (segments may fail if CDN blocks browser IPs)
    return targetUrl;
  }, []);

  // Show only our own <track> element at activeExtIndex (-1 = hide all).
  // Uses el.track so HLS-managed TextTracks are never touched by index.
  const setExtVisible = useCallback((activeExt) => {
    const video = videoRef.current;
    if (!video) return;
    video.querySelectorAll('track').forEach((el, i) => {
      if (el.track) el.track.mode = i === activeExt ? 'showing' : 'hidden';
    });
  }, []);

  // Verify an external track actually loaded; on ERROR retry once with the
  // alternate URL (raw <-> proxied), then mark it failed so the menu shows it.
  const verifyTrack = useCallback((extIdx) => {
    const video = videoRef.current;
    if (!video) return;
    const check = (attempt) => {
      const el = video.querySelectorAll('track')[extIdx];
      const track = el?.track;
      if (!track || track.readyState !== 3) return; // 3 = ERROR
      const sub = extSubtitles[extIdx];
      const currentSrc = el.getAttribute('src') || '';
      const alt = attempt === 0 && sub ? (currentSrc === sub.proxiedUrl ? sub.rawUrl : sub.proxiedUrl) : '';
      if (alt && alt !== currentSrc && !retriedRef.current[extIdx]) {
        retriedRef.current[extIdx] = true;
        console.warn(`[subs] "${sub?.label}" failed to load, retrying with alternate URL`);
        el.setAttribute('src', alt);
        // Keep native hidden — the custom overlay renders cues, never the browser
        track.mode = 'hidden';
        setTimeout(() => check(1), 4000);
      } else {
        console.warn(`[subs] "${sub?.label}" failed to load from ${currentSrc}`);
        setFailedSubs((p) => (p[extIdx] ? p : { ...p, [extIdx]: true }));
      }
    };
    check(0);
  }, [extSubtitles]);

  // Fetch + parse an external VTT track for the custom overlay renderer.
  // Tries the <track> element's current src first (verifyTrack may have
  // swapped it to the working alternate), then proxied, then raw URL.
  // Results are cached by URL; total failure marks the track failed (menu ⚠).
  const ensureParsedCues = useCallback((extIdx) => {
    const sub = extSubtitles[extIdx];
    if (!sub || failedSubs[extIdx]) return;
    const cacheKey = sub.proxiedUrl || sub.url;
    const cached = cacheKey ? cueCache.get(cacheKey) : null;
    if (cached) {
      setParsedTracks((p) => (p[extIdx]?.status === 'ready' ? p : { ...p, [extIdx]: cached }));
      return;
    }
    setParsedTracks((p) => (p[extIdx] ? p : { ...p, [extIdx]: { status: 'loading', cues: [] } }));
    const tryUrls = [];
    const elSrc = videoRef.current?.querySelectorAll('track')?.[extIdx]?.getAttribute('src');
    if (elSrc) tryUrls.push(elSrc);
    for (const u of [sub.proxiedUrl, sub.rawUrl, sub.url]) {
      if (u && !tryUrls.includes(u)) tryUrls.push(u);
    }
    (async () => {
      for (const u of tryUrls) {
        try {
          const res = await fetch(u);
          if (!res.ok) continue;
          const entry = { status: 'ready', cues: parseVtt(await res.text()) };
          if (cacheKey) {
            cueCache.set(cacheKey, entry);
            if (cueCache.size > 24) {
              cueCache.delete(cueCache.keys().next().value);
            }
          }
          setParsedTracks((p) => ({ ...p, [extIdx]: entry }));
          return;
        } catch { /* try next URL */ }
      }
      console.warn(`[subs] "${sub?.label}" could not be parsed from any URL`);
      setFailedSubs((p) => (p[extIdx] ? p : { ...p, [extIdx]: true }));
      setParsedTracks((p) => ({ ...p, [extIdx]: { status: 'error', cues: [] } }));
    })();
  }, [extSubtitles, failedSubs]);

  // Apply skipData (subtitles/quality) from API if available
  const skipDataAppliedRef = useRef(false);
  
  useEffect(() => {
    if (skipDataAppliedRef.current) return;
    if (skipData?.subtitles?.length) {
      const subs = skipData.subtitles.map((track, index) => ({
        index,
        lang: track.lang || 'und',
        name: track.name || track.lang || `Track ${index + 1}`,
        default: !!track.default,
      }));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSubtitles(subs);
      const defaultIdx = subs.findIndex(s => s.default);
      if (defaultIdx >= 0) {
        setSelectedSubtitle(defaultIdx);
      }
      skipDataAppliedRef.current = true;
    }
  }, [skipData]);

  // On load, keep ALL native external cues hidden (the custom overlay renders
  // them instead) and kick off fetching+parsing for the initial track.
  // HLS manifest tracks are untouched and keep rendering natively.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || extSubtitles.length === 0) return;
    const initial = initialExtRef.current;
    let timer = null;
    const apply = () => {
      video.querySelectorAll('track').forEach((el) => {
        if (el.track) el.track.mode = 'hidden';
      });
      ensureParsedCues(initial);
      // Confirm the underlying track loaded; auto-retry with alternate URL on failure
      timer = setTimeout(() => verifyTrack(initial), 4000);
    };
    if (video.readyState >= 1) {
      apply();
    } else {
      video.addEventListener('loadedmetadata', apply, { once: true });
    }
    return () => {
      video.removeEventListener('loadedmetadata', apply);
      if (timer) clearTimeout(timer);
    };
  }, [src, extSubtitles.length, verifyTrack, ensureParsedCues]);

const initHls = useCallback(() => {
    // If we have iframe HTML and it hasn't failed and it's not a problematic provider, don't initialize HLS
    if (hasIframeHtml && !iframeFailed && !isProblematicProvider) return;
    
    const video = videoRef.current;
    
    // When iframe fails, ONLY use m3u8 URL (src) - never fallbackSrc (embed URL)
    const hlsSrc = iframeFailed ? src : src;
    if (!video) return;
    
    if (!hlsSrc) {
      setError('No HLS stream available for this server — try a different server');
      setIsLoading(false);
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
    }
    hlsStartedRef.current = false;

    const isHlsSrc = hlsSrc && (hlsSrc.includes('.m3u8') || hlsSrc.includes('/m3u8') || hlsSrc.includes('hls'))
      && !hlsSrc.includes('embed') && !hlsSrc.includes('echovideo') && !hlsSrc.includes('myvidplay');
    
    console.log('[VideoPlayer] initHls:', { hlsSrc, isHlsSrc, iframeFailed, hasIframeHtml });

    if (!isHlsSrc) {
      setError('Stream format not supported on this server — try a different server');
      setIsLoading(false);
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 15,
        maxMaxBufferLength: 60,
        startLevel: -1,
        startFragPrefetch: true,
        lowLatencyMode: false,
        backBufferLength: 0,
        highBufferWatchdogPeriod: 1,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 3,
        enableWorker: true,
        enableSoftwareAES: true,
        handlePartialData: true,
        subtitles: { enabled: true, default: false },
        renditionReport: { playlistType: 'EVENT' },
      });
      hlsRef.current = hls;

      const proxiedUrl = getProxyUrl(hlsSrc);
      hls.loadSource(proxiedUrl);
      try {
        hls.attachMedia(video);
      } catch (err) {
        console.error('[VideoPlayer] attachMedia failed:', err);
        setError('Failed to attach stream — try a different server');
        setIsLoading(false);
        return;
      }

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        hlsStartedRef.current = true;
        hlsRetryRef.current = 0;
        if (hlsTimeoutRef.current) {
          clearTimeout(hlsTimeoutRef.current);
          hlsTimeoutRef.current = null;
        }
        const levels = data.levels.map((level, index) => ({
          index,
          height: level.height,
          width: level.width,
          bitrate: level.bitrate,
          label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}kbps`,
        }));
        setAvailableLevels(levels);
        // Parse subtitle tracks from manifest
        if (data.subtitleTracks?.length) {
          const subs = data.subtitleTracks.map((track, index) => ({
            index,
            lang: track.lang || 'und',
            name: track.name || track.lang || `Track ${index + 1}`,
            default: !!track.default,
          }));
          setSubtitles(subs);
          const defaultIdx = subs.findIndex(s => s.default);
          if (defaultIdx >= 0) {
            setSelectedSubtitle(defaultIdx);
            lastSubtitleRef.current = defaultIdx;
            hls.subtitleTrack = defaultIdx;
            // Only the HLS default may show — hide any external VTT tracks
            video.querySelectorAll('track').forEach((el) => {
              if (el.track) el.track.mode = 'hidden';
            });
          }
        }
        setIsLoading(false);
        hls.currentLevel = -1;
        video.play().catch((err) => {
          if (err.name === 'AbortError') return;
          console.error('[VideoPlayer] play() failed:', err);
          if (err.name === 'NotSupportedError') {
            setError('Stream format not supported — try a different server');
            setIsLoading(false);
          }
        });
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
        if (data.subtitleTracks?.length) {
          const subs = data.subtitleTracks.map((track, index) => ({
            index,
            lang: track.lang || 'und',
            name: track.name || track.lang || `Track ${index + 1}`,
            default: !!track.default,
          }));
          setSubtitles(subs);
        }
      });

      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_, data) => {
        setSelectedSubtitle(data.id);
        lastSubtitleRef.current = data.id;
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setQuality(data.level);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (data.details === 'manifestLoadError' || data.details === 'fragLoadError') {
                if (hlsRetryRef.current < MAX_HLS_RETRIES) {
                  hlsRetryRef.current++;
                  hls.startLoad();
                } else {
                  setError('Stream blocked by CDN (403) — try a different server or episode');
                  hls.destroy();
                }
              } else if (hlsRetryRef.current < MAX_HLS_RETRIES) {
                hlsRetryRef.current++;
                hls.startLoad();
              } else {
                setError(`Network error: ${data.details || 'connection failed'}`);
                hls.destroy();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (hlsRetryRef.current < MAX_HLS_RETRIES) {
                hlsRetryRef.current++;
                hls.recoverMediaError();
              } else {
                setError('Video decode error — try a different quality or server');
                hls.destroy();
              }
              break;
            default:
              setError(`Playback error: ${data.details || 'unknown'}`);
              hls.destroy();
              break;
          }
        }
      });
    } else {
      setError('Your browser does not support HLS video playback');
      setIsLoading(false);
    }
  }, [src, hasIframeHtml, iframeFailed, isProblematicProvider, getProxyUrl]);

  useEffect(() => {
    const t = setTimeout(initHls, 0);
    return () => {
      clearTimeout(t);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (hlsTimeoutRef.current) {
        clearTimeout(hlsTimeoutRef.current);
        hlsTimeoutRef.current = null;
      }
    };
  }, [initHls]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || hasIframeHtml || iframeFailed) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onDurationChange = () => setDuration(video.duration);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onLoadedMetadata = () => {
      if (!hlsStartedRef.current) {
        hlsStartedRef.current = true;
        if (hlsTimeoutRef.current) {
          clearTimeout(hlsTimeoutRef.current);
          hlsTimeoutRef.current = null;
        }
      }
    };
    const onError = () => {
      const videoErr = video.error;
      const code = videoErr?.code;
      const message = videoErr?.message || 'unknown error';
      const detail = code ? ` (error code ${code}: ${message})` : '';
      setError(`Video cannot be played${detail}`);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
    };
  }, [src, fallbackSrc, hasIframeHtml, iframeFailed]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onFullscreenChange = () => setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', onFullscreenChange);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play(); else video.pause();
  }, []);

  const seek = useCallback((e) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    video.currentTime = pos * video.duration;
  }, []);

  const handleVolumeChange = useCallback((e) => {
    const video = videoRef.current;
    if (!video) return;
    const vol = parseFloat(e.target.value);
    video.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container && !video) return;

    const isFs = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

    if (isFs) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
      if (exit) {
        try {
          const p = exit.call(document);
          if (p && typeof p.catch === 'function') await p.catch(() => {});
        } catch {
          // ignore exit errors
        }
      }
      return;
    }

    // Prefer fullscreen on the CONTAINER so custom controls stay visible.
    // Fullscreening only the <video> hides all custom UI (the reported bug).
    if (container) {
      const req =
        container.requestFullscreen ||
        container.webkitRequestFullscreen ||
        container.mozRequestFullScreen ||
        container.msRequestFullscreen;
      if (req) {
        try {
          const p = req.call(container);
          if (p && typeof p.catch === 'function') await p.catch(() => {});
        } catch {
          // ignore request errors (e.g. not triggered by user gesture)
        }
        return;
      }
    }

    // iOS Safari fallback — no container fullscreen support, use native player
    // (custom UI is unavailable in this mode, expected platform limitation).
    if (video && video.webkitEnterFullscreen) {
      try {
        video.webkitEnterFullscreen();
      } catch {
        // ignore
      }
    }
  }, []);

  const changeQuality = useCallback((levelIndex) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setQuality(levelIndex);
    }
  }, []);

  const skip = useCallback((seconds) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  }, []);

  const changePlaybackRate = useCallback((rate) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  }, []);

  const cyclePlaybackRate = useCallback(() => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIdx = speeds.indexOf(playbackRate);
    const nextIdx = (currentIdx + 1) % speeds.length;
    changePlaybackRate(speeds[nextIdx]);
  }, [playbackRate, changePlaybackRate]);

  // Unified subtitle list: HLS manifest tracks first, then external VTT tracks.
  // selectedSubtitle is an index into this list (-1 = off), so exactly one
  // language ever shows instead of all of them at once.
  const subOptions = useMemo(() => {    const opts = [];
    subtitles.forEach((s, i) => opts.push({
      key: `hls-${i}`,
      label: s.name || s.lang || `Track ${i + 1}`,
      kind: 'hls',
      index: i,
    }));
    extSubtitles.forEach((s, i) => opts.push({
      key: `ext-${s.url}-${i}`,
      label: s.label || (s.lang ? String(s.lang).toUpperCase() : `Subtitle ${i + 1}`),
      kind: 'ext',
      index: i,
    }));
    const seen = {};
    return opts.map((o) => {
      const n = (seen[o.label] = (seen[o.label] || 0) + 1);
      return n > 1 ? { ...o, label: `${o.label} ${n}` } : o;
    });
  }, [subtitles, extSubtitles]);

  const selectSubtitle = useCallback((optIdx) => {
    if (optIdx === -1) {
      if (hlsRef.current && subtitles.length) {
        hlsRef.current.subtitleTrack = -1;
        hlsRef.current.subtitleDisplay = false;
      }
      setExtVisible(-1);
      setSelectedSubtitle(-1);
    } else {
      const opt = subOptions[optIdx];
      if (!opt) return;
      if (opt.kind === 'hls' && hlsRef.current) {
        hlsRef.current.subtitleTrack = opt.index;
        hlsRef.current.subtitleDisplay = true;
        setExtVisible(-1);
      } else if (opt.kind === 'ext') {
        if (hlsRef.current && subtitles.length) {
          hlsRef.current.subtitleTrack = -1;
          hlsRef.current.subtitleDisplay = false;
        }
        // Native stays hidden — the custom overlay renders the parsed cues
        setExtVisible(-1);
        ensureParsedCues(opt.index);
        // Confirm it actually loaded; auto-retry with the alternate URL on failure
        setTimeout(() => verifyTrack(opt.index), 4000);
      } else {
        return;
      }
      lastSubtitleRef.current = optIdx;
      setSelectedSubtitle(optIdx);
    }
    setShowSubtitleMenu(false);
  }, [subOptions, subtitles, setExtVisible, verifyTrack, ensureParsedCues]);

  // Quick toggle (CC button long-press behavior / 'C' key): off <-> last language
  const toggleSubtitlesQuick = useCallback(() => {
    if (!subOptions.length) return;
    if (selectedSubtitle === -1) {
      const backTo = lastSubtitleRef.current != null && subOptions[lastSubtitleRef.current]
        ? lastSubtitleRef.current
        : 0;
      selectSubtitle(backTo);
    } else {
      selectSubtitle(-1);
    }
  }, [selectedSubtitle, selectSubtitle, subOptions]);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      void err;
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || hasIframeHtml || iframeFailed) return;
    const onEnterPip = () => setIsPip(true);
    const onLeavePip = () => setIsPip(false);
    video.addEventListener('enterpictureinpicture', onEnterPip);
    video.addEventListener('leavepictureinpicture', onLeavePip);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPip);
      video.removeEventListener('leavepictureinpicture', onLeavePip);
    };
  }, [hasIframeHtml, iframeFailed]);

  // Keep native cues above the custom control bar.
  // Chromium/Safari: handled purely by CSS
  // (::-webkit-media-text-track-display + --cue-lift, see index.css).
  // Firefox (Gecko) has no CSS hook for cue position, so shift
  // default-positioned VTTCues via `line` instead.
  const shiftedCuesRef = useRef(null);
  if (!shiftedCuesRef.current) shiftedCuesRef.current = new WeakSet();
  useEffect(() => {
    const video = videoRef.current;
    if (!video || hasIframeHtml || iframeFailed) return;
    if (typeof VTTCue === 'undefined') return;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isGecko = /\bFirefox\/\d/i.test(ua);
    if (!isGecko) return; // CSS handles it — avoid a double offset
    const shifted = shiftedCuesRef.current;

    const liftPx = showControls ? CUE_LIFT_CONTROLS_VISIBLE : CUE_LIFT_CONTROLS_HIDDEN;
    const applyToTrack = (track) => {
      if (!track || track.mode !== 'showing') return;
      let lines = 4;
      try {
        const h = video.clientHeight || 0;
        if (h > 0) lines = Math.max(2, Math.round(liftPx / (h * 0.055)));
      } catch { /* ignore */ }
      let cues = null;
      try {
        cues = track.cues;
      } catch { /* ignore */ }
      if (!cues) return;
      for (let i = 0; i < cues.length; i++) {
        const cue = cues[i];
        // Only move default-positioned cues; leave explicitly placed ones
        // (e.g. CEA-608 rows, top-positioned titles) alone.
        if (cue instanceof VTTCue && cue.snapToLines && (cue.line === 'auto' || shifted.has(cue))) {
          if (cue.line !== -lines) {
            try {
              cue.line = -lines;
            } catch { /* ignore */ }
          }
          shifted.add(cue);
        }
      }
    };
    const applyAll = () => {
      try {
        for (let i = 0; i < video.textTracks.length; i++) applyToTrack(video.textTracks[i]);
      } catch { /* ignore */ }
    };
    applyAll();

    const watched = [];
    const watch = (t) => {
      if (!t || watched.includes(t)) return;
      watched.push(t);
      try {
        t.addEventListener('cuechange', applyAll);
      } catch { /* ignore */ }
    };
    try {
      for (let i = 0; i < video.textTracks.length; i++) watch(video.textTracks[i]);
    } catch { /* ignore */ }
    const onAddTrack = (e) => {
      if (e?.track) watch(e.track);
      applyAll();
    };
    let trackList = null;
    try {
      trackList = video.textTracks;
      trackList.addEventListener('addtrack', onAddTrack);
    } catch { /* ignore */ }
    return () => {
      watched.forEach((t) => {
        try {
          t.removeEventListener('cuechange', applyAll);
        } catch { /* ignore */ }
      });
      if (trackList) {
        try {
          trackList.removeEventListener('addtrack', onAddTrack);
        } catch { /* ignore */ }
      }
    };
  }, [showControls, selectedSubtitle, subtitles, extSubtitles.length, hasIframeHtml, iframeFailed]);

  const handleVideoTouchEnd = useCallback((e) => {
    if (hasIframeHtml || iframeFailed) return;
    const now = Date.now();
    const timeSince = now - lastTapTimeRef.current;
    const touch = e.changedTouches?.[0];
    if (!touch) return;

    const video = videoRef.current;
    if (!video) return;
    const rect = video.getBoundingClientRect();
    const relX = touch.clientX - rect.left;
    const thirdWidth = rect.width / 3;
    const side = relX < thirdWidth ? 'left' : relX > rect.width - thirdWidth ? 'right' : null;
    if (!side) return; // middle third = normal tap → handled by onClick

    doubleTapCountRef.current += 1;

    if (timeSince < 350 && doubleTapCountRef.current >= 2) {
      // Double-tap detected
      doubleTapCountRef.current = 0;
      if (doubleTapTimerRef.current) clearTimeout(doubleTapTimerRef.current);

      if (side === 'left') {
        video.currentTime = Math.max(0, video.currentTime - 10);
      } else {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
      }
      setDoubleTapSide(side);
      setTimeout(() => setDoubleTapSide(null), 400);
    } else {
      // First tap — wait to see if second tap comes
      lastTapTimeRef.current = now;
      if (doubleTapTimerRef.current) clearTimeout(doubleTapTimerRef.current);
      doubleTapTimerRef.current = setTimeout(() => {
        doubleTapCountRef.current = 0;
      }, 350);
    }
  }, [hasIframeHtml, iframeFailed]);

  useEffect(() => {
    if (hasIframeHtml || iframeFailed) return;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
        case 'm': e.preventDefault(); toggleMute(); break;
        case 'ArrowLeft': e.preventDefault(); skip(-10); break;
        case 'ArrowRight': e.preventDefault(); skip(10); break;
        case '<': case ',': e.preventDefault(); cyclePlaybackRate(); break;
        case '>': case '.': e.preventDefault(); cyclePlaybackRate(); break;
        case 'p': e.preventDefault(); togglePip(); break;
        case 'c': e.preventDefault(); if (subOptions.length) toggleSubtitlesQuick(); break;
        case 'Escape': setShowSpeedMenu(false); setShowSubtitleMenu(false); break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleFullscreen, toggleMute, skip, cyclePlaybackRate, togglePip, subtitles, extSubtitles, toggleSubtitlesQuick, subOptions, hasIframeHtml, iframeFailed]);

  // Close speed menu on outside click
  useEffect(() => {
    if (!showSpeedMenu) return;
    const close = () => setShowSpeedMenu(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showSpeedMenu]);

  // Close subtitle menu on outside click
  useEffect(() => {
    if (!showSubtitleMenu) return;
    const close = () => setShowSubtitleMenu(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showSubtitleMenu]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  const handleTouchStart = useCallback(() => {
    if (showControls) {
      setShowControls(false);
    } else {
      setShowControls(true);
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
      hideControlsTimer.current = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 4000);
    }
  }, [isPlaying, showControls]);

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration ? (buffered / duration) * 100 : 0;

  // For problematic providers (echovideo, etc.), prefer m3u8 directly
  if (hasIframeHtml && !iframeFailed && !isProblematicProvider) {
    if (blockEchoOnIOS) {
      return (
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
          <div className="text-center px-6">
            <AlertTriangle className="w-12 h-12 mx-auto text-red-400/60 mb-3" />
            <p className="text-white font-semibold">This stream is not available on iOS</p>
            <p className="text-sm text-gray-400 mt-1">The provider only offers a web player that iOS cannot run. Try another episode or title.</p>
          </div>
        </div>
      );
    }
    const { src: iframeSrc } = parseIframeHtml(iframeHtml);
    return (
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video" ref={containerRef}>
        {title && (
          <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
            <h2 className="text-white text-lg font-semibold">{title}</h2>
          </div>
        )}
        <iframe
          src={iframeSrc}
          allow="autoplay; fullscreen"
          allowFullScreen="yes"
          frameBorder="no"
          scrolling="no"
          style={{ width: '100%', height: '100%', overflow: 'hidden', border: 'none' }}
          referrerPolicy="no-referrer"
          onLoad={() => {
            setIsLoading(false);
            setIframeLoaded(true);
          }}
          onError={handleIframeError}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-10 h-10 rounded-full border-2 border-[var(--accent)]/20 border-t-[var(--accent)] animate-spin" />
          </div>
        )}
      </div>
    );
  }

  // Custom subtitle overlay: parsed cues for the selected external track.
  // HLS-manifest tracks keep rendering natively (untouched, per design).
  const activeSubOpt = selectedSubtitle >= 0 ? subOptions[selectedSubtitle] : null;
  const overlayEntry = activeSubOpt?.kind === 'ext' ? parsedTracks[activeSubOpt.index] : null;
  const showOverlay = !!overlayEntry && overlayEntry.status === 'ready' && overlayEntry.cues.length > 0;

  return (
    <div
      ref={containerRef}
      className={`relative bg-black rounded-2xl overflow-hidden group select-none w-full video-player ${
        showControls ? 'vp-controls-visible' : 'vp-controls-hidden'
      } ${
        isFullscreen ? '!rounded-none border-0' : ''
      } ${isFullscreen && !showControls ? 'cursor-none' : ''} fullscreen:w-screen fullscreen:h-screen fullscreen:max-w-none fullscreen:rounded-none fullscreen:border-0 fullscreen:flex fullscreen:items-center fullscreen:justify-center fullscreen:bg-black`}
      style={{ '--cue-lift': `${showControls ? -CUE_LIFT_CONTROLS_VISIBLE : -CUE_LIFT_CONTROLS_HIDDEN}px` }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onTouchStart={handleTouchStart}
      onDoubleClick={(e) => {
        // Double-click toggles fullscreen (single click still toggles play on video)
        if (e.target.closest('button, input, a, [role="menu"]')) return;
        toggleFullscreen();
      }}
    >
      <video
        ref={videoRef}
        className={`w-full aspect-video cursor-pointer bg-black object-contain ${
          isFullscreen ? '!aspect-auto !h-screen !max-h-screen' : ''
        } fullscreen:w-full fullscreen:h-full fullscreen:max-h-screen fullscreen:aspect-auto fullscreen:object-contain`}
        poster={poster}
        onClick={togglePlay}
        onDoubleClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
        onTouchEnd={handleVideoTouchEnd}
        playsInline
        crossOrigin="anonymous"
        webkit-playsinline="true"
        x-webkit-airplay="allow"
        style={{ touchAction: 'manipulation' }}
      >
        {extSubtitles.map((sub, i) => (
          <track
            key={`${sub.url}-${i}`}
            kind={sub.kind === 'captions' ? 'captions' : 'subtitles'}
            src={sub.proxiedUrl || sub.url}
            srcLang={langCodeFor(sub)}
            label={sub.label || `Subtitle ${i + 1}`}
          />
        ))}
      </video>

      {/* Custom-rendered subtitles (parsed VTT). Native <track> cues stay
          hidden — this overlay is the only thing that paints ext tracks. */}
      {showOverlay && (
        <SubtitleOverlay cues={overlayEntry.cues} currentTime={currentTime} />
      )}

      {/* Skip intro / outro */}
      {intro && currentTime >= intro.start && currentTime < intro.end && (
        <button
          className="absolute bottom-28 right-4 z-20 cursor-pointer px-4 py-2 text-xs font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-deep)] rounded-full shadow-lg shadow-[var(--accent)]/30 transition-all duration-200 hover:scale-105"
          onClick={() => { const v = videoRef.current; if (v) v.currentTime = intro.end; }}
        >
          Skip Intro
        </button>
      )}
      {outro && currentTime >= outro.start && currentTime < outro.end && (
        <button
          className="absolute bottom-28 right-4 z-20 cursor-pointer px-4 py-2 text-xs font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-deep)] rounded-full shadow-lg shadow-[var(--accent)]/30 transition-all duration-200 hover:scale-105"
          onClick={() => { const v = videoRef.current; if (v) v.currentTime = outro.end; }}
        >
          Skip Outro
        </button>
      )}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--accent)]/20 border-t-[var(--accent)] animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center max-w-md px-4">
            <AlertTriangle className="w-16 h-16 mx-auto text-red-400/60 mb-4" />
            <p className="text-white text-lg font-semibold mb-2">Video Unavailable</p>
            <p className="text-gray-400 text-sm mb-4">{error}</p>
            <div className="flex flex-col gap-2 items-center">
              <div className="flex gap-2 justify-center">
                <button className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white text-sm font-bold rounded-full transition-all" onClick={() => { setError(null); setIsLoading(true); initHls(); }}>
                  Try Again
                </button>
                <button className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium rounded-full border border-white/[0.1] hover:border-white/[0.2] transition-all" onClick={() => window.location.reload()}>
                  Reload Page
                </button>
              </div>
              {(error.includes('403') || error.includes('blocked') || error.includes('CDN')) && (
                <p className="text-gray-500 text-xs mt-1">Tip: Select a different server below, or try another episode</p>
              )}
            </div>
          </div>
        </div>
      )}

      {!isPlaying && !isLoading && !error && (
        <button className="absolute inset-0 flex items-center justify-center" onClick={togglePlay}>
          <div className="w-20 h-20 bg-[var(--accent)]/80 cursor-pointer rounded-full flex items-center justify-center hover:bg-[var(--accent)] transition-all duration-300 hover:scale-110 shadow-lg shadow-[var(--accent)]/25">
            <Play className="w-10 h-10 text-white ml-1" fill="currentColor" />
          </div>
        </button>
      )}

      {doubleTapSide && (
        <div className={`absolute inset-y-0 ${doubleTapSide === 'left' ? 'left-0 right-auto' : 'right-0 left-auto'} flex items-center justify-center pointer-events-none`}>
          <div className="bg-black/60 rounded-full px-4 py-2 flex items-center gap-2 animate-pulse">
            {doubleTapSide === 'left' ? <SkipBack className="w-5 h-5 text-white" /> : <SkipForward className="w-5 h-5 text-white" />}
            <span className="text-white text-sm font-bold">10s</span>
          </div>
        </div>
      )}

      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pb-3">
          <div className="relative h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group/progress hover:h-2.5 transition-all" onClick={seek}>
            <div className="absolute h-full bg-white/30 rounded-full" style={{ width: `${bufferedPercent}%` }} />
            <div className="absolute h-full bg-[var(--accent)] rounded-full" style={{ width: `${progressPercent}%` }} />
            <div className="absolute w-3 h-3 bg-[var(--accent)] rounded-full top-1/2 -translate-y-1/2 opacity-0 group-hover/progress:opacity-100 transition-opacity" style={{ left: `calc(${progressPercent}% - 6px)` }} />
          </div>

          <div className="flex items-center gap-3">
            <button className="p-1.5 text-white hover:text-[var(--accent)] cursor-pointer transition-colors rounded-full" onClick={togglePlay}>
              {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5" fill="currentColor" />}
            </button>

            <button className="p-1.5 text-white hover:text-[var(--accent)] cursor-pointer transition-colors rounded-full" onClick={() => skip(-10)}>
              <span className="text-xs ml-0.5">10</span>
              <SkipBack className="w-4 h-4" />
            </button>

            <button className="p-1.5 text-white hover:text-[var(--accent)] cursor-pointer transition-colors rounded-full" onClick={() => skip(10)}>
              <span className="text-xs mr-0.5">10</span>
              <SkipForward className="w-4 h-4" />
            </button>

            <span className="text-white text-xs font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            <div className="flex items-center gap-1">
              <button className="p-1.5 text-white hover:text-[var(--accent)] cursor-pointer transition-colors rounded-full" onClick={toggleMute}>
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : volume < 0.5 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 accent-[var(--accent)] cursor-pointer"
              />
            </div>

            {/* Subtitle control */}
            {subOptions.length > 0 && (
              <div className="relative">
                <button
                  className={`p-1.5 rounded-full cursor-pointer transition-colors ${selectedSubtitle >= 0 ? 'text-[var(--accent)]' : 'text-white hover:text-[var(--accent)]'}`}
                  onClick={(e) => { e.stopPropagation(); setShowSubtitleMenu(v => !v); }}
                  title="Subtitles (C)"
                >
                  <Subtitles className="w-4 h-4" />
                </button>
                {showSubtitleMenu && (
                  <div className="absolute bottom-full right-0 mb-2 glass-panel cursor-pointer rounded-2xl z-50 p-2 shadow-lg min-w-[140px] max-w-[220px]" onClick={(e) => e.stopPropagation()}>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide px-2 pb-1">Subtitles</div>
                    <button
                      className={`block w-full text-left px-3 py-1.5 text-sm rounded-full transition-colors ${selectedSubtitle === -1 ? 'bg-[var(--accent)] text-white font-bold' : 'text-[var(--text-secondary)] hover:bg-white/[0.06]'}`}
                      onClick={() => selectSubtitle(-1)}
                    >
                      Off
                    </button>
                    {subOptions.map((opt, i) => {
                      const failed = opt.kind === 'ext' && failedSubs[opt.index];
                      return (
                        <button
                          key={opt.key}
                          className={`block w-full text-left px-3 py-1.5 text-sm rounded-full transition-colors truncate ${selectedSubtitle === i ? 'bg-[var(--accent)] text-white font-bold' : 'text-[var(--text-secondary)] hover:bg-white/[0.06]'}`}
                          onClick={() => selectSubtitle(i)}
                          title={failed ? `${opt.label} (failed to load)` : opt.label}
                        >
                          {opt.label}
                          {failed && <span className="ml-1 text-red-400">⚠</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Speed control */}
            <div className="relative">
              <button
                className="p-1.5 text-white hover:text-[var(--accent)] cursor-pointer transition-colors rounded-full gap-0.5"
                onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(v => !v); }}
                title="Playback speed (< >)"
              >
                <Gauge className="w-4 h-4" />
                {playbackRate !== 1 && <span className="text-[10px] font-bold ml-0.5">{playbackRate}x</span>}
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 glass-panel rounded-2xl z-50 p-2 shadow-lg min-w-[80px]" onClick={(e) => e.stopPropagation()}>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide px-2 pb-1">Speed</div>
                  {speeds.map(s => (
                    <button
                      key={s}
                      className={`block w-full text-left px-3 py-1.5 text-sm rounded-full transition-colors ${playbackRate === s ? 'bg-[var(--accent)] text-white font-bold' : 'text-[var(--text-secondary)] hover:bg-white/[0.06]'}`}
                      onClick={() => changePlaybackRate(s)}
                    >
                      {s === 1 ? 'Normal' : `${s}x`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {availableLevels.length > 1 && (
              <div className="dropdown dropdown-top">
                <button tabIndex={0} className="p-1.5 text-white hover:text-[var(--accent)] transition-colors rounded-full text-xs font-semibold">
                  {quality === -1 ? 'Auto' : `${availableLevels[quality]?.height || '?'}p`}
                </button>
                <ul tabIndex={0} className="dropdown-content menu glass-panel rounded-2xl z-50 w-32 p-2 shadow-lg">
                  <li><a onClick={() => changeQuality(-1)} className={quality === -1 ? 'text-[var(--accent)] font-bold' : ''}>Auto</a></li>
                  {availableLevels.map((level) => (
                    <li key={level.index}>
                      <a onClick={() => changeQuality(level.index)} className={quality === level.index ? 'text-[var(--accent)] font-bold' : ''}>
                        {level.height}p
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* PiP toggle */}
            <button
              className="p-1.5 text-white hover:text-[var(--accent)] cursor-pointer transition-colors rounded-full"
              onClick={togglePip}
              title="Picture in Picture (P)"
            >
              {isPip ? <PictureInPicture2 className="w-4 h-4" /> : <PictureInPicture className="w-4 h-4" />}
            </button>

            <button className="p-1.5 text-white hover:text-[var(--accent)] cursor-pointer transition-colors rounded-full" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {title && (
        <div className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}>
          <h2 className="text-white text-lg font-semibold">{title}</h2>
        </div>
      )}
    </div>
  );
}