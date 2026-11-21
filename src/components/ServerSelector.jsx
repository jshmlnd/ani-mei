import { Server, Captions, Mic, Film, AlertCircle } from '@/components/icons';

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
  selected,
  onSelect,
  loading = false,
  error = null,
}) {
  const serverKeys = orderKeys(Object.keys(servers || {}));
  const hasServers = serverKeys.length > 0;

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-4 px-1">
        <div className="flex items-end gap-1.5 h-5" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} className="bead bead-drop" style={{ animationDelay: `${i * 0.16}s` }} />)}</div>
        <span className="text-xs text-[var(--text-muted)]">Loading servers...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-3 px-3 bg-[var(--r2)] border border-[var(--error)]">
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-xs text-[var(--error)]">{error}</span>
      </div>
    );
  }

  if (!hasServers) {
    return (
      <div className="py-4 px-3 border border-[var(--border-subtle)] text-center">
        <p className="text-xs text-[var(--text-muted)]">No servers available for this episode</p>
        <p className="text-[10px] text-[var(--text-muted)] mt-1">Try switching episode or check back later</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Server className="w-3.5 h-3.5 text-[var(--accent)]" />
        <span className="text-xs tracking-widest text-[var(--r7)] uppercase">Servers</span>
      </div>

      <div className="space-y-3">
        {serverKeys.map((type) => {
          const list = servers[type] || [];
          if (!Array.isArray(list) || list.length === 0) return null;
          const TypeIcon = TYPE_ICONS[type.toLowerCase()] || Server;
          return (
            <div key={type} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <TypeIcon className="w-3 h-3 text-[var(--text-muted)]" />
                <span className="text-[10px] tracking-widest text-[var(--text-muted)] uppercase">
                  {formatType(type)}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">• {list.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((srv, i) => {
                  const isActive = (selected?.linkId && selected?.linkId === srv.linkId) || (selected?.id && selected?.id === srv.id);
                  return (
                    <button
                      key={srv.linkId || srv.id || `${srv.name}-${type}-${i}`}
                      onClick={() => onSelect(srv)}
                      className={`px-3.5 py-1.5 text-xs  cursor-pointer  border transition-all duration-200 ${
                        isActive
                          ? 'bg-[var(--accent)] text-[var(--r0)] border-[var(--accent)]  '
                          : ' text-[var(--text-muted)] border-[var(--border-subtle)] hover:bg-[var(--r3)] hover:text-[var(--r7)] hover:border-[var(--r4)]'
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

      {selected && (
        <div className="flex items-center gap-2.5 pt-3 border-t border-[var(--border-subtle)] mt-3">
          <span className="bead bead-lit" style={{ "--b": "8px" }} />
          <span className="text-[11px] text-[var(--text-muted)]">
            Playing via <span className="text-[var(--text-secondary)]">{selected.name}</span>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-[var(--r3)] text-[var(--accent)] border border-[var(--r4)]">
              {formatType(selected.type)}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
