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

// ---------- LINE Webtoon source (webtoon-phinf.pstatic.net) ----------
// pstatic.net 403s browsers that send a foreign Referer, so covers are
// rewritten to the worker's same-domain /image proxy and /wt/pages is
// ALWAYS called with proxy=1 (worker rewrites pages to /image URLs).

export function proxiedImage(url) {
  if (!url || typeof url !== 'string') return '';
  if (!/pstatic\.net/i.test(url)) return url;
  return `${MANHWA_API}/image?url=${encodeURIComponent(url.replace(/swebtoon-phinf/g, 'webtoon-phinf'))}`;
}

// Numeric title_no ids belong to Webtoon; MangaDex hids are UUIDs.
export function isWebtoonId(id) {
  return /^\d+$/.test(String(id ?? '').trim());
}

// Webtoon episode ids look like "2135:7" (title_no:episode_no).
export function isWebtoonChapterId(id) {
  return /^\d+:\d+$/.test(String(id ?? '').trim());
}

export function normalizeWebtoonItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.hid ?? raw.id ?? raw.title_no ?? raw.titleNo;
  if (id == null || id === '') return null;
  const title = raw.title ?? raw.titleText ?? 'Unknown Title';
  const poster = proxiedImage(raw.poster ?? raw.cover ?? raw.image ?? raw.thumbnail ?? '');
  return {
    id: `wt-${id}`,
    hid: String(id),
    slug: null,
    title: String(title).split(' like')[0].trim() || String(title),
    altTitle: '',
    image: poster,
    thumbnail: poster,
    source: 'webtoon',
    status: raw.status ?? '',
    type: raw.type ?? 'Manhwa',
    genres: Array.isArray(raw.genres)
      ? raw.genres.map((g) => (typeof g === 'string' ? g : g?.name)).filter(Boolean)
      : [],
    latestChapter: '',
    updatedAt: '',
    year: null,
    authors: Array.isArray(raw.authors) ? raw.authors.filter(Boolean) : [],
    artists: [],
    rating: null,
    description: raw.synopsis ?? raw.description ?? '',
    contentRating: '',
    _raw: raw,
  };
}

export async function searchWebtoon(keyword, limit = 10) {
  const q = (keyword || '').trim();
  if (!q) return [];
  try {
    const data = await get('/wt/search', { q });
    const items = pickList(data?.data?.items ?? data?.data);
    return items.map(normalizeWebtoonItem).filter(Boolean).slice(0, limit);
  } catch {
    return [];
  }
}

export async function getWebtoonTitle(hid) {
  const id = String(hid ?? '').replace(/^wt-/, '');
  if (!id) throw new Error('Missing title id');
  const data = await get('/wt/title', { hid: id });
  const d = data?.data ?? data;
  if (!d || typeof d !== 'object' || !d.title) throw new Error('Title not found');
  const normalized = normalizeWebtoonItem(d);
  if (!normalized) throw new Error('Title not found');
  const episodes = Array.isArray(d.episodes) ? d.episodes : [];
  return {
    ...normalized,
    description: d.synopsis ?? normalized.description,
    url: d.url ?? '',
    // Preloaded first page of episodes so detail can render instantly.
    // Sorted oldest-first to match the MangaDex asc convention used by
    // the detail list and reader prev/next navigation.
    _episodes: episodes.map(normalizeChapter).filter(Boolean).sort(chapterAsc),
    recommendations: [],
    exactMatch: null,
    resolvedFrom: null,
    matchCount: null,
  };
}

function chapterAsc(a, b) {
  const na = parseFloat(a?.number);
  const nb = parseFloat(b?.number);
  if (Number.isNaN(na) || Number.isNaN(nb)) return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
  return na - nb;
}

export async function getWebtoonChapters(hid, { page = 1 } = {}) {
  const id = String(hid ?? '').replace(/^wt-/, '');
  if (!id) throw new Error('Missing title id');
  const data = await get('/wt/chapters', { hid: id, page });
  const payload = data?.data ?? data;
  const meta = payload?.meta ?? {};
  const chapters = pickList(payload?.items ?? payload)
    .map(normalizeChapter)
    .filter(Boolean)
    .sort(chapterAsc);
  return {
    chapters,
    pageInfo: {
      hasNext: !!meta.hasNext,
      total: meta.count ?? meta.total ?? chapters.length,
      page: meta.page ?? page,
    },
  };
}

export async function getWebtoonPages(chapterId) {
  const m = String(chapterId ?? '').replace(/^wt-/, '').match(/^(\d+):(\d+)$/);
  if (!m) throw new Error('Invalid Webtoon chapter id');
  // ALWAYS proxy=1 — the worker rewrites pstatic.net pages to same-domain
  // /image URLs. Browsers loading pstatic.net directly from the frontend's
  // origin hit its Referer wall (403).
  const data = await get('/wt/pages', { title: m[1], episode: m[2], proxy: '1' });
  const payload = data?.data ?? data;
  const pages = Array.isArray(payload?.pages) ? payload.pages.filter(Boolean) : [];
  return {
    chapterId: String(chapterId),
    quality: 'dataSaver',
    count: payload?.count ?? pages.length,
    readable: pages.length > 0,
    via: payload?.via ?? 'webtoon',
    externalUrl: payload?.url ?? '',
    message: pages.length ? '' : 'No pages found for this episode.',
    pages,
  };
}

// ---------- Unified dispatchers (MangaDex UUID vs Webtoon title_no) ----------

export function getTitleForId(id) {
  const bare = String(id ?? '').replace(/^wt-/, '');
  return isWebtoonId(bare) ? getWebtoonTitle(bare) : getManhwaTitle(id);
}

export function getChaptersForTitle(id, opts) {
  const bare = String(id ?? '').replace(/^wt-/, '');
  return isWebtoonId(bare)
    ? getWebtoonChapters(bare, opts)
    : getManhwaChapters(id, opts);
}

export function getPagesForChapter(chapterId, quality) {
  const bare = String(chapterId ?? '').replace(/^wt-/, '');
  return isWebtoonChapterId(bare)
    ? getWebtoonPages(chapterId)
    : getManhwaPages(chapterId, quality);
}

// Keyword search: MangaDex best-match via /title plus LINE Webtoon matches
// via /wt/search (official source). Webtoon items come first.
export async function searchManhwa(keyword) {
  const q = (keyword || '').trim();
  if (!q) return { items: [], exactMatch: null, resolvedFrom: '' };
  const [md, wt] = await Promise.all([
    getManhwaTitle(q)
      .then((detail) => (isExplicitManhwa(detail) ? null : detail))
      .catch(() => null),
    searchWebtoon(q, 10),
  ]);
  const items = [...wt];
  if (md) items.push(md);
  return {
    items,
    exactMatch: md?.exactMatch ?? null,
    resolvedFrom: md?.resolvedFrom ?? q,
  };
}
