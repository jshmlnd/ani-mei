import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchAnime, getDisplayTitle } from '../api/apiService';
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
        const data = await searchAnime(query.trim(), 1, 8);
        setResults(data?.media || []);
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
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 group-focus-within:text-[var(--accent)] transition-colors duration-300" />
          <input
            type="text"
            placeholder="Search anime..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            className={`w-full pl-9 pr-10 bg-white/[0.04] border border-white/[0.08] rounded-full outline-none text-white placeholder-white/25 focus:border-[var(--accent)]/40 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(var(--accent-rgb),0.08)] transition-all duration-300 ${
              compact ? 'py-1.5 text-xs' : 'py-2.5 text-sm'
            }`}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 rounded-full border-2 border-[var(--accent)]/20 border-t-[var(--accent)] animate-spin" />
            </div>
          )}
        </div>
      </form>

      {showDropdown && results.length > 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 glass-panel rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50 animate-slide-in-down" style={{ animationDuration: '0.2s' }}>
          {results.map((anime) => (
            <button
              key={anime.id}
              onMouseDown={() => handleSelect(anime.id)}
              className="flex items-center gap-3 w-full p-3 hover:bg-white/[0.06] transition-colors text-left border-b border-white/[0.04] last:border-0"
            >
              <img
                src={anime.coverImage?.medium || anime.coverImage?.large || anime.poster}
                alt={getDisplayTitle(anime)}
                className="w-10 h-14 object-cover rounded-lg"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{getDisplayTitle(anime)}</p>
                {anime.status && (
                  <p className="text-xs text-[var(--text-muted)]">{anime.status}</p>
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
