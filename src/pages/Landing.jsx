import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { searchAnime, getTrendingAnime, getDisplayTitle } from '../api/apiService';
import { Search, Heart, Play, Clock, UserPlus, ArrowRight, Sparkles, Star } from 'lucide-react';
import animeiLogo from '../assets/animeiV2.png';

export default function Landing() {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [featured, setFeatured] = useState(null);
  const [trending, setTrending] = useState([]);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const result = await getTrendingAnime(1, 10);
        if (result.media.length > 0) {
          const withBanner = result.media.find((a) => a.bannerImage) || result.media[0];
          setFeatured(withBanner);
          setTrending(result.media.filter((a) => a.id !== withBanner.id).slice(0, 6));
        }
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
      {/* Featured background */}
      {featured?.bannerImage && (
        <div className="absolute inset-0">
          <img
            src={featured.bannerImage}
            alt=""
            className="w-full h-full object-cover opacity-[0.05] scale-110 blur-[3px] animate-ken-burns"
          />
          <div className="absolute inset-0 bg-[var(--bg-deep)]/90" />
        </div>
      )}

      {/* Ambient gradients — pink */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(var(--accent-rgb),0.1)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(var(--accent-deep-rgb),0.06)_0%,transparent_50%)] pointer-events-none" />

      {/* Floating orbs — pink */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[var(--accent)]/[0.05] rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[var(--accent-deep)]/[0.04] rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--accent)]/[0.02] rounded-full blur-[150px] pointer-events-none" />

      {/* Sparkle decorations */}
      <div className="absolute top-[15%] left-[10%] w-2 h-2 rounded-full bg-[var(--accent)] animate-sparkle" style={{ animationDelay: '0s' }} />
      <div className="absolute top-[25%] right-[15%] w-1.5 h-1.5 rounded-full bg-[var(--accent)]/60 animate-sparkle" style={{ animationDelay: '0.8s' }} />
      <div className="absolute bottom-[30%] left-[20%] w-2 h-2 rounded-full bg-[var(--accent-deep)]/50 animate-sparkle" style={{ animationDelay: '1.6s' }} />
      <div className="absolute bottom-[20%] right-[10%] w-1.5 h-1.5 rounded-full bg-[var(--accent)]/40 animate-sparkle" style={{ animationDelay: '2.4s' }} />
      <div className="absolute top-[40%] left-[5%] w-1 h-1 rounded-full bg-[var(--accent-deep)]/60 animate-sparkle" style={{ animationDelay: '3s' }} />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
          {/* Logo */}
          <Link to="/" className="mb-8 select-none group flex items-center gap-3">
            <img
              src={animeiLogo}
              alt="AniMei"
              className="h-10 md:h-14 transition-transform duration-500 group-hover:scale-110"
            />
            <Heart className="w-5 h-5 text-[var(--accent)] animate-heart-beat" fill="currentColor" />
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
                className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 ${
                  link.primary
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/25'
                    : 'text-white/40 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Heading */}
          <h1 className="text-3xl md:text-4xl lg:text-[3.5rem] font-bold text-white text-center mb-4 leading-[1.1] tracking-tight">
            Made for my,{' '}
            <span className="text-gradient">Jimei</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-sm md:text-base text-center max-w-lg mb-10 leading-relaxed">
            Watch thousands of anime episodes in HD with no registration. New episodes added daily.
          </p>

          {/* Search */}
          <div ref={searchRef} className="relative w-full max-w-xl mb-12">
            <form onSubmit={handleSubmit}>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] group-focus-within:text-[var(--accent)] transition-colors duration-300" />
                <input
                  type="text"
                  placeholder="Search anime..."
                  className="w-full pl-12 pr-4 py-4 bg-white/[0.03] border border-[var(--border-subtle)] rounded-full outline-none text-white text-sm placeholder-[var(--text-muted)] focus:border-[var(--accent)]/30 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgba(var(--accent-rgb),0.08)] transition-all duration-300"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                />
              </div>
            </form>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 glass-panel rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-50 animate-slide-in-down" style={{ animationDuration: '0.2s' }}>
                {suggestions.map((anime) => (
                  <button
                    key={anime.id}
                    className="flex items-center gap-3 w-full p-3 hover:bg-[var(--accent)]/[0.06] transition-colors text-left border-b border-[var(--border-subtle)] last:border-0"
                    onClick={() => { setShowSuggestions(false); setSearchQuery(''); navigate(`/anime/${anime.id}`); }}
                  >
                    <img
                      src={anime.coverImage?.medium || anime.coverImage?.large || anime.poster}
                      alt=""
                      className="w-10 h-14 object-cover rounded-xl"
                      loading="lazy"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{getDisplayTitle(anime)}</p>
                      <p className="text-xs text-[var(--text-muted)]">{String(anime.format || anime.type || '').replace('_', ' ')} {anime.episodes && `\u00B7 ${anime.episodes} eps`}</p>
                    </div>
                  </button>
                ))}
                <Link
                  to={`/search?keyw=${encodeURIComponent(searchQuery)}`}
                  className="block p-3 text-center text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/[0.06] border-t border-[var(--border-subtle)] transition-colors"
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
              { icon: Play, label: 'Free HD Streaming' },
              { icon: Clock, label: 'Updated Daily' },
              { icon: UserPlus, label: 'No Registration' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <item.icon className="w-4 h-4 text-[var(--accent)]/50" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Link
            to="/browse"
            className="group relative inline-flex items-center gap-2.5 px-8 py-4 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-bold text-sm rounded-full transition-all duration-300 hover:shadow-[0_0_40px_rgba(var(--accent-rgb),0.35)] hover:scale-[1.05]"
          >
            <Sparkles className="w-4 h-4" />
            Browse Anime
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      {/* Trending strip */}
      {trending.length > 0 && (
        <div className="relative z-10 px-6 pb-10">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-5 text-center flex items-center justify-center gap-2">
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
                  <div className="w-24 md:w-28 aspect-[3/4] rounded-2xl overflow-hidden bg-white/[0.03] border border-[var(--border-subtle)] group-hover/card:border-[var(--accent)]/30 group-hover/card:shadow-[0_0_25px_rgba(var(--accent-rgb),0.12)] transition-all duration-300">
                    <img
                      src={anime.coverImage?.medium || anime.coverImage?.large || anime.poster}
                      alt={getDisplayTitle(anime)}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
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
          Built with love for jimei! 🩷
        </p>
      </div>
    </div>
  );
}
