import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { searchAnime, getTrendingAnime, getDisplayTitle } from '../api/apiService';
import { Search, Heart, Play, Clock, UserPlus, ArrowRight } from 'lucide-react';
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
      {featured?.bannerImage && (
        <div className="absolute inset-0">
          <img
            src={featured.bannerImage}
            alt=""
            className="w-full h-full object-cover opacity-[0.07] scale-110 blur-[2px] animate-ken-burns"
          />
          <div className="absolute inset-0 bg-[var(--bg-deep)]/85" />
        </div>
      )}

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.1)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.07)_0%,transparent_50%)] pointer-events-none" />

      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[var(--accent)]/5 rounded-full blur-[130px] pointer-events-none animate-glow-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/5 rounded-full blur-[130px] pointer-events-none animate-glow-pulse" style={{ animationDelay: '1.5s' }} />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
          <Link to="/" className="mb-6 select-none group">
            <img src={animeiLogo} alt="AniMei" className="h-9 md:h-12 transition-transform duration-500 group-hover:scale-105" />
          </Link>

          <nav className="flex items-center gap-1 mb-8">
            {[
              { to: '/browse', label: 'Home', primary: true },
              { to: '/search?type=TRENDING', label: 'New Releases' },
              { to: '/search?type=NEW', label: 'Latest' },
              { to: '/search?type=TOP', label: 'Completed' },

            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-300 ${
                  link.primary
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20'
                    : link.danger
                      ? 'text-red-400/70 hover:text-red-300 hover:bg-red-500/10'
                      : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white text-center mb-3 leading-tight">
            Made for my,{' '}
            <span className="text-gradient" style={{ color: 'linear-gradient(135deg, #eeaeca, #e994c0)' }}>Jimei</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-sm md:text-base text-center max-w-lg mb-8">
            Watch thousands of anime episodes in HD with no registration. New episodes added daily.
          </p>

          <div ref={searchRef} className="relative w-full max-w-xl mb-10">
            <form onSubmit={handleSubmit}>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] group-focus-within:text-[var(--accent)] transition-colors duration-300" />
                <input
                  type="text"
                  placeholder="Search anime..."
                  className="w-full pl-12 pr-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl outline-none text-white text-sm placeholder-[var(--text-muted)] focus:border-[var(--accent)]/30 focus:bg-white/[0.05] focus:shadow-[0_0_40px_rgba(168,85,247,0.08)] transition-all duration-500"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                />
              </div>
            </form>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 glass-panel rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 animate-fade-in" style={{ animationDuration: '0.2s' }}>
                {suggestions.map((anime) => (
                  <button
                    key={anime.id}
                    className="flex items-center gap-3 w-full p-3 hover:bg-white/[0.06] transition-colors text-left border-b border-white/[0.04] last:border-0"
                    onClick={() => { setShowSuggestions(false); setSearchQuery(''); navigate(`/anime/${anime.id}`); }}
                  >
                    <img src={anime.coverImage?.medium || anime.coverImage?.large || anime.poster} alt="" className="w-10 h-14 object-cover rounded-lg" loading="lazy" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{getDisplayTitle(anime)}</p>
                      <p className="text-xs text-[var(--text-muted)]">{String(anime.format || anime.type || '').replace('_', ' ')} {anime.episodes && `\u00B7 ${anime.episodes} eps`}</p>
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

          <div className="flex items-center gap-6 mb-10">
            {[
              { icon: Play, label: 'Free HD Streaming' },
              { icon: Clock, label: 'Updated Daily' },
              { icon: UserPlus, label: 'No Registration' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <item.icon className="w-4 h-4 text-[var(--accent)]/60" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <Link
            to="/browse"
            className="group relative inline-flex items-center gap-2.5 px-8 py-3.5 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-bold text-sm rounded-full transition-all duration-500 hover:shadow-[0_0_50px_rgba(168,85,247,0.35)]"
          >
            Browse Anime
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      {trending.length > 0 && (
        <div className="relative z-10 px-6 pb-10">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4 text-center">Trending Now</p>
            <div className="flex justify-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {trending.map((anime) => (
                <Link
                  key={anime.id}
                  to={`/anime/${anime.id}`}
                  className="flex-none group/card"
                >
                  <div className="w-24 md:w-28 aspect-[3/4] rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.06] group-hover/card:border-[var(--accent)]/30 transition-all duration-300 group-hover/card:shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                    <img
                      src={anime.coverImage?.medium || anime.coverImage?.large || anime.poster}
                      alt={getDisplayTitle(anime)}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--text-muted)] text-center max-w-24 md:max-w-28 truncate group-hover/card:text-white transition-colors">
                    {getDisplayTitle(anime)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 px-6 pb-6">
        <p className="text-[var(--text-muted)] text-[11px] text-center flex items-center justify-center gap-1.5">
          <Heart size="12" />
          Built with love for jimei! 🩷
        </p>
      </div>
    </div>
  );
}
