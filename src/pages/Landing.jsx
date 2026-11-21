import { TextureButton } from '@/components/ui/texture-button';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { searchAnime, getTrendingAnime, getDisplayTitle } from '../api/apiService';
import { Search, Heart, Play, BookOpen, UserPlus, ArrowRight, Star } from '@/components/icons';
import Wordmark from '../components/Wordmark';
import BeadHeart from '../components/BeadHeart';

export default function Landing() {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [trending, setTrending] = useState([]);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const result = await getTrendingAnime(1, 10);
        setTrending(result.media.slice(0, 6));
      } catch {
        // fallback
      }
    };
    fetchFeatured();
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
      const result = await searchAnime(query, 1, 6);
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

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-[var(--bg-deep)]">
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
          {/* Logo */}
          <Link to="/" className="mb-8 select-none group flex items-center gap-3">
            <Wordmark className="text-[40px] md:text-[56px]" />
          </Link>

          {/* Nav pills */}
          <nav className="flex items-center gap-1.5 mb-10">
            {[
              { to: '/browse', label: 'Home', primary: true },
              { to: '/search?type=TRENDING', label: 'New Releases' },
              { to: '/search?type=NEW', label: 'Latest' },
              { to: '/search?type=TOP', label: 'Completed' },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 text-sm   transition-all duration-300 ${
                  link.primary
                    ? 'bg-[var(--r3)] text-[var(--accent)] border border-[var(--r4)]'
                    : 'text-[var(--r5)] hover:text-[var(--r7)] hover:bg-[var(--r3)]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Heading */}
          <BeadHeart className="mb-6" />
          <h1 className="text-3xl md:text-4xl lg:text-[3.5rem] text-[var(--r7)] text-center mb-4 leading-[1.1]">
            Made for my,{' '}
            <span className="text-[var(--accent)]">Jimei</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-sm md:text-base text-center max-w-lg mb-10 leading-relaxed">
            Anime to watch and manhwa to read, picked and played in one place. No account needed.
          </p>

          {/* Search */}
          <div ref={searchRef} className="relative w-full max-w-xl mb-12">
            <form onSubmit={handleSubmit}>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] group-focus-within:text-[var(--accent)] transition-colors duration-300" />
                <input
                  type="text"
                  placeholder="Search anime..."
                  className="w-full pl-12 pr-4 py-4 bg-[var(--r2)] border-2 border-[var(--r4)] outline-none text-[var(--r7)] text-sm placeholder-[var(--text-muted)] focus:border-[var(--accent)] transition-all duration-300"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                />
              </div>
            </form>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 glass-panel overflow-hidden z-50 animate-slide-in-down" style={{ animationDuration: '0.2s' }}>
                {suggestions.map((anime) => (
                  <button
                    key={anime.id}
                    className="flex items-center gap-3 w-full p-3 hover:bg-[var(--r3)] transition-colors text-left border-b border-[var(--border-subtle)] last:border-0"
                    onClick={() => { setShowSuggestions(false); setSearchQuery(''); navigate(`/anime/${anime.id}`); }}
                  >
                    <img
                      src={anime.coverImage?.medium || anime.coverImage?.large || anime.poster}
                      alt=""
                      className="w-10 h-14 object-cover"
                      loading="lazy"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--r7)] truncate">{getDisplayTitle(anime)}</p>
                      <p className="text-xs text-[var(--text-muted)]">{String(anime.format || anime.type || '').replace('_', ' ')} {anime.episodes && `\u00B7 ${anime.episodes} eps`}</p>
                    </div>
                  </button>
                ))}
                <Link
                  to={`/search?keyw=${encodeURIComponent(searchQuery)}`}
                  className="block p-3 text-center text-sm text-[var(--accent)] hover:bg-[var(--r3)] border-t border-[var(--border-subtle)] transition-colors"
                  onClick={() => setShowSuggestions(false)}
                >
                  View all results
                </Link>
              </div>
            )}
          </div>

          {/* Feature highlights */}
          <div className="flex items-center gap-8 mb-12">
            {[
              { icon: Play, label: 'Anime to watch' },
              { icon: BookOpen, label: 'Manhwa to read' },
              { icon: UserPlus, label: 'No account needed' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <item.icon className="w-4 h-4 text-[var(--accent)]" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <TextureButton asChild variant="accent" size="lg" className="w-auto">
            <Link to="/browse">
              Browse anime
              <ArrowRight className="w-5 h-5" />
            </Link>
          </TextureButton>
        </div>
      </div>

      {/* Trending strip */}
      {trending.length > 0 && (
        <div className="relative z-10 px-6 pb-10">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-5 text-center flex items-center justify-center gap-2">
              <Star className="w-3 h-3 text-[var(--accent)]" />
              Trending Now
              <Star className="w-3 h-3 text-[var(--accent)]" />
            </p>
            <div className="flex justify-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {trending.map((anime) => (
                <Link
                  key={anime.id}
                  to={`/anime/${anime.id}`}
                  className="flex-none group/card"
                >
                  <div className="w-24 md:w-28 aspect-[3/4] overflow-hidden border-4 border-[var(--r0)] group-hover/card:border-dotted group-hover/card:border-[var(--accent)]">
                    <img
                      src={anime.coverImage?.medium || anime.coverImage?.large || anime.poster}
                      alt={getDisplayTitle(anime)}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--text-muted)] text-center max-w-24 md:max-w-28 truncate group-hover/card:text-[var(--accent)] transition-colors duration-300">
                    {getDisplayTitle(anime)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="relative z-10 px-6 pb-6">
        <p className="text-[var(--text-muted)] text-[11px] text-center flex items-center justify-center gap-1.5">
          <Heart size="12" className="text-[var(--accent)] animate-heart-beat" fill="currentColor" />
          Built with love for jimei!
        </p>
      </div>
    </div>
  );
}
