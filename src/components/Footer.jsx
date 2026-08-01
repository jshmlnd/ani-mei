import { Link } from 'react-router-dom';
import animeiLogo from '../assets/animeiV2.png';

export default function Footer() {
  return (
    <footer className="relative mt-auto">
      <div className="h-px bg-gradient-to-r from-transparent via-[var(--accent)]/20 to-transparent" />
      <div className="bg-[var(--bg-surface)]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1">
              <Link to="/" className="inline-block mb-4">
                <span className="text-lg font-black tracking-tight">
                  <img src={animeiLogo} alt="Animei" className="h-8 md:h-10 transition-transform duration-300 group-hover:scale-105" />
                </span>
              </Link>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-xs">
                Free anime streaming platform. Watch thousands of episodes in HD quality.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Navigation</h4>
              <ul className="space-y-2.5">
                <li><Link to="/browse" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Home</Link></li>
                <li><Link to="/browse?type=TRENDING" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Trending</Link></li>
                <li><Link to="/browse?type=NEW" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">New Releases</Link></li>
                <li><Link to="/browse?type=TOP" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Top Rated</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Genres</h4>
              <ul className="space-y-2.5">
                {['Action', 'Comedy', 'Romance', 'Sci-Fi'].map((g) => (
                  <li key={g}>
                    <Link to={`/search?genre=${g}`} className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                      {g}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Disclaimer</h4>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                We do not host any content. All anime content is provided by third-party services.
                EST. 2026
              </p>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-white/[0.04] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[var(--text-muted)]">
              &copy; 2026 Animei. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-[var(--text-muted)]/50">Built with love for jimei 🩷</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
