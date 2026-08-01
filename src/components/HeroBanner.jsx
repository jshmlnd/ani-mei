import { useState, useEffect, useCallback } from 'react';
import { getTopAiring } from '../api/apiService';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const HeroBanner = () => {
  const [animeList, setAnimeList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPopular = async () => {
      try {
        const data = await getTopAiring(1);
        setAnimeList(Array.isArray(data) ? data.slice(0, 10) : []);
      } catch (err) {
        console.error('Failed to load hero banner:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPopular();
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % animeList.length);
  }, [animeList.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + animeList.length) % animeList.length);
  }, [animeList.length]);

  useEffect(() => {
    if (animeList.length <= 1) return;
    const timer = setInterval(nextSlide, 6000);
    return () => clearInterval(timer);
  }, [animeList.length, nextSlide]);

  if (loading) {
    return (
      <div className="relative w-full h-[60vh] min-h-[400px] bg-base-300 animate-pulse" />
    );
  }

  if (animeList.length === 0) return null;

  const current = animeList[currentIndex];

  return (
    <div className="relative w-full h-[60vh] min-h-[400px] overflow-hidden">
      {animeList.map((anime, i) => (
        <div
          key={anime.animeId}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === currentIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <img
            src={anime.animeImg}
            alt={anime.animeTitle}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-base-100 via-base-100/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-base-100/80 to-transparent" />
        </div>
      ))}

      <div className="absolute inset-0 flex items-end">
        <div className="container mx-auto px-6 pb-16 md:pb-24">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="badge badge-primary badge-sm">TOP AIRING</span>
              {current.genres && current.genres.slice(0, 3).map((g) => (
                <span key={g} className="badge badge-outline badge-sm text-white border-white/30">
                  {g}
                </span>
              ))}
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-base-content mb-4 line-clamp-2">
              {current.animeTitle}
            </h2>
            {current.latestEp && (
              <p className="text-base-content/70 mb-6">{current.latestEp}</p>
            )}
            <div className="flex gap-3">
              <Link
                to={`/anime/${current.animeId}`}
                className="btn btn-primary"
              >
                Watch Now
              </Link>
              <Link
                to={`/anime/${current.animeId}`}
                className="btn btn-outline"
              >
                Details
              </Link>
            </div>
          </div>
        </div>
      </div>

      {animeList.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 btn btn-circle btn-ghost text-white/70 hover:text-white hover:bg-white/10"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 btn btn-circle btn-ghost text-white/70 hover:text-white hover:bg-white/10"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            {animeList.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentIndex ? 'bg-primary w-6' : 'bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default HeroBanner;
