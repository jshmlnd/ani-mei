import { Link } from 'react-router-dom';
import Wordmark from './Wordmark';
import { Heart } from '@/components/icons';

export default function Footer() {
  return (
    <footer className="relative mt-auto">
      <div className="h-1 bg-[var(--r0)]" />
      <div className="bg-[var(--r2)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1">
              <Link to="/" className="inline-flex items-center gap-2 mb-4 group">
                <Wordmark className="text-[30px]" />
              </Link>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-xs">
                Anime to watch and manhwa to read, all in one place.
              </p>
            </div>

            <div>
              <h4 className="text-xs text-[var(--r7)] uppercase tracking-widest mb-4">Navigation</h4>
              <ul className="space-y-2.5">
                <li><Link to="/browse" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors duration-200">Home</Link></li>
                <li><Link to="/browse?type=TRENDING" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors duration-200">Trending</Link></li>
                <li><Link to="/browse?type=NEW" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors duration-200">New Releases</Link></li>
                <li><Link to="/browse?type=TOP" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors duration-200">Top Rated</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs text-[var(--r7)] uppercase tracking-widest mb-4">Genres</h4>
              <ul className="space-y-2.5">
                {['Action', 'Comedy', 'Romance', 'Sci-Fi'].map((g) => (
                  <li key={g}>
                    <Link to={`/genres/${encodeURIComponent(g)}`} className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors duration-200">
                      {g}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link to="/genres" className="text-sm text-[var(--accent)] hover:underline transition-colors duration-200">
                    All genres
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs text-[var(--r7)] uppercase tracking-widest mb-4">Disclaimer</h4>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                We do not host any content. All anime content is provided by third-party services.
                EST. 2026
              </p>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-[var(--border-subtle)] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[var(--text-muted)]">
              &copy; 2026 Animei. All rights reserved. <a href='/hentai' className="text-[var(--accent)] hover:underline underline-offset-4"> 18+ </a>
            </p>
            <div className="flex items-center gap-2">
              <Heart size="12" className="text-[var(--accent)] animate-heart-beat" fill="currentColor" />
              <span className="text-xs text-[var(--text-muted)]">Built with love for jimei!</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
