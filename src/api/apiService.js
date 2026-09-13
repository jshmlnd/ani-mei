import axios from 'axios';

// Aniko Backend v2.0 — https://aniko-backend.rk18109ry.workers.dev
//   Catalog : /api/catalog/recent?page=&per_page=  /api/catalog/series/:id
//   Stream  : /api/stream/catalog/:epId/:track  /api/stream/ani/:aniId/:ep/:track
//            /api/stream/mal/:malId/:ep/:track
// Listings + search: AniList GraphQL first, Jikan (MyAnimeList) fallback,
// catalog pool as last resort. Cards carry `ani-` / `mal-` / catalog ids.
const STREAM_API = import.meta.env.VITE_STREAM_API_BASE || 'https://animeiapi.joshuaklein-malonda.workers.dev';

export const streamApiBase = STREAM_API;

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504];

async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  try {
    const response = await axios.get(url, options);
    return response;
  } catch (error) {
    const status = error?.response?.status;
    const isRetryable = RETRY_STATUS_CODES.includes(status) || !error?.response;
    if (isRetryable && retries > 0) {
      console.warn(`[fetchWithRetry] Request failed (${status || 'network error'}), retrying... (${retries} left)`, url);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

// ============================
// Catalog (Aniko v2.0)
// ============================

function toInt(v) {
  if (v == null || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function toScore(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v));
  if (Number.isNaN(n)) return null;
  // Backend scores are 0-10 → convert to AniList-style 0-100
  return Math.round(n * 10);
}

export function normalizeCatalogItem(raw) {
  if (!raw) return null;
  const id = String(raw.id);
  const title = raw.title || 'Unknown';
  const alt = raw.alternative || '';
  const poster = raw.poster || '';
  const genres = raw.terms_by_type?.genre || [];
  const studios = (raw.terms_by_type?.studios || []).map((name) => ({ name }));
  const type = raw.terms_by_type?.type?.[0] || 'TV';
  const seasonRaw = (raw.season || '').toUpperCase() || null;
  const seasonYear = toInt(raw.year);
  const score = toScore(raw.score);
  return {
    id,
    slug: raw.slug || id,
    kind: 'catalog',
    catalogId: id,
    aniId: raw.ani_id ? String(raw.ani_id) : null,
    malId: raw.mal_id ? String(raw.mal_id) : null,
    title: {
      english: title,
      romaji: alt || title,
      native: raw.native || alt || title,
    },
    coverImage: { large: poster, medium: poster },
    bannerImage: raw.background_image || poster,
    poster,
    format: type,
    type,
    status: raw.status || null,
    episodes: toInt(raw.episodes),
    genres: Array.isArray(genres) ? genres : [],
    genresRaw: genres,
    averageScore: score,
    score: raw.score ?? null,
    description: raw.description || '',
    synopsis: raw.description || '',
    aired: raw.aired || '',
    season: seasonRaw,
    seasonYear,
    studios: { nodes: studios },
    nextAiringEpisode: raw.next_air_ep
      ? { episode: toInt(raw.next_air_ep), airingAt: raw.next_air_schedule_time || null }
      : null,
    hasSub: (toInt(raw.is_sub) || 0) > 0,
    hasDub: (toInt(raw.is_dub) || 0) > 0,
    subCount: toInt(raw.is_sub) || 0,
    dubCount: toInt(raw.is_dub) || 0,
    jpTitle: alt,
    _raw: raw,
  };
}

async function fetchCatalogRecent(page = 1, perPage = 24) {
  const url = `${STREAM_API}/api/catalog/recent?page=${page}&per_page=${perPage}`;
  const { data } = await fetchWithRetry(url, { timeout: 15000, responseType: 'json' });
  if (!data?.ok || !Array.isArray(data?.data)) {
    throw new Error('Catalog returned no data');
  }
  const items = data.data.map(normalizeCatalogItem).filter(Boolean);
  return { items, pagination: data.pagination || null };
}

// ============================
// Home listings
// ============================
let _homeCache = null;
let _homeCacheTime = 0;
const HOME_CACHE_TTL = 60_000;

function topByScore(items, n) {
  return [...items]
    .sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0))
    .slice(0, n);
}

async function fetchCatalogHome() {
  const settled = await Promise.allSettled([
    fetchCatalogRecent(1, 24),
    fetchCatalogRecent(2, 24),
    fetchCatalogRecent(3, 24),
  ]);
  const pool = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') pool.push(...s.value.items);
  }
  const seen = new Set();
  const unique = pool.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  if (!unique.length) throw new Error('Catalog is empty');

  const finished = unique.filter((a) => (a.status || '').toLowerCase().includes('finish'));
  const result = {
    // Catalog "recent" is sorted by last update → page 1 doubles as new releases
    trending: topByScore(unique, 12),
    newReleases: unique.slice(0, 12),
    latestEpisodes: unique.slice(12, 36),
    finishedAir: finished.slice(0, 12),
  };
  return result;
}

export async function getHome() {
  const now = Date.now();
  if (_homeCache && (now - _homeCacheTime) < HOME_CACHE_TTL) return _homeCache;

  // 1) AniList — all four sections in a single batched query
  try {
    const home = await fetchAniListHome();
    _homeCache = home;
    _homeCacheTime = now;
    return home;
  } catch (e) {
    console.warn('[getHome] AniList failed:', e?.message);
  }

  // 2) Jikan (MyAnimeList) — then fill any empty sections from the catalog pool
  try {
    const home = await fetchJikanHome();
    if (!home.trending.length || !home.newReleases.length || !home.latestEpisodes.length || !home.finishedAir.length) {
      try {
        const cat = await fetchCatalogHome();
        if (!home.trending.length) home.trending = cat.trending;
        if (!home.newReleases.length) home.newReleases = cat.newReleases;
        if (!home.latestEpisodes.length) home.latestEpisodes = cat.latestEpisodes;
        if (!home.finishedAir.length) home.finishedAir = cat.finishedAir;
      } catch { /* catalog also failed — serve the partial result */ }
    }
    _homeCache = home;
    _homeCacheTime = now;
    return home;
  } catch (e) {
    console.warn('[getHome] Jikan failed:', e?.message);
  }

  // 3) Catalog last resort
  try {
    const home = await fetchCatalogHome();
    _homeCache = home;
    _homeCacheTime = now;
    return home;
  } catch (e) {
    console.warn('[getHome] failed:', e?.message);
    return { trending: [], newReleases: [], latestEpisodes: [], finishedAir: [] };
  }
}

function sectionToPageInfo(items, perPage, page) {
  const total = items.length;
  const start = (page - 1) * perPage;
  const slice = items.slice(start, start + perPage);
  return {
    media: slice,
    pageInfo: {
      hasNextPage: start + perPage < total,
      currentPage: page,
      lastPage: Math.max(1, Math.ceil(total / perPage)),
      total,
      perPage,
    },
  };
}

function toPageInfo(pagination, perPage, page, length) {
  if (!pagination) {
    return {
      hasNextPage: length >= perPage,
      currentPage: page,
      lastPage: page + (length >= perPage ? 1 : 0),
      total: null,
      perPage,
    };
  }
  const totalPages = pagination.total_pages || 1;
  return {
    hasNextPage: page < totalPages,
    currentPage: page,
    lastPage: totalPages,
    total: pagination.total ?? length,
    perPage,
  };
}

// Public listing adapters — AniList → Jikan → catalog
export async function getPopularAnime(page = 1, perPage = 12) {
  try {
    return await fetchAniListList({ page, perPage, sort: ['POPULARITY_DESC'] });
  } catch (e) {
    console.warn('[getPopularAnime] AniList failed:', e?.message);
  }
  try {
    return await fetchJikanList('popular', page, perPage);
  } catch (e) {
    console.warn('[getPopularAnime] Jikan failed:', e?.message);
  }
  try {
    const { items, pagination } = await fetchCatalogRecent(page, perPage);
    return { media: topByScore(items, perPage), pageInfo: toPageInfo(pagination, perPage, page, items.length) };
  } catch {
    const home = await getHome();
    return sectionToPageInfo(home.trending, perPage, page);
  }
}

export async function getTrendingAnime(page = 1, perPage = 10) {
  try {
    return await fetchAniListList({ page, perPage, sort: ['TRENDING_DESC'] });
  } catch (e) {
    console.warn('[getTrendingAnime] AniList failed:', e?.message);
  }
  try {
    return await fetchJikanList('trending', page, perPage);
  } catch (e) {
    console.warn('[getTrendingAnime] Jikan failed:', e?.message);
  }
  try {
    const { items, pagination } = await fetchCatalogRecent(page, perPage);
    return { media: topByScore(items, perPage), pageInfo: toPageInfo(pagination, perPage, page, items.length) };
  } catch {
    const home = await getHome();
    return sectionToPageInfo(home.trending, perPage, page);
  }
}

export async function getRecentAnime(page = 1, perPage = 20) {
  try {
    return await fetchAniListList({ page, perPage, sort: ['UPDATED_AT_DESC'], status: 'RELEASING' });
  } catch (e) {
    console.warn('[getRecentAnime] AniList failed:', e?.message);
  }
  try {
    return await fetchJikanList('recent', page, perPage);
  } catch (e) {
    console.warn('[getRecentAnime] Jikan failed:', e?.message);
  }
  try {
    const { items, pagination } = await fetchCatalogRecent(page, perPage);
    return { media: items, pageInfo: toPageInfo(pagination, perPage, page, items.length) };
  } catch {
    const home = await getHome();
    return sectionToPageInfo(home.latestEpisodes, perPage, page);
  }
}

export async function getTopRatedAnime(page = 1, perPage = 12) {
  try {
    return await fetchAniListList({ page, perPage, sort: ['SCORE_DESC'], status: 'FINISHED' });
  } catch (e) {
    console.warn('[getTopRatedAnime] AniList failed:', e?.message);
  }
  try {
    return await fetchJikanList('top', page, perPage);
  } catch (e) {
    console.warn('[getTopRatedAnime] Jikan failed:', e?.message);
  }
  try {
    // Finished titles are sparse in "recent", so pool a few pages then filter client-side
    const settled = await Promise.allSettled([1, 2, 3, 4].map((p) => fetchCatalogRecent(p, 24)));
    const pool = [];
    for (const s of settled) {
      if (s.status === 'fulfilled') pool.push(...s.value.items);
    }
    const finished = pool.filter((a) => (a.status || '').toLowerCase().includes('finish'));
    const list = finished.length ? topByScore(finished, 96) : topByScore(pool, 96);
    return sectionToPageInfo(list, perPage, page);
  } catch {
    const home = await getHome();
    return sectionToPageInfo(home.finishedAir, perPage, page);
  }
}

// ============================
// AniList (search + metadata fallback)
// ============================
const ANILIST_API = 'https://graphql.anilist.co';

const MEDIA_FIELDS = `
  id
  title { romaji english native }
  coverImage { large medium }
  bannerImage
  format
  status
  episodes
  genres
  averageScore
  description(asHtml: false)
  nextAiringEpisode { episode airingAt }
  season
  seasonYear
  startDate { year month day }
  studios(isMain: true) { nodes { name } }
 `;

const SEARCH_QUERY = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total perPage currentPage lastPage hasNextPage }
    media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
      ${MEDIA_FIELDS}
    }
  }
}`;

const DETAILS_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    ${MEDIA_FIELDS}
    relations {
      edges {
        relationType
        node {
          id
          title { romaji english }
          coverImage { large }
          format
        }
      }
    }
    characters(sort: ROLE, perPage: 10, role: MAIN) {
      nodes {
        name { full }
        image { large }
      }
    }
  }
}`;

async function post(query, variables) {
  try {
    const { data } = await axios.post(ANILIST_API, { query, variables });
    if (data.errors) {
      console.error('AniList GraphQL errors:', data.errors);
      throw new Error(data.errors[0]?.message || 'GraphQL error');
    }
    return data.data;
  } catch (err) {
    if (err.response?.data) {
      console.error('AniList HTTP error:', err.response.status, JSON.stringify(err.response.data));
    }
    throw err;
  }
}

export function normalizeAniListMedia(m) {
  if (!m) return null;
  const id = `ani-${m.id}`;
  return {
    id,
    slug: id,
    kind: 'ani',
    catalogId: null,
    aniId: String(m.id),
    malId: null,
    title: {
      english: m.title?.english || m.title?.romaji || 'Unknown',
      romaji: m.title?.romaji || m.title?.english || 'Unknown',
      native: m.title?.native || m.title?.romaji || 'Unknown',
    },
    coverImage: { large: m.coverImage?.large, medium: m.coverImage?.medium || m.coverImage?.large },
    bannerImage: m.bannerImage || m.coverImage?.large,
    poster: m.coverImage?.large,
    format: m.format || 'TV',
    type: m.format || 'TV',
    status: m.status || null,
    episodes: typeof m.episodes === 'number' ? m.episodes : null,
    genres: m.genres || [],
    genresRaw: m.genres || [],
    averageScore: m.averageScore ?? null,
    score: m.averageScore != null ? (m.averageScore / 10).toFixed(1) : null,
    description: m.description || '',
    synopsis: m.description || '',
    season: m.season || null,
    seasonYear: m.seasonYear || null,
    startDate: m.startDate || null,
    nextAiringEpisode: m.nextAiringEpisode || null,
    studios: m.studios || { nodes: [] },
    relations: m.relations || { edges: [] },
    characters: m.characters || { nodes: [] },
    hasSub: true,
    hasDub: false,
    subCount: m.episodes || 0,
    dubCount: 0,
    episodesList: null,
    _raw: m,
  };
}

export async function searchAnime(keyword, page = 1, perPage = 20) {
  const empty = { media: [], pageInfo: { hasNextPage: false, currentPage: page, lastPage: page, total: 0, perPage } };
  if (!keyword || !keyword.trim()) {
    return getPopularAnime(page, perPage);
  }
  // AniList first (fast, rich data) — Jikan as fallback (has MAL ids for streaming)
  try {
    const data = await post(SEARCH_QUERY, { search: keyword.trim(), page, perPage });
    const media = (data?.Page?.media || []).map(normalizeAniListMedia).filter(Boolean);
    if (media.length) {
      const info = data?.Page?.pageInfo || {};
      return {
        media,
        pageInfo: {
          hasNextPage: !!info.hasNextPage,
          currentPage: info.currentPage || page,
          lastPage: info.lastPage || page,
          total: info.total ?? media.length,
          perPage,
        },
      };
    }
    throw new Error('AniList returned no results');
  } catch (e) {
    console.warn('[searchAnime] AniList failed, trying Jikan:', e?.message);
    try {
      return await searchJikan(keyword.trim(), page, perPage);
    } catch (e2) {
      console.warn('[searchAnime] Jikan also failed:', e2?.message);
      return empty;
    }
  }
}

// ============================
// Listing providers: AniList → Jikan (MAL) → catalog
// Function declarations hoist, so getHome/adapters above can call them.
// Cards carry `ani-` / `mal-` ids; Watch already streams every kind.
// ============================

const HOME_QUERY = `
query {
  trending: Page(page: 1, perPage: 12) {
    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
      ${MEDIA_FIELDS}
    }
  }
  popular: Page(page: 1, perPage: 12) {
    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
      ${MEDIA_FIELDS}
    }
  }
  recent: Page(page: 1, perPage: 24) {
    media(type: ANIME, status: RELEASING, sort: UPDATED_AT_DESC, isAdult: false) {
      ${MEDIA_FIELDS}
    }
  }
  finished: Page(page: 1, perPage: 12) {
    media(type: ANIME, status: FINISHED, sort: SCORE_DESC, isAdult: false) {
      ${MEDIA_FIELDS}
    }
  }
}`;

function buildListQuery(status) {
  const statusArg = status ? `, status: ${status}` : '';
  return `
query ($page: Int, $perPage: Int, $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total perPage currentPage lastPage hasNextPage }
    media(type: ANIME${statusArg}, sort: $sort, isAdult: false) {
      ${MEDIA_FIELDS}
    }
  }
}`;
}

async function fetchAniListList({ page = 1, perPage = 12, sort = ['POPULARITY_DESC'], status = null }) {
  const data = await post(buildListQuery(status), { page, perPage, sort });
  const media = (data?.Page?.media || []).map(normalizeAniListMedia).filter(Boolean);
  const info = data?.Page?.pageInfo || {};
  return {
    media,
    pageInfo: {
      hasNextPage: !!info.hasNextPage,
      currentPage: info.currentPage || page,
      lastPage: info.lastPage || page,
      total: info.total ?? media.length,
      perPage,
    },
  };
}

async function fetchAniListHome() {
  const data = await post(HOME_QUERY, {});
  const norm = (arr) => (arr || []).map(normalizeAniListMedia).filter(Boolean);
  const trending = norm(data?.trending?.media);
  const newReleases = norm(data?.popular?.media);
  const latestEpisodes = norm(data?.recent?.media);
  const finishedAir = norm(data?.finished?.media);
  if (!trending.length && !newReleases.length && !latestEpisodes.length) {
    throw new Error('AniList home empty');
  }
  return { trending, newReleases, latestEpisodes, finishedAir };
}

const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const JIKAN_LISTS = {
  trending: (page, perPage) => `${JIKAN_API}/top/anime?filter=bypopularity&page=${page}&limit=${perPage}&sfw=true`,
  popular: (page, perPage) => `${JIKAN_API}/top/anime?filter=bypopularity&page=${page}&limit=${perPage}&sfw=true`,
  recent: (page, perPage) => `${JIKAN_API}/top/anime?filter=airing&page=${page}&limit=${perPage}&sfw=true`,
  new: (page, perPage) => `${JIKAN_API}/seasons/now?page=${page}&limit=${perPage}&sfw=true`,
  top: (page, perPage) => `${JIKAN_API}/top/anime?page=${page}&limit=${perPage}&sfw=true`,
};

async function fetchJikan(url) {
  try {
    const { data } = await axios.get(url, { timeout: 15000, responseType: 'json' });
    return data;
  } catch (e) {
    if (e?.response?.status === 429) {
      await waitMs(2500);
      const { data } = await axios.get(url, { timeout: 15000, responseType: 'json' });
      return data;
    }
    throw e;
  }
}

function jikanPageInfo(pg, perPage, page, length) {
  return {
    hasNextPage: !!pg?.has_next_page,
    currentPage: pg?.current_page || page,
    lastPage: pg?.last_visible_page || page,
    total: pg?.items?.total ?? length,
    perPage,
  };
}

async function fetchJikanList(key, page = 1, perPage = 12) {
  const limit = Math.min(Math.max(perPage, 1), 25);
  const data = await fetchJikan(JIKAN_LISTS[key](page, limit));
  const media = (data?.data || []).map(normalizeJikanMedia).filter(Boolean);
  return { media, pageInfo: jikanPageInfo(data?.pagination, perPage, page, media.length) };
}

async function fetchJikanHome() {
  const out = { trending: [], newReleases: [], latestEpisodes: [], finishedAir: [] };
  const jobs = [
    ['trending', 'trending', 12],
    ['newReleases', 'new', 12],
    ['latestEpisodes', 'recent', 24],
    ['finishedAir', 'top', 12],
  ];
  for (const [field, key, n] of jobs) {
    try {
      const { media } = await fetchJikanList(key, 1, n);
      out[field] = media;
    } catch (e) {
      console.warn(`[fetchJikanHome] ${key} failed:`, e?.message);
    }
    await waitMs(600); // stay under Jikan's 3 req/s limit
  }
  if (!out.trending.length && !out.newReleases.length && !out.latestEpisodes.length) {
    throw new Error('Jikan home empty');
  }
  return out;
}

// ============================
// Jikan (MyAnimeList API — search fallback, MAL-id details)
// No key required. Rate limit: 3 req/s — one request per search/details call.
// ============================
const JIKAN_API = 'https://api.jikan.moe/v4';

export function normalizeJikanMedia(m) {
  if (!m?.mal_id) return null;
  const id = `mal-${m.mal_id}`;
  const title = m.title_english || m.title || 'Unknown';
  const poster = m.images?.jpg?.large_image_url || m.images?.jpg?.image_url || '';
  const genres = (m.genres || []).map((g) => g?.name).filter(Boolean);
  const studios = (m.studios || []).map((s) => ({ name: s?.name })).filter((s) => s.name);
  const score = typeof m.score === 'number' ? Math.round(m.score * 10) : null;
  return {
    id,
    slug: id,
    kind: 'mal',
    catalogId: null,
    aniId: null,
    malId: String(m.mal_id),
    title: {
      english: title,
      romaji: m.title || title,
      native: m.title_japanese || m.title || title,
    },
    coverImage: { large: poster, medium: m.images?.jpg?.image_url || poster },
    bannerImage: m.images?.jpg?.large_image_url || poster,
    poster,
    format: m.type || 'TV',
    type: m.type || 'TV',
    status: m.status || null,
    episodes: typeof m.episodes === 'number' ? m.episodes : null,
    genres,
    genresRaw: genres,
    averageScore: score,
    score: m.score ?? null,
    description: m.synopsis || '',
    synopsis: m.synopsis || '',
    aired: typeof m.aired?.string === 'string' ? m.aired.string : '',
    season: (m.season || '').toUpperCase() || null,
    seasonYear: m.year || null,
    startDate: null,
    nextAiringEpisode: null,
    studios: { nodes: studios },
    relations: { edges: [] },
    characters: { nodes: [] },
    hasSub: true,
    hasDub: false,
    subCount: m.episodes || 0,
    dubCount: 0,
    episodesList: null,
    _raw: m,
  };
}

export async function searchJikan(keyword, page = 1, perPage = 20) {
  const limit = Math.min(Math.max(perPage, 1), 25);
  const url = `${JIKAN_API}/anime?q=${encodeURIComponent(keyword)}&page=${page}&limit=${limit}&order_by=members&sort=desc&sfw=true`;
  const { data } = await fetchWithRetry(url, { timeout: 25000, responseType: 'json' });
  const media = (data?.data || []).map(normalizeJikanMedia).filter(Boolean);
  const pg = data?.pagination || {};
  return {
    media,
    pageInfo: {
      hasNextPage: !!pg.has_next_page,
      currentPage: pg.current_page || page,
      lastPage: pg.last_visible_page || page,
      total: pg.items?.total ?? media.length,
      perPage,
    },
  };
}

async function getJikanDetails(malId) {
  const { data } = await fetchWithRetry(`${JIKAN_API}/anime/${encodeURIComponent(malId)}/full`, {
    timeout: 20000,
    responseType: 'json',
  });
  if (!data?.data) throw new Error('Title not found');
  const normalized = normalizeJikanMedia(data.data);
  if (!normalized) throw new Error('Title not found');
  return normalized;
}

// ============================
// Anime details
// ============================
function normalizeSeriesDetails(payload) {
  const a = payload?.anime;
  if (!a?.id && !a?.title) return null;
  const base = normalizeCatalogItem(a);
  if (!base) return null;
  const episodes = Array.isArray(payload?.episodes)
    ? payload.episodes
      .map((ep) => ({
        id: String(ep.id ?? ep.number),
        number: toInt(ep.number) ?? 0,
        title: ep.title || `Episode ${ep.number}`,
        embedId: ep.episode_embed_id ? String(ep.episode_embed_id) : null,
        tracks: Object.keys(ep.embed_url || {}).filter((k) => k === 'sub' || k === 'dub'),
        embedUrl: ep.embed_url || {},
        _raw: ep,
      }))
      .filter((ep) => ep.number > 0)
      .sort((x, y) => x.number - y.number)
    : [];
  return {
    ...base,
    episodesList: episodes,
    episodeCount: episodes.length || base.episodes,
    relatedRaw: [],
    relations: { edges: [] },
    characters: { nodes: [] },
    rawPayload: payload,
  };
}

async function getCatalogSeriesDetails(catalogId) {
  const res = await fetchWithRetry(`${STREAM_API}/api/catalog/series/${encodeURIComponent(catalogId)}`, {
    timeout: 15000,
    responseType: 'json',
  });
  const data = res.data;
  if (!data?.ok || !data?.data) throw new Error('Series not found');
  return normalizeSeriesDetails(data.data);
}

export async function getAnimeById(id) {
  const str = String(id);
  if (str.startsWith('ani-')) {
    const aniId = parseInt(str.slice(4), 10);
    if (Number.isNaN(aniId)) throw new Error('Invalid anime id');
    const data = await post(DETAILS_QUERY, { id: aniId });
    const normalized = normalizeAniListMedia(data.Media);
    if (!normalized) throw new Error('Anime not found');
    return normalized;
  }
  if (str.startsWith('mal-')) {
    const malId = str.slice(4);
    if (!malId) throw new Error('Invalid anime id');
    return getJikanDetails(malId);
  }
  // Catalog numeric id — fall back to AniList if the catalog has no such series
  try {
    return await getCatalogSeriesDetails(str);
  } catch (e) {
    if (/^\d+$/.test(str)) {
      const data = await post(DETAILS_QUERY, { id: parseInt(str, 10) });
      const normalized = normalizeAniListMedia(data.Media);
      if (normalized) return normalized;
    }
    throw e;
  }
}

// ============================
// Streaming
// ============================
export function getTracksForEpisode(anime, epEntry) {
  if (anime?.kind === 'catalog') {
    const fromEp = epEntry?.tracks?.length ? epEntry.tracks : null;
    if (fromEp) return fromEp.includes('dub') ? ['sub', 'dub'] : ['sub'];
    const tracks = [];
    if (anime.hasSub) tracks.push('sub');
    if (anime.hasDub) tracks.push('dub');
    return tracks.length ? tracks : ['sub'];
  }
  // AniList-routed titles: SUB is guaranteed, DUB is attempted
  return ['sub', 'dub'];
}

export async function getEpisodeStream({ catalogEpId = null, aniId = null, malId = null, episode = 1, track = 'sub' }) {
  let url;
  if (catalogEpId) {
    url = `${STREAM_API}/api/stream/catalog/${encodeURIComponent(catalogEpId)}/${track}`;
  } else if (aniId) {
    url = `${STREAM_API}/api/stream/ani/${encodeURIComponent(aniId)}/${encodeURIComponent(episode)}/${track}`;
  } else if (malId) {
    url = `${STREAM_API}/api/stream/mal/${encodeURIComponent(malId)}/${encodeURIComponent(episode)}/${track}`;
  } else {
    throw new Error('No stream identifiers');
  }
  const { data } = await fetchWithRetry(url, { timeout: 25000, responseType: 'json' });
  if (!data?.success) throw new Error(data?.error || 'No stream found');
  const src = Array.isArray(data.sources) ? data.sources[0] : null;
  // Prefer the worker-proxied HLS URL — direct CDN links often 403 in browsers
  const m3u8 = src?.proxy_url || src?.url || data.stream_url || '';
  if (!m3u8) throw new Error('Stream has no playable URL');
  const vttProxy = (u) => (u ? `${STREAM_API}/api/proxy/vtt?url=${encodeURIComponent(u)}` : '');
  const VALID_KINDS = ['subtitles', 'captions', 'descriptions'];
  return {
    m3u8,
    url: data.stream_url || m3u8,
    // Shape-agnostic: providers vary (url/file/src + label/name/lang)
    subtitles: (data.subtitles || []).map((s) => {
      const rawUrl = s.url || s.file || s.src || s.uri || '';
      const kind = VALID_KINDS.includes(s.kind) ? s.kind : 'subtitles';
      return {
        url: rawUrl,
        // Prefer the backend's own routed proxy URL when provided
        proxiedUrl: s.proxy_url || s.proxyUrl || vttProxy(rawUrl),
        rawUrl,
        label: s.label || s.name || s.language || (s.lang ? String(s.lang).toUpperCase() : '') || 'Subtitles',
        lang: s.lang || s.language || '',
        kind,
        isDefault: !!s.default,
      };
    }),
    intro: data.intro && data.intro.end > 0 ? { start: data.intro.start || 0, end: data.intro.end } : null,
    outro: data.outro && data.outro.end > 0 ? { start: data.outro.start || 0, end: data.outro.end } : null,
    sourceInfo: {
      provider: data.provider || '',
      server: src?.server || '',
      domain: (() => { try { return new URL(data.stream_url || '').hostname; } catch { return ''; } })(),
    },
  };
}

export function proxyVtt(url) {
  if (!url) return '';
  return `${STREAM_API}/api/proxy/vtt?url=${encodeURIComponent(url)}`;
}

// ============================
// Helpers used by components
// ============================
export function getDisplayTitle(media) {
  if (!media) return 'Unknown';
  if (media.title && typeof media.title === 'object') {
    return media.title.english || media.title.romaji || media.title.native || media.title || 'Unknown';
  }
  if (typeof media.title === 'string' && media.title) return media.title;
  if (media.jpTitle) return media.jpTitle;
  return 'Unknown';
}

export function getEpisodeCount(media) {
  if (!media) return 24;
  if (Array.isArray(media.episodesList) && media.episodesList.length) return media.episodesList.length;
  if (typeof media.episodes === 'number' && !Number.isNaN(media.episodes)) return media.episodes;
  if (media.episodes && typeof media.episodes === 'object') {
    return media.episodes.total || media.episodes.sub || 12;
  }
  if (media.episodeCount) return media.episodeCount;
  return 24;
}
