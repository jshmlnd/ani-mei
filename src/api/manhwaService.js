import { fetchJSON } from './http';

const MANHWA_API = 'https://manhwaapi.joshuaklein-malonda.workers.dev';

const TIMEOUT = 15000;

// Retry once with backoff for rate limits and upstream blips. 400/404/410
// are client-side outcomes — surface them immediately, never retry.
async function get(path, params = {}, retries = 1) {
  const qs = new URLSearchParams(params);
  const q = qs.toString();
  const url = `${MANHWA_API}${path}${q ? `?${q}` : ''}`;
  try {
    return await fetchJSON(url, { timeout: TIMEOUT });
  } catch (e) {
    const status = e?.status;
    if (retries > 0 && (status === 429 || status === 502 || status === 503 || status === 504)) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return get(path, params, retries - 1);
    }
    throw e;
  }
}

function pickList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

// Defensive normalize — upstream shapes may vary per endpoint
export function normalizeManhwa(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.hid ?? raw.id ?? raw.slug ?? raw.title ?? raw.name;
  if (id == null || id === '') return null;
  const title = raw.title ?? raw.name ?? 'Unknown Title';

  // altTitles may be an array (MangaDex) — prefer the first latin alternative
  let altTitle = raw.altTitle ?? raw.alternative ?? raw.otherNames ?? '';
  if (!altTitle && Array.isArray(raw.altTitles)) {
    altTitle =
      raw.altTitles.find((t) => t && t !== title && /[a-zA-Z]{3,}/.test(t)) ?? '';
  }

  const poster = raw.poster ?? raw.cover ?? raw.image ?? raw.thumbnail ?? '';
  const thumbnail = raw.posterMedium ?? poster;

  // Chapter may be a bare number ("42") — label it; leave "Ch. 12" style as-is
  let latestChapter = raw.latestChapter ?? raw.lastChapter ?? raw.chapter ?? '';
  if (latestChapter !== '' && latestChapter != null) {
    const s = String(latestChapter).trim();
    latestChapter = /^\d+(\.\d+)?$/.test(s) ? `Ch. ${s}` : s;
  } else {
    latestChapter = '';
  }

  const statusRaw = raw.status ?? '';
  const status = statusRaw
    ? String(statusRaw).charAt(0).toUpperCase() + String(statusRaw).slice(1).toLowerCase()
    : '';

  return {
    id: String(id),
    hid: raw.hid != null ? String(raw.hid) : null,
    slug: raw.slug ? String(raw.slug) : null,
    title: String(title),
    altTitle: String(altTitle),
    source: 'mangadex',
    image: String(poster),
    thumbnail: String(thumbnail || poster),
    status,
    type: raw.type ?? 'Manhwa',
    genres: Array.isArray(raw.genres)
      ? raw.genres.map((g) => (typeof g === 'string' ? g : g?.name)).filter(Boolean)
      : [],
    latestChapter,
    updatedAt: toRelativeTime(raw.updatedAt ?? raw.updated_at ?? raw.lastUpdated ?? raw.updatedAgo ?? ''),
    year: raw.year ?? null,
    authors: Array.isArray(raw.authors) ? raw.authors.filter(Boolean) : [],
    artists: Array.isArray(raw.artists) ? raw.artists.filter(Boolean) : [],
    rating: raw.rating ?? raw.score ?? null,
    description: raw.description ?? raw.synopsis ?? '',
    contentRating: raw.contentRating ? String(raw.contentRating).toLowerCase() : '',
    _raw: raw,
  };
}

// True for explicit adult content (MangaDex erotica/pornographic ratings).
// Used to keep hentai out of search results and browse lists — the Hentai
// section remains the dedicated adult area. Unknown ratings pass through.
export function isExplicitManhwa(item) {
  const rating = String(
    item?.contentRating ?? item?._raw?.contentRating ?? ''
  ).toLowerCase();
  return rating === 'erotica' || rating === 'pornographic';
}

function filterExplicit(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((m) => !isExplicitManhwa(m));
}

function toRelativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return String(value);
  const diff = Date.now() - ms;
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export async function getManhwaLatest(limit = 24) {
  const data = await get('/latest', { limit });
  return filterExplicit(pickList(data).map(normalizeManhwa).filter(Boolean));
}

export async function getManhwaTrending(limit = 12) {
  const data = await get('/trending', { limit });
  return filterExplicit(pickList(data).map(normalizeManhwa).filter(Boolean));
}

export async function getManhwaPopular(limit = 12) {
  const data = await get('/popular', { limit });
  return filterExplicit(pickList(data).map(normalizeManhwa).filter(Boolean));
}

export async function getManhwaCollections(limit = 6) {
  const data = await get('/collections', { limit });
  return pickList(data)
    .map((shelf) => {
      if (!shelf || typeof shelf !== 'object') return null;
      return {
        id: String(shelf.id ?? shelf.name ?? Math.random()),
        name: shelf.name ?? 'Collection',
        description: shelf.description ?? '',
        cover: shelf.cover ?? shelf.preview ?? '',
        titles: filterExplicit(pickList(shelf.titles ?? shelf.items).map(normalizeManhwa).filter(Boolean)),
      };
    })
    .filter((s) => s && s.titles.length > 0);
}

// ---------- Chapters & pages (reading) ----------

export function normalizeChapter(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ?? raw.chapterId ?? raw.hid;
  if (!id) return null;
  const number = raw.chapter ?? raw.number ?? raw.ch ?? '';
  return {
    id: String(id),
    number: number != null ? String(number) : '',
    volume: raw.volume ?? '',
    title: raw.title ?? '',
    pages: Number(raw.pages) || 0,
    readable: raw.readable !== false,
    publishAt: raw.publishAt ?? raw.publishedAt ?? '',
    groups: Array.isArray(raw.groups) ? raw.groups : [],
    externalUrl: raw.externalUrl ?? '',
    language: raw.translatedLanguage ?? raw.language ?? '',
    _raw: raw,
  };
}

export function chapterLabel(ch) {
  if (!ch) return 'Chapter';
  if (ch.number !== '' && ch.number != null) return `Ch. ${ch.number}`;
  if (ch.title) return ch.title;
  return 'Oneshot';
}

export async function getManhwaChapters(hid, { page = 1, limit = 100, order = 'asc' } = {}) {
  if (!hid) throw new Error('Missing title id');
  const data = await get('/chapters', { hid, lang: 'en', page, limit, order });
  const payload = data?.data ?? data;
  const meta = payload?.meta ?? data?.meta ?? {};
  const chapters = pickList(payload?.items ?? payload?.chapters ?? payload)
    .map(normalizeChapter)
    .filter(Boolean);
  return {
    chapters,
    pageInfo: {
      hasNext: !!meta.hasNext,
      total: meta.total ?? chapters.length,
      page: meta.page ?? page,
    },
  };
}

export async function getManhwaPages(chapterId, quality = 'dataSaver') {
  if (!chapterId) throw new Error('Missing chapter id');
  const q = quality === 'high' ? 'high' : 'dataSaver';
  // Doc: ALWAYS proxy=1 — the worker rewrites pages to same-domain /image URLs
  const data = await get('/pages', { chapter: chapterId, quality: q, proxy: '1' });
  const payload = data?.data ?? data;
  const pages = Array.isArray(payload?.pages) ? payload.pages.filter(Boolean) : [];
  return {
    chapterId: payload?.chapterId ?? String(chapterId),
    quality: payload?.quality ?? q,
    count: payload?.count ?? pages.length,
    // Unhosted chapters come back 200 with readable:false — branch on this,
    // never on status code
    readable: payload?.readable !== false,
    via: payload?.via ?? null,
    externalUrl: payload?.externalUrl ?? '',
    message: payload?.message ?? '',
    pages,
  };
}

export async function getManhwaTitle(hidOrSlug) {
  if (!hidOrSlug) throw new Error('Missing title id');
  const data = await get('/title', { hid: hidOrSlug });
  const payload = data?.data ?? data;
  const detail = pickTitleDetail(payload);
  const recommendations = pickList(payload?.recommendations ?? payload?.related)
    .map(normalizeManhwa)
    .filter(Boolean);
  const normalized = normalizeManhwa(detail);
  if (!normalized) throw new Error('Title not found');
  return {
    ...normalized,
    recommendations,
    exactMatch: data?.exactMatch ?? payload?.exactMatch ?? null,
    resolvedFrom: data?.resolvedFrom ?? payload?.resolvedFrom ?? null,
    matchCount: data?.matchCount ?? payload?.matchCount ?? null,
  };
}

// The detail payload may be the title object itself ({ id, title: "...", ... })
// or a wrapper ({ detail: {...} } / { title: {...} }). A bare string title
// must never win over the full object.
function pickTitleDetail(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.detail && typeof payload.detail === 'object') return payload.detail;
  if (typeof payload.title === 'string' && (payload.id != null || payload.hid != null)) {
    return payload;
  }
  if (payload.title && typeof payload.title === 'object') return payload.title;
  return payload;
}

// ---------- Violet Scans source (violetscans.org) ----------
// Covers are rewritten to the worker's same-domain /image proxy (allowlisted,
// edge-cached); chapter pages already come back proxied from /pages?proxy=1.

export function proxiedImage(url) {
  if (!url || typeof url !== 'string') return '';
  if (!/violetscans\.org/i.test(url)) return url;
  return `${MANHWA_API}/image?url=${encodeURIComponent(url)}`;
}

// Violet Scans title ids are slugs, namespaced "vs-<slug>" so they can't clash
// with MangaDex UUIDs or bare numeric chapter numbers.
export function isVioletId(id) {
  return /^vs-/i.test(String(id ?? '').trim());
}

// Violet Scans chapter ids are "<slug>:<number>" tokens (as /chapters and
// /vs/chapters return them) — the worker routes them straight to Violet Scans.
export function isVioletChapterId(id) {
  return /^[a-z0-9][a-z0-9-]*:\d+(\.\d+)?$/i.test(String(id ?? '').trim());
}

export function normalizeVioletItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const slug = raw.slug ?? raw.hid ?? raw.id;
  if (slug == null || slug === '') return null;
  const poster = proxiedImage(raw.poster ?? raw.cover ?? raw.image ?? '');
  return {
    id: `vs-${slug}`,
    hid: `vs-${slug}`,
    slug: String(slug),
    title: String(raw.title ?? 'Unknown Title'),
    altTitle: '',
    image: poster,
    thumbnail: poster,
    source: 'violetscans',
    status: raw.status ?? '',
    type: raw.type ?? 'Manhwa',
    genres: [],
    latestChapter: '',
    updatedAt: '',
    year: null,
    authors: [],
    artists: [],
    rating: null,
    description: raw.synopsis ?? raw.description ?? '',
    contentRating: '',
    _raw: raw,
  };
}

export async function searchViolet(keyword, limit = 10) {
  const q = (keyword || '').trim();
  if (!q) return [];
  try {
    const data = await get('/vs/search', { q });
    const items = pickList(data?.data?.items ?? data?.data);
    return items.map(normalizeVioletItem).filter(Boolean).slice(0, limit);
  } catch {
    return [];
  }
}

function chapterAsc(a, b) {
  const na = parseFloat(a?.number);
  const nb = parseFloat(b?.number);
  if (Number.isNaN(na) || Number.isNaN(nb)) return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
  return na - nb;
}

export async function getVioletTitle(hid) {
  const slug = String(hid ?? '').replace(/^vs-/, '');
  if (!slug) throw new Error('Missing title id');
  const data = await get('/vs/title', { slug });
  const d = data?.data ?? data;
  if (!d || typeof d !== 'object' || !d.title) throw new Error('Title not found');
  const normalized = normalizeVioletItem(d);
  if (!normalized) throw new Error('Title not found');
  const chapters = Array.isArray(d.chapters) ? d.chapters : [];
  return {
    ...normalized,
    description: d.synopsis ?? normalized.description,
    url: d.url ?? '',
    // Preloaded chapters so the detail view can render its list immediately.
    _episodes: chapters.map(normalizeChapter).filter(Boolean).sort(chapterAsc),
    recommendations: [],
    exactMatch: null,
    resolvedFrom: null,
    matchCount: null,
  };
}

export async function getVioletChapters(hid, { page = 1 } = {}) {
  const slug = String(hid ?? '').replace(/^vs-/, '');
  if (!slug) throw new Error('Missing title id');
  const data = await get('/vs/chapters', { slug });
  const payload = data?.data ?? data;
  const meta = payload?.meta ?? {};
  const chapters = pickList(payload?.items ?? payload)
    .map(normalizeChapter)
    .filter(Boolean)
    .sort(chapterAsc);
  return {
    chapters,
    pageInfo: {
      hasNext: false, // /vs/chapters returns the full list in one response
      total: meta.total ?? chapters.length,
      page,
    },
  };
}

export async function getVioletPages(chapterId) {
  const token = String(chapterId ?? '').replace(/^vs-/, '');
  if (!isVioletChapterId(token)) throw new Error('Invalid Violet Scans chapter id');
  // ALWAYS proxy=1 — the worker rewrites Violet Scans images to same-domain /image URLs.
  const data = await get('/pages', { chapter: token, proxy: '1' });
  const payload = data?.data ?? data;
  const pages = Array.isArray(payload?.pages) ? payload.pages.filter(Boolean) : [];
  return {
    chapterId: String(chapterId),
    quality: 'dataSaver',
    count: payload?.count ?? pages.length,
    readable: payload?.readable !== false && pages.length > 0,
    via: payload?.via ?? 'violetscans',
    externalUrl: payload?.url ?? '',
    message: pages.length ? '' : 'No pages found for this chapter.',
    pages,
  };
}

// ---------- Unified dispatchers (MangaDex vs Violet Scans) ----------

export function getTitleForId(id) {
  return isVioletId(id) ? getVioletTitle(id) : getManhwaTitle(id);
}

export function getChaptersForTitle(id, opts) {
  return isVioletId(id) ? getVioletChapters(id, opts) : getManhwaChapters(id, opts);
}

export function getPagesForChapter(chapterId, quality) {
  return isVioletChapterId(chapterId) ? getVioletPages(chapterId) : getManhwaPages(chapterId, quality);
}

// Keyword search: MangaDex best-match via /title plus Violet Scans matches
// via /vs/search. Violet Scans items come first.
export async function searchManhwa(keyword) {
  const q = (keyword || '').trim();
  if (!q) return { items: [], exactMatch: null, resolvedFrom: '' };
  const [md, vs] = await Promise.all([
    getManhwaTitle(q)
      .then((detail) => (isExplicitManhwa(detail) ? null : detail))
      .catch(() => null),
    searchViolet(q, 10),
  ]);
  const items = [...vs];
  if (md) items.push(md);
  return {
    items,
    exactMatch: md?.exactMatch ?? null,
    resolvedFrom: md?.resolvedFrom ?? q,
  };
}
