// Self-healing for megaplay HLS streams whose pinned CDN host has rotated.
//
// Why this exists: the backend resolves each episode to an m3u8 URL pinned to a
// specific CDN host (e.g. https://ncdn.imgnex.top/anime/<data>/<hash>/master.m3u8
// with proxy_url = .../api/proxy/m3u8?token=...). When megaplay rotates its CDN
// fleet (e.g. ncdn.imgnex.top -> xdw5v.qeltrix.top), every previously-fine URL
// starts returning "Upstream m3u8 error: 404" through the proxy even though the
// file is alive on the new host at the SAME path. Verified 2026-09-30:
//   - old host with provider Referer -> openresty "404 Not Found" (file gone)
//   - new host (from megaplay's /lib/check_domain.json "fallback" field) -> 200
//   - worker proxy supports ?url= directly (no token needed) for m3u8 and vtt
//
// The health list is served with Access-Control-Allow-Origin: *, so the browser
// can fetch it directly. Flow per URL: HEAD-probe via the Worker proxy -> on
// failure fetch check_domain.json -> rebuild the URL on the healthy host ->
// probe again -> return the first URL that verifies.

const STREAM_REPAIR_TIMEOUT_MS = 8000;
// The healthy host changes only when megaplay rotates its fleet — cache it so
// healing one episode's m3u8 + several subtitle URLs shares a single lookup.
const HEALTH_TTL_MS = 5 * 60 * 1000;
let healthCache = { host: null, expires: 0 };

function withTimeout(ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return { signal: ctl.signal, done: () => clearTimeout(t) };
}

// Head request through the Worker's proxy — it fetches the upstream file with
// the Referer headers the CDN requires, so 200 = the file is alive upstream.
async function probeUpstream(url) {
  if (!url) return false;
  const { signal, done } = withTimeout(STREAM_REPAIR_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'HEAD', signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    done();
  }
}

// Megaplay's live CDN-fleet health list: { fallback: "host", failed: [], ... }.
// Served with permissive CORS so this works straight from the browser.
export async function fetchCdnHealth() {
  if (healthCache.expires > Date.now()) return healthCache.host;
  const { signal, done } = withTimeout(STREAM_REPAIR_TIMEOUT_MS);
  try {
    const res = await fetch(`https://megaplay.buzz/lib/check_domain.json?cache_burst=${Date.now()}`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const fallback = typeof data?.fallback === 'string' ? data.fallback : '';
    const host = fallback && /^[a-z0-9.-]+$/i.test(fallback) ? fallback : null;
    healthCache = { host, expires: Date.now() + HEALTH_TTL_MS };
    return host;
  } catch {
    return null; // don't cache failures — the next call may succeed
  } finally {
    done();
  }
}

// Swap only the origin of an absolute URL; path/search/hash are preserved.
export function swapHost(url, newHost) {
  try {
    const u = new URL(url);
    u.host = newHost;
    return u.toString();
  } catch {
    return url;
  }
}

// Verify `probeUrl` (the backend's token-proxied URL); if the upstream file is
// gone, rebuild the URL on megaplay's currently-healthy CDN host using
// `rebuild(healthyHost)` and verify that too. Returns the first working URL,
// or null if nothing verifies (caller keeps the original so its existing
// error handling kicks in).
export async function repairProxiedUrl({ probeUrl, rebuild }) {
  if (!probeUrl) return null;
  if (await probeUpstream(probeUrl)) return probeUrl;

  const healthyHost = await fetchCdnHealth();
  if (!healthyHost) return null;

  try {
    const candidate = rebuild(healthyHost);
    if (candidate && candidate !== probeUrl && (await probeUpstream(candidate))) {
      return candidate;
    }
  } catch {
    return null;
  }
  return null;
}
