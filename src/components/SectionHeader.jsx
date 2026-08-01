import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function SectionHeader({ title, subtitle, action, actionLink, gradient = false }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h2 className={`text-xl md:text-2xl font-black ${gradient ? 'text-gradient' : 'text-white'}`}>
          {title}
        </h2>
        {subtitle && <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p>}
      </div>
      {action && actionLink && (
        <Link
          to={actionLink}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--accent)] hover:text-white hover:bg-[var(--accent)]/10 rounded-full border border-[var(--accent)]/20 hover:border-[var(--accent)]/40 transition-all duration-300"
        >
          {action}
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
