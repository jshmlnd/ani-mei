import { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

export default function VideoJsAdapter({ src, poster, title, onError, onReady }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !src) return;

    if (playerRef.current) {
      playerRef.current.dispose();
    }

    const videoElement = videoRef.current;

    const isM3u8 = src.includes('.m3u8') || src.includes('hls');

    const player = videojs(videoElement, {
      controls: true,
      preload: 'auto',
      fluid: true,
      responsive: true,
      fill: false,
      aspectRatio: '16:9',
      sources: [{ src, type: isM3u8 ? 'application/x-mpegURL' : 'video/mp4' }],
      poster: poster || '',
      playbackRates: [],
      controlBar: {
        pictureInPictureToggle: true,
        fullscreenToggle: true,
        volumePanel: { inline: true },
        children: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'progressControl',
          'liveDisplay',
          'seekToLive',
          'remainingTimeDisplay',
          'customControlSpacer',
          'playbackRateMenuButton',
          'chaptersButton',
          'descriptionsButton',
          'subsCapsButton',
          'audioTrackButton',
          'pictureInPictureToggle',
          'fullscreenToggle',
        ],
      },
    });

    playerRef.current = player;

    player.ready(() => {
      if (onReady) onReady();
    });

    player.on('error', () => {
      const error = player.error();
      if (onError) {
        onError(error ? `Error ${error.code}: ${error.message}` : 'Video playback error');
      }
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src, poster]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      {title && (
        <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <h2 className="text-white text-lg font-semibold">{title}</h2>
        </div>
      )}
      <div data-vjs-player>
        <video
          ref={videoRef}
          className="video-js vjs-big-play-centered vjs-theme-city"
          playsInline
        />
      </div>
    </div>
  );
}
