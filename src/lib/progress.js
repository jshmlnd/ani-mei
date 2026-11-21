// Per-device watch progress: which episodes Jimei opened, per show.
// localStorage can be missing or throw (private mode, blocked storage); every
// access is guarded so the UI just shows no progress instead of breaking.
const KEY = 'animei-progress';
const MAX_SHOWS = 40;

export function readProgress() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}');
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
  } catch {
    return {};
  }
}

export function progressFor(id) {
  const p = readProgress()[id];
  return p && Number.isFinite(p.episode) ? { ...p, seen: Array.isArray(p.seen) ? p.seen : [] } : null;
}

export function recordEpisode(id, { episode, total, title, poster }) {
  if (!id || !Number.isFinite(episode)) return;
  try {
    const all = readProgress();
    const prev = all[id];
    const seen = new Set(Array.isArray(prev?.seen) ? prev.seen : []);
    seen.add(episode);
    all[id] = { episode, total: total || prev?.total || 0, title, poster, seen: [...seen].sort((a, b) => a - b), at: Date.now() };
    // Keep the store small: drop the oldest shows past MAX_SHOWS.
    const ids = Object.keys(all).sort((a, b) => (all[b].at || 0) - (all[a].at || 0));
    for (const old of ids.slice(MAX_SHOWS)) delete all[old];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage unavailable: progress is a nicety, never a blocker
  }
}

export function recentShows(limit = 8) {
  return Object.entries(readProgress())
    .map(([id, v]) => ({ id, ...v }))
    .filter((v) => Number.isFinite(v.episode))
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .slice(0, limit);
}
