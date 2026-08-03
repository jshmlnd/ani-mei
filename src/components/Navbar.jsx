import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { searchAnime, getDisplayTitle } from '../api/apiService';
import animeiLogo from '../assets/animeiV2.png';
import { Search, Menu, X } from 'lucide-react';

export default function Navbar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback(async (query) => {
    if (query.length < 2) { setSuggestions([]); return; }
    try {
      const result = await searchAnime(query, 1, 8);
      setSuggestions(result.media);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(value), 300);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?keyw=${encodeURIComponent(searchQuery.trim())}`);
      setShowSuggestions(false);
    }
  };

  const navLinks = [
    { to: '/browse', label: 'Home' },
    { to: '/browse?type=TRENDING', label: 'Trending' },
    { to: '/browse?type=NEW', label: 'New Releases' },
    { to: '/browse?type=TOP', label: 'Top Rated' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled
          ? 'glass-panel shadow-lg shadow-black/20'
          : 'bg-transparent'
        }`}
      style={isScrolled ? { borderBottom: '1px solid rgba(168, 85, 247, 0.08)' } : {}}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-1 shrink-0 group">
            <img src={animeiLogo} alt="AniMei" className="h-6 transition-transform duration-300 group-hover:scale-105" />
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-white rounded-lg hover:bg-white/[0.06] transition-all duration-200"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div ref={searchRef} className="relative">
            <form onSubmit={handleSubmit} className="flex items-center">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--accent)] transition-colors" />
                <input
                  type="text"
                  placeholder="Search anime..."
                  className="w-48 lg:w-56 pl-9 pr-4 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-full outline-none text-white placeholder-[var(--text-muted)] focus:border-[var(--accent)]/40 focus:bg-white/[0.06] focus:shadow-[0_0_20px_rgba(168,85,247,0.1)] transition-all duration-300"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                />
              </div>
            </form>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full right-0 mt-2 w-80 glass-panel rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 animate-fade-in" style={{ animationDuration: '0.2s' }}>
                {suggestions.map((anime) => (
                  <button
                    key={anime.id}
                    className="flex items-center gap-3 w-full p-3 hover:bg-white/[0.06] transition-colors text-left border-b border-white/[0.04] last:border-0"
                    onClick={() => { setShowSuggestions(false); setSearchQuery(''); navigate(`/anime/${anime.id}`); }}
                  >
                    <img src={anime.coverImage?.medium} alt="" className="w-10 h-14 object-cover rounded-lg" loading="lazy" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{getDisplayTitle(anime)}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {anime.format?.replace('_', ' ')} {anime.episodes && `\u00B7 ${anime.episodes} eps`}
                      </p>
                    </div>
                  </button>
                ))}
                <Link
                  to={`/search?keyw=${encodeURIComponent(searchQuery)}`}
                  className="block p-3 text-center text-sm font-medium text-[var(--accent)] hover:bg-white/[0.04] border-t border-white/[0.06]"
                  onClick={() => setShowSuggestions(false)}
                >
                  View all results
                </Link>
              </div>
            )}
          </div>

          <button
            className="md:hidden p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="w-5 h-5 text-white" />
            ) : (
              <Menu className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden glass-panel border-t border-white/[0.06] animate-fade-in" style={{ animationDuration: '0.2s' }}>
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="block px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-white rounded-lg hover:bg-white/[0.06] transition-all"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
