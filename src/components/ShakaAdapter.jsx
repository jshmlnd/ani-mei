import { useEffect, useRef } from 'react';
import shaka from 'shaka-player/dist/shaka-player.ui.js';
import 'shaka-player/dist/controls.css';

export default function ShakaAdapter({ src, poster, title, onError, onReady }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !src) return;

    if (!shaka.Player.isBrowserSupported()) {
      if (onError) onError('Browser does not support Shaka Player');
      return;
    }

    shaka.polyfill.installAll();

    if (playerRef.current) {
      playerRef.current.destroy();
    }

    const video = videoRef.current;
    const player = new shaka.Player();
    playerRef.current = player;

    player.attach(video).then(() => {
      if (poster) video.poster = poster;

      player.addEventListener('error', (event) => {
        const code = event.detail?.code || 'unknown';
        const message = event.detail?.message || 'unknown error';
        if (onError) onError(`Shaka error ${code}: ${message}`);
      });

      player.addEventListener('loaded', () => {
        if (onReady) onReady();
      });

      return player.load(src);
    }).catch((err) => {
      if (onError) onError(`Failed to load: ${err.message}`);
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [src, poster]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="relative bg-black rounded-lg overflow-hidden shaka-controls">
      {title && (
        <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <h2 className="text-white text-lg font-semibold">{title}</h2>
        </div>
      )}
      <video
        ref={videoRef}
        className="w-full aspect-video"
        playsInline
        crossOrigin="anonymous"
      />
    </div>
  );
}
