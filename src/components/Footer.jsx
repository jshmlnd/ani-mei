import { Link } from 'react-router-dom';
import animeiLogo from '../assets/animeiV2.png';
import { Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="relative mt-auto">
      <div className="h-px bg-gradient-to-r from-transparent via-[var(--accent)]/20 to-transparent" />
      <div className="bg-[var(--bg-surface)]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1">
              <Link to="/" className="inline-flex items-center gap-2 mb-4 group">
                <img
                  src={animeiLogo}
                  alt="Animei"
                  className="h-8 md:h-10 transition-transform duration-300 group-hover:scale-105"
                />
                <Heart className="w-4 h-4 text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity animate-heart-beat" fill="currentColor" />
              </Link>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-xs">
                Free anime streaming platform. Watch thousands of episodes in HD quality.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Navigation</h4>
              <ul className="space-y-2.5">
                <li><Link to="/browse" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors duration-200">Home</Link></li>
                <li><Link to="/browse?type=TRENDING" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors duration-200">Trending</Link></li>
                <li><Link to="/browse?type=NEW" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors duration-200">New Releases</Link></li>
                <li><Link to="/browse?type=TOP" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors duration-200">Top Rated</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Genres</h4>
              <ul className="space-y-2.5">
                {['Action', 'Comedy', 'Romance', 'Sci-Fi'].map((g) => (
                  <li key={g}>
                    <Link to={`/search?genre=${g}`} className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors duration-200">
                      {g}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Disclaimer</h4>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                We do not host any content. All anime content is provided by third-party services.
                EST. 2026
              </p>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-[var(--border-subtle)] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[var(--text-muted)]">
              &copy; 2026 Animei. All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              <Heart size="12" className="text-[var(--accent)] animate-heart-beat" fill="currentColor" />
              <span className="text-xs text-[var(--text-muted)]/50">Built with love for jimei! 🩷</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
