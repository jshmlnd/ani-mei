import { useEffect, useRef } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

export default function PlyrAdapter({ src, poster, title, onError, onReady }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !src) return;

    const video = containerRef.current.querySelector('video');
    if (!video) return;

    if (playerRef.current) {
      playerRef.current.destroy();
    }

    const isM3u8 = src.includes('.m3u8') || src.includes('hls');

    const player = new Plyr(video, {
      captions: { active: true, update: true },
      quality: { default: -1, options: [-1] },
      keyboard: { focused: true, global: true },
      tooltips: { controls: true, seek: true },
      settings: [],
    });

    playerRef.current = player;

    video.src = src;
    if (poster) video.poster = poster;

    if (isM3u8 && window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        if (onReady) onReady();
      });
      hls.on(window.Hls.Events.ERROR, (_, data) => {
        if (data.fatal && onError) {
          onError(`HLS error: ${data.details}`);
        }
      });
      player._hls = hls;
    } else {
      video.addEventListener('canplay', () => {
        if (onReady) onReady();
      }, { once: true });
    }

    video.addEventListener('error', () => {
      if (onError) onError('Video playback error');
    });

    return () => {
      if (playerRef.current) {
        if (playerRef.current._hls) {
          playerRef.current._hls.destroy();
        }
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [src, poster]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="relative bg-black rounded-lg overflow-hidden">
      {title && (
        <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <h2 className="text-white text-lg font-semibold">{title}</h2>
        </div>
      )}
      <video className="w-full aspect-video" playsInline />
    </div>
  );
}
