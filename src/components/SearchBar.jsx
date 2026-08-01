import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchAnime } from '../api/apiService';
import { Search } from 'lucide-react';

const SearchBar = ({ compact = false }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim()) return;

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchAnime(query.trim());
        setResults(Array.isArray(data) ? data.slice(0, 8) : []);
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timerRef.current);
  }, [query]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setShowDropdown(false);
    navigate(`/search?keyw=${encodeURIComponent(query.trim())}`);
  };

  const handleSelect = (animeId) => {
    setShowDropdown(false);
    setQuery('');
    navigate(`/anime/${animeId}`);
  };

  return (
    <div className={`relative ${compact ? '' : 'w-full max-w-lg'}`}>
      <form onSubmit={handleSubmit}>
        <div className="join w-full">
          <input
            type="text"
            placeholder="Search anime..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            className={`input input-bordered join-item ${compact ? 'input-sm' : ''} w-full focus:outline-none focus:border-primary`}
          />
          <button
            type="submit"
            className={`btn btn-primary join-item ${compact ? 'btn-sm' : ''}`}
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <Search className="h-5 w-5" />
            )}
          </button>
        </div>
      </form>

      {showDropdown && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-base-100 border border-base-300 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {results.map((anime) => (
            <button
              key={anime.animeId}
              onMouseDown={() => handleSelect(anime.animeId)}
              className="flex items-center gap-3 w-full px-4 py-2 hover:bg-base-200 transition-colors text-left"
            >
              <img
                src={anime.animeImg}
                alt={anime.animeTitle}
                className="w-10 h-14 object-cover rounded"
              />
              <div>
                <p className="text-sm font-medium line-clamp-1">{anime.animeTitle}</p>
                {anime.status && (
                  <p className="text-xs text-base-content/50">{anime.status}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
