import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { AlertTriangle, Play, Pause, SkipBack, SkipForward, VolumeX, Volume1, Volume2, Minimize2, Maximize2, Subtitles, Gauge, PictureInPicture, PictureInPicture2 } from 'lucide-react';

const MAX_HLS_RETRIES = 2;

export default function VideoPlayer({ 
  src, 
  headers = {}, 
  poster, 
  title, 
  fallbackSrc, 
  iframeHtml, 
  skipData,
  sourceInfo,
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
  const [selectedSubtitle, setSelectedSubtitle] = useState(-1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
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
    if (!hasIframeHtml || iframeFailed || iframeLoaded) return;
    const timer = setTimeout(() => {
      if (!iframeLoaded && !iframeFailed && fallbackSrc) {
        setIframeFailed(true);
        onIframeError?.();
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [hasIframeHtml, iframeFailed, iframeLoaded, fallbackSrc, onIframeError]);

  const getProxyUrl = useCallback((targetUrl) => {
    // Only proxy actual m3u8 segment URLs, NOT embed pages
    const isM3u8Segment = targetUrl && (targetUrl.includes('.m3u8') || targetUrl.includes('/m3u8') || targetUrl.includes('hls'))
      && !targetUrl.includes('embed') && !targetUrl.includes('echovideo') && !targetUrl.includes('myvidplay');
    
    if (!isM3u8Segment) return targetUrl; // Return raw URL for embed pages
    
    // No proxy available - use direct URL (segments may fail if CDN blocks browser IPs)
    return targetUrl;
  }, []);

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

const initHls = useCallback(() => {
    // If we have iframe HTML and it hasn't failed, don't initialize HLS
    if (hasIframeHtml && !iframeFailed) return;
    
    const video = videoRef.current;
    
    // When iframe fails, prefer m3u8 URL (src) over fallbackSrc (embed URL)
    const hlsSrc = iframeFailed ? (src || fallbackSrc) : src;
    if (!video || !hlsSrc) {
      if (!hlsSrc) {
        setError('No playable stream URL available');
        setIsLoading(false);
      }
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
    }
    hlsStartedRef.current = false;

    const isHlsSrc = hlsSrc && (hlsSrc.includes('.m3u8') || hlsSrc.includes('/m3u8') || hlsSrc.includes('hls'))
      && !hlsSrc.includes('embed') && !hlsSrc.includes('echovideo') && !hlsSrc.includes('myvidplay');
    
    console.log('[VideoPlayer] initHls:', { hlsSrc, isHlsSrc, iframeFailed, hasIframeHtml });

    if (isHlsSrc && Hls.isSupported()) {
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
            hls.subtitleTrack = defaultIdx;
          }
        }
        setIsLoading(false);
        hls.currentLevel = -1;
        video.play().catch((err) => {
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
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = isHlsSrc ? getProxyUrl(hlsSrc) : hlsSrc;
      video.play().catch((err) => {
        console.error('[VideoPlayer] native play() failed:', err);
        if (err.name === 'NotSupportedError') {
          setError('Stream format not supported — try a different server');
        }
        setIsLoading(false);
      });
    } else {
      setError('Your browser does not support HLS video playback');
      setIsLoading(false);
    }
    
    // If we have an hlsSrc but it's not a valid HLS source
    if (!isHlsSrc && hlsSrc) {
      console.warn('[VideoPlayer] Invalid HLS source:', hlsSrc);
      setError('Invalid stream format — try a different server');
      setIsLoading(false);
    }
  }, [src, fallbackSrc, hasIframeHtml, iframeFailed, getProxyUrl]);

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

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video && !container) return;

    const isFs = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

    if (isFs) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
      if (exit) exit.call(document);
      return;
    }

    if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    } else {
      const el = video.requestFullscreen ? video : container;
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if (req) req.call(el);
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

  const toggleSubtitle = useCallback((index) => {
    if (hlsRef.current) {
      if (index === -1 || selectedSubtitle === index) {
        hlsRef.current.subtitleTrack = -1;
        setSelectedSubtitle(-1);
      } else {
        hlsRef.current.subtitleTrack = index;
        hlsRef.current.subtitleDisplay = true;
        setSelectedSubtitle(index);
      }
    } else {
      const video = videoRef.current;
      if (!video) return;
      const textTracks = video.textTracks;
      for (let i = 0; i < textTracks.length; i++) {
        textTracks[i].mode = (i === index && selectedSubtitle !== index) ? 'showing' : 'hidden';
      }
      setSelectedSubtitle(selectedSubtitle === index ? -1 : index);
    }
  }, [selectedSubtitle]);

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
        case 'c': e.preventDefault(); if (subtitles.length) toggleSubtitle(subtitles.length ? 0 : -1); break;
        case 'Escape': setShowSpeedMenu(false); break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleFullscreen, toggleMute, skip, cyclePlaybackRate, togglePip, subtitles, toggleSubtitle, hasIframeHtml, iframeFailed]);

  // Close speed menu on outside click
  useEffect(() => {
    if (!showSpeedMenu) return;
    const close = () => setShowSpeedMenu(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showSpeedMenu]);

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
    const { src: iframeSrc, attrs } = parseIframeHtml(iframeHtml);
    return (
      <div className="relative bg-black rounded-lg overflow-hidden" ref={containerRef}>
        {title && (
          <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
            <h2 className="text-white text-lg font-semibold">{title}</h2>
          </div>
        )}
        <iframe
          src={iframeSrc}
          className="w-full aspect-video border-0"
          allowFullScreen={attrs.allowfullscreen || true}
          allow={attrs.allow || "autoplay; fullscreen; picture-in-picture; encrypted-media"}
          referrerPolicy={attrs.referrerpolicy || "no-referrer"}
          sandbox={attrs.sandbox || "allow-scripts allow-same-origin allow-forms allow-presentation"}
          onLoad={() => {
            setIsLoading(false);
            setIframeLoaded(true);
          }}
          onError={handleIframeError}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative bg-black rounded-lg overflow-hidden group select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onTouchStart={handleTouchStart}
    >
      <video
        ref={videoRef}
        className="w-full aspect-video cursor-pointer"
        poster={poster}
        onClick={togglePlay}
        onTouchEnd={handleVideoTouchEnd}
        playsInline
        webkit-playsinline="true"
        x-webkit-airplay="allow"
        style={{ touchAction: 'manipulation' }}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <span className="loading loading-spinner loading-lg text-primary"></span>
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
                <button className="btn btn-sm btn-primary" onClick={() => { setError(null); setIsLoading(true); initHls(); }}>
                  Try Again
                </button>
                <button className="btn btn-sm btn-ghost text-gray-400" onClick={() => window.location.reload()}>
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
          <div className="w-20 h-20 bg-primary/80 rounded-full flex items-center justify-center hover:bg-primary transition-colors">
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
            <div className="absolute h-full bg-primary rounded-full" style={{ width: `${progressPercent}%` }} />
            <div className="absolute w-3 h-3 bg-primary rounded-full top-1/2 -translate-y-1/2 opacity-0 group-hover/progress:opacity-100 transition-opacity" style={{ left: `calc(${progressPercent}% - 6px)` }} />
          </div>

          <div className="flex items-center gap-3">
            <button className="btn btn-ghost btn-xs text-white hover:text-primary" onClick={togglePlay}>
              {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5" fill="currentColor" />}
            </button>

            <button className="btn btn-ghost btn-xs text-white hover:text-primary" onClick={() => skip(-10)}>
              <SkipBack className="w-4 h-4" />
              <span className="text-xs ml-0.5">10</span>
            </button>

            <button className="btn btn-ghost btn-xs text-white hover:text-primary" onClick={() => skip(10)}>
              <span className="text-xs mr-0.5">10</span>
              <SkipForward className="w-4 h-4" />
            </button>

            <span className="text-white text-xs font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            <div className="flex items-center gap-1">
              <button className="btn btn-ghost btn-xs text-white hover:text-primary" onClick={toggleMute}>
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : volume < 0.5 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 accent-primary cursor-pointer"
              />
            </div>

            {/* Subtitle control */}
            {subtitles.length > 0 && (
              <div className="relative">
                <button
                  className={`btn btn-ghost btn-xs ${selectedSubtitle >= 0 ? 'text-primary' : 'text-white hover:text-primary'}`}
                  onClick={(e) => { e.stopPropagation(); toggleSubtitle(selectedSubtitle >= 0 ? -1 : 0); }}
                  title="Toggle subtitles (C)"
                >
                  <Subtitles className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Speed control */}
            <div className="relative">
              <button
                className="btn btn-ghost btn-xs text-white hover:text-primary gap-0.5"
                onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(v => !v); }}
                title="Playback speed (< >)"
              >
                <Gauge className="w-4 h-4" />
                {playbackRate !== 1 && <span className="text-[10px] font-bold ml-0.5">{playbackRate}x</span>}
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-base-200 rounded-box z-50 p-2 shadow-lg min-w-[80px]" onClick={(e) => e.stopPropagation()}>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide px-2 pb-1">Speed</div>
                  {speeds.map(s => (
                    <button
                      key={s}
                      className={`block w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${playbackRate === s ? 'bg-primary text-white font-bold' : 'text-[var(--text-secondary)] hover:bg-white/10'}`}
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
                <button tabIndex={0} className="btn btn-ghost btn-xs text-white hover:text-primary">
                  {quality === -1 ? 'Auto' : `${availableLevels[quality]?.height || '?'}p`}
                </button>
                <ul tabIndex={0} className="dropdown-content menu bg-base-200 rounded-box z-50 w-32 p-2 shadow-lg">
                  <li><a onClick={() => changeQuality(-1)} className={quality === -1 ? 'active' : ''}>Auto</a></li>
                  {availableLevels.map((level) => (
                    <li key={level.index}>
                      <a onClick={() => changeQuality(level.index)} className={quality === level.index ? 'active' : ''}>
                        {level.height}p
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* PiP toggle */}
            <button
              className="btn btn-ghost btn-xs text-white hover:text-primary p-2 min-h-0 h-auto"
              onClick={togglePip}
              title="Picture in Picture (P)"
            >
              {isPip ? <PictureInPicture2 className="w-4 h-4" /> : <PictureInPicture className="w-4 h-4" />}
            </button>

            <button className="btn btn-ghost btn-xs text-white hover:text-primary p-2 min-h-0 h-auto" onClick={toggleFullscreen}>
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