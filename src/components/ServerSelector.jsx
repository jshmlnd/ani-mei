import { Server, Captions, Mic, Film, AlertCircle } from 'lucide-react';

const TYPE_ORDER = ['sub', 'dub', 'raw', 'hsub', 'softsub'];
const TYPE_LABELS = {
  sub: 'SUB',
  dub: 'DUB',
  raw: 'RAW',
  hsub: 'HSUB',
  softsub: 'SOFTSUB',
};
const TYPE_ICONS = {
  sub: Captions,
  dub: Mic,
  raw: Film,
  hsub: Captions,
  softsub: Captions,
};

function formatType(type) {
  return TYPE_LABELS[type?.toLowerCase()] || type?.toUpperCase() || 'UNKNOWN';
}

function orderKeys(keys) {
  return [...keys].sort((a, b) => {
    const ia = TYPE_ORDER.indexOf(a.toLowerCase());
    const ib = TYPE_ORDER.indexOf(b.toLowerCase());
    const va = ia === -1 ? 99 : ia;
    const vb = ib === -1 ? 99 : ib;
    if (va !== vb) return va - vb;
    return a.localeCompare(b);
  });
}

export default function ServerSelector({
  servers = {},
  flat = [],
  selected,
  onSelect,
  loading = false,
  error = null,
}) {
  const hasServers = flat.length > 0 || Object.keys(servers).length > 0;
  const serverKeys = orderKeys(Object.keys(servers || {}));

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-4 px-1">
        <span className="loading loading-spinner loading-sm text-[var(--accent)]"></span>
        <span className="text-xs font-medium text-[var(--text-muted)]">Loading servers...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-3 px-3 rounded-lg bg-red-500/5 border border-red-500/10">
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-xs text-red-300/80">{error}</span>
      </div>
    );
  }

  if (!hasServers) {
    return (
      <div className="py-3 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] text-center">
        <p className="text-xs text-[var(--text-muted)]">No servers available for this episode</p>
        <p className="text-[10px] text-[var(--text-muted)]/70 mt-1">Try switching episode or check back later</p>
      </div>
    );
  }

  // If servers grouped but we also have flat as fallback (no grouping), show flat as single group
  const isGrouped = serverKeys.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Server className="w-3.5 h-3.5 text-[var(--accent)]" />
        <span className="text-xs font-bold tracking-widest text-white uppercase">Servers</span>
        {flat.length > 0 && (
          <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-[var(--text-muted)] border border-white/[0.06]">
            {flat.length} available
          </span>
        )}
      </div>

      {isGrouped ? (
        <div className="space-y-3">
          {serverKeys.map((type) => {
            const list = servers[type] || [];
            if (!Array.isArray(list) || list.length === 0) return null;
            const TypeIcon = TYPE_ICONS[type.toLowerCase()] || Server;
            return (
              <div key={type} className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <TypeIcon className="w-3 h-3 text-[var(--text-muted)]" />
                  <span className="text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
                    {formatType(type)}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]/60">• {list.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((srv) => {
                    const isActive = selected?.linkId === srv.linkId;
                    return (
                      <button
                        key={srv.linkId}
                        onClick={() => onSelect(srv)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-200 ${
                          isActive
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-[0_0_12px_rgba(238,174,202,0.35)]'
                            : 'bg-white/[0.03] text-[var(--text-muted)] border-white/[0.06] hover:bg-white/[0.08] hover:text-white hover:border-white/[0.1]'
                        }`}
                        title={`${srv.name} (${type})`}
                      >
                        {srv.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {flat.map((srv) => {
            const isActive = selected?.linkId === srv.linkId;
            return (
              <button
                key={srv.linkId}
                onClick={() => onSelect(srv)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                  isActive
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-[0_0_12px_rgba(238,174,202,0.35)]'
                    : 'bg-white/[0.03] text-[var(--text-muted)] border-white/[0.06] hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                {srv.name} <span className="opacity-60 ml-1 text-[10px]">{srv.type?.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-white/[0.04] mt-3">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-[var(--text-muted)]">
            Playing via <span className="font-semibold text-[var(--text-secondary)]">{selected.name}</span>
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20">
              {formatType(selected.type)}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
