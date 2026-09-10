import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { searchAnime, getDisplayTitle } from '../api/apiService';
import { searchManhwa } from '../api/manhwaService';
import animeiLogo from '../assets/animeiV2.png';
import { Search, Menu, X, Heart, BookOpen, Clapperboard } from 'lucide-react';

export default function Navbar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [mangaSuggestions, setMangaSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const requestRef = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchRef.current?.querySelector('input')?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setMangaSuggestions([]);
      return;
    }
    const reqId = ++requestRef.current;
    try {
      const [animeRes, mangaRes] = await Promise.all([
        searchAnime(q, 1, 5).catch(() => ({ media: [] })),
        searchManhwa(q).catch(() => ({ items: [] })),
      ]);
      if (requestRef.current !== reqId) return;
      setSuggestions(animeRes?.media || []);
      setMangaSuggestions((mangaRes?.items || []).slice(0, 5));
    } catch {
      if (requestRef.current !== reqId) return;
      setSuggestions([]);
      setMangaSuggestions([]);
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

  const isActive = (to) => {
    const path = to.split('?')[0];
    if (path === '/browse' && location.pathname === '/browse') {
      const params = new URLSearchParams(location.search);
      const linkParams = new URLSearchParams(to.split('?')[1] || '');
      return params.get('type') === linkParams.get('type');
    }
    return location.pathname === path;
  };

  const navLinks = [
    { to: '/browse', label: 'Home' },
    { to: '/browse?type=TRENDING', label: 'New Releases' },
    { to: '/browse?type=NEW', label: 'Latest' },
    { to: '/browse?type=TOP', label: 'Completed' },
    { to: '/manhwa', label: 'Manhwa' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-350 ${
        isScrolled
          ? 'glass-panel shadow-lg shadow-black/20'
          : 'bg-transparent'
      }`}
      style={isScrolled ? { borderBottom: '1px solid rgba(var(--accent-rgb), 0.1)' } : {}}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0 group">
            <img
              src={animeiLogo}
              alt="AniMei"
              className="h-7 transition-transform duration-300 group-hover:scale-110"
            />
            <Heart className="w-3.5 h-3.5 text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-heart-beat" fill="currentColor" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 ${
                  isActive(link.to)
                    ? 'text-[var(--accent)] bg-[var(--accent)]/10'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                {link.label}
                {isActive(link.to) && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-1 rounded-full bg-[var(--accent)]" />
                )}
              </Link>
            ))}
          </div>

          {/* Search */}
          <div ref={searchRef} className="relative">
            <form onSubmit={handleSubmit} className="flex items-center">
              <div className="relative group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--accent)] transition-colors duration-300" />
                <input
                  type="text"
                  placeholder="Search anime, manga..."
                  className="w-44 lg:w-56 pl-10 pr-10 py-2.5 text-sm bg-white/[0.04] border border-[var(--border-subtle)] rounded-full outline-none text-white placeholder-[var(--text-muted)] focus:border-[var(--accent)]/40 focus:bg-white/[0.06] focus:rounded-full focus:shadow-[0_0_0_4px_rgba(var(--accent-rgb),0.08)] transition-all duration-300"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => searchQuery.trim().length >= 2 && setShowSuggestions(true)}
                />
                {!searchQuery && (
                  <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)] bg-white/[0.06] border border-[var(--border-subtle)] rounded-full pointer-events-none">
                    /
                  </kbd>
                )}
              </div>
            </form>

            {/* Suggestions — anime + manga/manhwa */}
            {showSuggestions && (suggestions.length > 0 || mangaSuggestions.length > 0) && (
              <div className="absolute top-full right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto glass-panel rounded-2xl shadow-2xl shadow-black/40 z-50 animate-slide-in-down" style={{ animationDuration: '0.25s' }}>
                {suggestions.length > 0 && (
                  <>
                    <p className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      <Clapperboard className="w-3 h-3" />
                      Anime
                    </p>
                    {suggestions.map((anime) => (
                      <button
                        key={anime.id}
                        className="flex items-center gap-3 w-full p-3 hover:bg-[var(--accent)]/[0.06] cursor-pointer transition-colors text-left border-b border-[var(--border-subtle)] last:border-0"
                        onClick={() => {
                          setShowSuggestions(false);
                          setSearchQuery('');
                          setMangaSuggestions([]);
                          navigate(`/anime/${anime.id}`);
                        }}
                      >
                        <img
                          src={anime.coverImage?.medium || anime.coverImage?.large || anime.poster}
                          alt=""
                          className="w-10 h-14 object-cover rounded-xl"
                          loading="lazy"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{getDisplayTitle(anime)}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {String(anime.format || anime.type || '').replace('_', ' ')} {anime.episodes && `\u00B7 ${anime.episodes} eps`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {mangaSuggestions.length > 0 && (
                  <>
                    <p className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      <BookOpen className="w-3 h-3" />
                      Manga & Manhwa
                    </p>
                    {mangaSuggestions.map((manga) => (
                      <button
                        key={manga.id}
                        className="flex items-center gap-3 w-full p-3 hover:bg-[var(--accent)]/[0.06] cursor-pointer transition-colors text-left border-b border-[var(--border-subtle)] last:border-0"
                        onClick={() => {
                          setShowSuggestions(false);
                          setSearchQuery('');
                          setSuggestions([]);
                          navigate(`/manhwa?title=${encodeURIComponent(manga.id)}`);
                        }}
                      >
                        <img
                          src={manga.thumbnail || manga.image}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-10 h-14 object-cover rounded-xl"
                          loading="lazy"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{manga.title}</p>
                          <p className="text-xs text-[var(--text-muted)] truncate">
                            {[manga.type, manga.status, manga.latestChapter].filter(Boolean).join(' · ') || 'Manhwa'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                <div className="flex border-t border-[var(--border-subtle)]">
                  <Link
                    to={`/search?keyw=${encodeURIComponent(searchQuery.trim())}`}
                    className="flex-1 block p-3 text-center text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/[0.06] transition-colors"
                    onClick={() => setShowSuggestions(false)}
                  >
                    Anime results
                  </Link>
                  <Link
                    to={`/search?keyw=${encodeURIComponent(searchQuery.trim())}&tab=manhwa`}
                    className="flex-1 block p-3 text-center text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/[0.06] border-l border-[var(--border-subtle)] transition-colors"
                    onClick={() => setShowSuggestions(false)}
                  >
                    Manga results
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-full hover:bg-white/[0.06] transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="w-5 h-5 text-white" />
            ) : (
              <Menu className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden glass-panel border-t border-[var(--border-subtle)] animate-slide-in-down" style={{ animationDuration: '0.2s' }}>
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`block px-4 py-2.5 text-sm font-semibold rounded-full transition-all ${
                  isActive(link.to)
                    ? 'text-[var(--accent)] bg-[var(--accent)]/10'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.05]'
                }`}
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
