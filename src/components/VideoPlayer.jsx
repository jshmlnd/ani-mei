import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { AlertTriangle, Play, Pause, SkipBack, SkipForward, VolumeX, Volume1, Volume2, Minimize2, Maximize2 } from 'lucide-react';

const HLS_TIMEOUT_MS = 8000;
const MAX_HLS_RETRIES = 2;

export default function VideoPlayer({ src, headers = {}, poster, title, fallbackSrc }) {
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
  const [useIframe, setUseIframe] = useState(false);
  const hideControlsTimer = useRef(null);
  const containerRef = useRef(null);
  const headersRef = useRef(headers);
  const hlsStartedRef = useRef(false);
  const hlsTimeoutRef = useRef(null);
  const hlsRetryRef = useRef(0);

  useEffect(() => {
    headersRef.current = headers;
  });

  const isM3u8 = src && (src.includes('.m3u8') || src.includes('hls'));
  const isEmbed = src && !isM3u8 && !useIframe && (src.includes('embed') || src.includes('echovideo'));

  const shouldUseIframe = useIframe || isEmbed;

  const getProxyUrl = useCallback((targetUrl) => {
    const proxyBase = '/api/proxy';
    const encodedHeaders = encodeURIComponent(JSON.stringify(headersRef.current));
    return `${proxyBase}?url=${encodeURIComponent(targetUrl)}&h=${encodedHeaders}`;
  }, []);

  const switchToIframe = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (hlsTimeoutRef.current) {
      clearTimeout(hlsTimeoutRef.current);
      hlsTimeoutRef.current = null;
    }
    setUseIframe(true);
  }, []);

  const initHls = useCallback(() => {
    if (shouldUseIframe) return;
    const video = videoRef.current;
    if (!video || !src) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
    }
    hlsStartedRef.current = false;

    if (isM3u8 && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1,
      });
      hlsRef.current = hls;

      const proxiedUrl = getProxyUrl(src);
      hls.loadSource(proxiedUrl);
      hls.attachMedia(video);

      if (fallbackSrc) {
        hlsTimeoutRef.current = setTimeout(() => {
          if (!hlsStartedRef.current) {
            switchToIframe();
          }
        }, HLS_TIMEOUT_MS);
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
        setIsLoading(false);
        hls.currentLevel = -1;
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setQuality(data.level);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (fallbackSrc && hlsRetryRef.current >= MAX_HLS_RETRIES) {
            switchToIframe();
            return;
          }

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (hlsRetryRef.current < MAX_HLS_RETRIES) {
                hlsRetryRef.current++;
                hls.startLoad();
              } else if (fallbackSrc) {
                switchToIframe();
              } else {
                setError(`Network error (code ${data.details || 'unknown'})`);
                hls.destroy();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (hlsRetryRef.current < MAX_HLS_RETRIES) {
                hlsRetryRef.current++;
                hls.recoverMediaError();
              } else if (fallbackSrc) {
                switchToIframe();
              } else {
                setError(`Media decode error (code ${data.details || 'unknown'})`);
                hls.destroy();
              }
              break;
            default:
              setError(`Playback error (type ${data.type}, code ${data.details || 'unknown'})`);
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = isM3u8 ? getProxyUrl(src) : src;
    } else {
      video.src = src;
    }
  }, [src, shouldUseIframe, isM3u8, fallbackSrc, getProxyUrl, switchToIframe]);

  useEffect(() => {
    initHls();
    return () => {
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
    if (!video || shouldUseIframe) return;

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
    const onError = () => {
      const videoErr = video.error;
      const code = videoErr?.code;
      const message = videoErr?.message || 'unknown error';
      const detail = code ? ` (error code ${code}: ${message})` : '';
      if (fallbackSrc) {
        switchToIframe();
      } else {
        setError(`Video cannot be played${detail}`);
      }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
    };
  }, [fallbackSrc, shouldUseIframe, switchToIframe]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
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
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleFullscreen, toggleMute, skip]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

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

  if (shouldUseIframe) {
    const iframeSrc = useIframe ? (fallbackSrc || src) : src;
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
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture"
          onLoad={() => setIsLoading(false)}
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
    >
      <video
        ref={videoRef}
        className="w-full aspect-video cursor-pointer"
        poster={poster}
        onClick={togglePlay}
        playsInline
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
            <div className="flex gap-2 justify-center">
              <button className="btn btn-sm btn-primary" onClick={() => { setError(null); setIsLoading(true); initHls(); }}>
                Try Again
              </button>
              <button className="btn btn-sm btn-ghost text-gray-400" onClick={() => window.location.reload()}>
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )}

      {!isPlaying && !isLoading && !error && (
        <button
          className="absolute inset-0 flex items-center justify-center"
          onClick={togglePlay}
        >
          <div className="w-20 h-20 bg-primary/80 rounded-full flex items-center justify-center hover:bg-primary transition-colors">
            <Play className="w-10 h-10 text-white ml-1" fill="currentColor" />
          </div>
        </button>
      )}

      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="px-4 pb-3">
          <div className="relative h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group/progress hover:h-2.5 transition-all" onClick={seek}>
            <div className="absolute h-full bg-white/30 rounded-full" style={{ width: `${bufferedPercent}%` }} />
            <div className="absolute h-full bg-primary rounded-full" style={{ width: `${progressPercent}%` }} />
            <div className="absolute w-3 h-3 bg-primary rounded-full top-1/2 -translate-y-1/2 opacity-0 group-hover/progress:opacity-100 transition-opacity" style={{ left: `calc(${progressPercent}% - 6px)` }} />
          </div>

          <div className="flex items-center gap-3">
            <button className="btn btn-ghost btn-xs text-white hover:text-primary" onClick={togglePlay}>
              {isPlaying ? (
                <Pause className="w-5 h-5" fill="currentColor" />
              ) : (
                <Play className="w-5 h-5" fill="currentColor" />
              )}
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
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
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

            <button className="btn btn-ghost btn-xs text-white hover:text-primary" onClick={toggleFullscreen}>
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
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
