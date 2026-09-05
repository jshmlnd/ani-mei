import axios from 'axios';

const ANILIST_API = import.meta.env.VITE_ANILIST_API || 'https://graphql.anilist.co';
const STREAM_API = import.meta.env.VITE_STREAM_API_BASE || 'https://animeiapi.joshuaklein-malonda.workers.dev';

const PROXY_BASE = '/api/proxy';

function proxyUrl(targetUrl, extra = '') {
  return `${PROXY_BASE}?url=${encodeURIComponent(targetUrl)}${extra}`;
}

function rawProxyUrl(targetUrl) {
  return proxyUrl(targetUrl, '&raw=1');
}

function isDirectM3u8(url) {
  return url && (/\.m3u8($|\?)/i.test(url) || /\/m3u8/i.test(url) || /hls/i.test(url));
}

function extractEmbedUrl(data) {
  const player = data?.player || data?.data?.player || data?.data?.stream || {};
  return (
    player.url ||
    player.embedUrl ||
    player.iframe?.match(/src=["']([^"']+)["']/i)?.[1] ||
    data?.data?.url ||
    data?.url ||
    ''
  );
}

function normalizeWatchData(payload, slug, episode) {
  const data = payload?.data || payload || {};
  const servers = data.servers || {};
  const flat = data.flatServers || data.flat || [];
  const player = data.player || null;
  const playerServer = player?.server || player?.source || player;
  const playerLinkId = playerServer?.linkId || playerServer?.id || null;
  const playerUrl = extractEmbedUrl(data);

  return {
    servers,
    flat: Array.isArray(flat) ? flat : [],
    player,
    playerUrl,
    playerLinkId,
    anime: data.anime || null,
    episodes: data.episodes || [],
    episodeCount: data.episodeCount || 0,
    slug,
    episode,
  };
}

async function getWatchData(slug, episode) {
  const episodePath = String(episode).startsWith('ep-') ? episode : `ep-${episode}`;
  const api = `${STREAM_API}/watch/${encodeURIComponent(slug)}/${episodePath}`;
  const { data } = await axios.get(rawProxyUrl(api), {
    timeout: 20000,
    responseType: 'json',
  });
  return normalizeWatchData(data, slug, episode);
}

async function extractM3u8FromEmbed(embedUrl, headers = {}) {
  const encodedHeaders = encodeURIComponent(JSON.stringify(headers));
  const { data: html } = await axios.get(`${PROXY_BASE}?url=${encodeURIComponent(embedUrl)}&h=${encodedHeaders}`, {
    timeout: 10000,
    responseType: 'text',
    transformResponse: [(d) => d],
  });

  // Pattern 1: "sourceUrl": "https://..." (existing)
  const sourceUrlMatch = html.match(/"sourceUrl"\s*:\s*"([^"]+)"/);
  if (sourceUrlMatch) {
    const sourceUrl = sourceUrlMatch[1].startsWith('http')
      ? sourceUrlMatch[1]
      : `${new URL(embedUrl).origin}${sourceUrlMatch[1]}`;
    try {
      const { data: sourceData } = await axios.get(rawProxyUrl(sourceUrl), {
        timeout: 10000,
        headers: { Accept: 'application/json' },
      });
      if (sourceData?.status === 'ok' && sourceData?.source) {
        return sourceData.source;
      }
    } catch { /* continue to next pattern */ }
  }

  // Pattern 2: Direct m3u8 URL in source/src/file property
  const directM3u8 = html.match(/(?:source|src|file|url)\s*[:=]\s*["']([^"']*\.m3u8[^"']*?)["']/i);
  if (directM3u8) {
    const m3u8Url = directM3u8[1].startsWith('http')
      ? directM3u8[1]
      : `${new URL(embedUrl).origin}${directM3u8[1]}`;
    return m3u8Url;
  }

  // Pattern 3: HLS source in JSON config (e.g., sources: [{file: "..."}])
  const jsonConfigMatch = html.match(/(?:sources|playlist)\s*[:=]\s*\[?\{[^}]*file\s*:\s*["']([^"']*\.m3u8[^"']*?)["']/i);
  if (jsonConfigMatch) {
    const m3u8Url = jsonConfigMatch[1].startsWith('http')
      ? jsonConfigMatch[1]
      : `${new URL(embedUrl).origin}${jsonConfigMatch[1]}`;
    return m3u8Url;
  }

  // Pattern 4: data-src or data-url attributes with m3u8
  const dataSrcMatch = html.match(/data-(?:src|url|video)\s*=\s*["']([^"']*\.m3u8[^"']*?)["']/i);
  if (dataSrcMatch) {
    const m3u8Url = dataSrcMatch[1].startsWith('http')
      ? dataSrcMatch[1]
      : `${new URL(embedUrl).origin}${dataSrcMatch[1]}`;
    return m3u8Url;
  }

  // Pattern 5: HLS.js source assignment (e.g., hls.loadSource("..."))
  const hlsSourceMatch = html.match(/(?:loadSource|src)\s*\(\s*["']([^"']*\.m3u8[^"']*?)["']/i);
  if (hlsSourceMatch) {
    const m3u8Url = hlsSourceMatch[1].startsWith('http')
      ? hlsSourceMatch[1]
      : `${new URL(embedUrl).origin}${hlsSourceMatch[1]}`;
    return m3u8Url;
  }

  return null;
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function searchStream(keyword) {
  // New API: GET /search?q=keyword (AniMeiAPI – AnikotoTV)
  try {
    const api = `${STREAM_API}/search?q=${encodeURIComponent(keyword)}`;
    const { data } = await axios.get(rawProxyUrl(api), {
      timeout: 15000,
      responseType: 'json',
    });
    if (data?.success) {
      const raw = data?.data?.data ?? data?.data ?? [];
      const list = Array.isArray(raw) ? raw : raw?.data ?? [];
      if (Array.isArray(list) && list.length) {
        return list.map((r) => ({
          id: r.slug || '',
          title: r.title?.replace(/&#\d+;/g, (m) => String.fromCharCode(parseInt(m.slice(2, -1)))) || '',
          type: r.type || 'sub',
        }));
      }
    }
  } catch (e) {
    console.warn('[searchStream] /search failed:', e?.message);
  }
  // Fallback to legacy endpoint for backwards-compat
  try {
    const api = `${STREAM_API}/api/v1/search?q=${encodeURIComponent(keyword)}`;
    const { data } = await axios.get(rawProxyUrl(api), {
      timeout: 15000,
      responseType: 'json',
    });
    if (!data?.success || !data?.data?.length) return [];
    return data.data.map((r) => ({
      id: r.slug || '',
      title: r.title?.replace(/&#\d+;/g, (m) => String.fromCharCode(parseInt(m.slice(2, -1)))) || '',
      type: r.type || 'sub',
    }));
  } catch {
    return [];
  }
}

async function getStream(slug, episode, headers = {}) {
  // New API flow: GET /watch/:slug/:episode -> unified player/server response.
  let embedUrl = '';
  try {
    const watch = await getWatchData(slug, episode);
    embedUrl = watch.playerUrl;
    if (!embedUrl && watch.playerLinkId) {
      const streamApi = `${STREAM_API}/stream/${encodeURIComponent(watch.playerLinkId)}`;
      const { data: streamData } = await axios.get(rawProxyUrl(streamApi), {
        timeout: 15000,
        responseType: 'json',
      });
      embedUrl = extractEmbedUrl(streamData);
    }
  } catch (e) {
    const status = e?.response?.status;
    if (status !== 404) console.warn('[getStream] /watch failed for', slug, episode, e?.message);
  }

  // Legacy fallback: GET /player/:slug/:episode.
  if (!embedUrl) try {
    const api = `${STREAM_API}/player/${encodeURIComponent(slug)}/${episode}`;
    const { data: playerData } = await axios.get(rawProxyUrl(api), {
      timeout: 20000,
      responseType: 'json',
    });
    if (playerData?.success && playerData?.data) {
      embedUrl = extractEmbedUrl(playerData.data);
      // If we got linkId but no url, try /stream/:linkId
      if (!embedUrl && playerData.data.linkId) {
        try {
          const streamApi = `${STREAM_API}/stream/${encodeURIComponent(playerData.data.linkId)}`;
          const { data: streamData } = await axios.get(rawProxyUrl(streamApi), {
            timeout: 15000,
            responseType: 'json',
          });
          embedUrl = streamData?.data?.url || streamData?.data?.raw?.url || '';
        } catch (_e) { void _e; }
      }
      // Also try servers -> stream fallback if player url missing
      if (!embedUrl) {
        const flat = playerData.data.flatServers || playerData.data.servers?.sub || [];
        const first = Array.isArray(flat) ? flat[0] : null;
        if (first?.linkId) {
          try {
            const streamApi = `${STREAM_API}/stream/${encodeURIComponent(first.linkId)}`;
            const { data: sData } = await axios.get(rawProxyUrl(streamApi), {
              timeout: 15000,
              responseType: 'json',
            });
            embedUrl = sData?.data?.url || sData?.data?.raw?.url || '';
          } catch (_e) { void _e; }
        }
      }
    }
  } catch (e) {
    const status = e?.response?.status;
    if (status !== 404) console.warn('[getStream] /player failed for', slug, episode, e?.message);
  }

  // Fallback: try /servers/:slug/:episode -> /stream/:linkId
  if (!embedUrl) {
    try {
      const api = `${STREAM_API}/servers/${encodeURIComponent(slug)}/${episode}`;
      const { data: serversData } = await axios.get(rawProxyUrl(api), {
        timeout: 15000,
        responseType: 'json',
      });
      const flat = serversData?.data?.flat || serversData?.data?.servers?.sub || [];
      const first = Array.isArray(flat) ? flat[0] : null;
      if (first?.linkId) {
        const streamApi = `${STREAM_API}/stream/${encodeURIComponent(first.linkId)}`;
        const { data: sData } = await axios.get(rawProxyUrl(streamApi), {
          timeout: 15000,
          responseType: 'json',
        });
        embedUrl = sData?.data?.url || sData?.data?.raw?.url || '';
      }
    } catch (_e) { void _e; }
  }

  // Legacy fallback: /api/v1/episode-stream
  if (!embedUrl) {
    try {
      const api = `${STREAM_API}/api/v1/episode-stream?slug=${encodeURIComponent(slug)}&ep=${episode}`;
      const { data: streamData } = await axios.get(rawProxyUrl(api), {
        timeout: 20000,
        responseType: 'json',
      });
      if (streamData?.success && streamData?.data?.streaming_link) {
        embedUrl = streamData.data.streaming_link;
      }
    } catch (_e) { void _e; }
  }

  if (!embedUrl) return { m3u8: '', embedUrl: '', m3u8Headers: {} };

  // If embedUrl is already a direct m3u8, use it directly
  if (isDirectM3u8(embedUrl)) {
    return {
      m3u8: proxyUrl(embedUrl),
      embedUrl,
      m3u8Headers: headers,
    };
  }

  try {
    const m3u8Url = await extractM3u8FromEmbed(embedUrl, headers);
    if (m3u8Url) {
      return {
        m3u8: proxyUrl(m3u8Url),
        embedUrl,
        m3u8Headers: headers,
      };
    }
  } catch (e) {
    console.error('[stream] extractM3u8FromEmbed failed:', e);
  }

  return { m3u8: '', embedUrl, m3u8Headers: headers };
}

export async function getServers(slug, episode) {
  // New API: /watch/:slug/:episode returns servers and player data together.
  try {
    const watch = await getWatchData(slug, episode);
    if (watch.flat.length || Object.keys(watch.servers).length || watch.playerUrl || watch.playerLinkId) {
      return { ...watch, raw: watch, source: 'watch' };
    }
  } catch (e) {
    const status = e?.response?.status;
    if (status !== 404) console.warn('[getServers] /watch failed for', slug, episode, e?.message);
  }

  // Legacy fallback: /servers/:slug/:episode
  try {
    const api = `${STREAM_API}/servers/${encodeURIComponent(slug)}/${episode}`;
    const { data: serversData } = await axios.get(rawProxyUrl(api), {
      timeout: 15000,
      responseType: 'json',
    });
    if (serversData?.success && serversData?.data) {
      const d = serversData.data;
      const servers = d.servers || {};
      const flat = d.flat || d.flatServers || [];
      // normalize: ensure every server has type field
      if (Object.keys(servers).length || (Array.isArray(flat) && flat.length)) {
        return { servers, flat, raw: d, source: 'servers', slug, episode };
      }
    }
  } catch (e) {
    const status = e?.response?.status;
    if (status !== 404) console.warn('[getServers] /servers failed for', slug, episode, e?.message);
  }

  // Fallback to /player/:slug/:episode — also exposes servers
  try {
    const api = `${STREAM_API}/player/${encodeURIComponent(slug)}/${episode}`;
    const { data: playerData } = await axios.get(rawProxyUrl(api), {
      timeout: 15000,
      responseType: 'json',
    });
    if (playerData?.success && playerData?.data) {
      const d = playerData.data;
      const servers = d.servers || {};
      const flat = d.flatServers || d.flat || [];
      if (Object.keys(servers).length || (Array.isArray(flat) && flat.length)) {
        return { servers, flat, raw: d, source: 'player', slug, episode };
      }
    }
  } catch (e) {
    const status = e?.response?.status;
    if (status !== 404) console.warn('[getServers] /player fallback failed for', slug, episode, e?.message);
  }

  return { servers: {}, flat: [], raw: null, source: 'none', slug, episode };
}

export async function getStreamByLinkId(linkId, headers = {}) {
  if (!linkId) return { m3u8: '', embedUrl: '', m3u8Headers: {} };
  let embedUrl;
  try {
    const streamApi = `${STREAM_API}/stream/${encodeURIComponent(linkId)}`;
    const { data: sData } = await axios.get(rawProxyUrl(streamApi), {
      timeout: 15000,
      responseType: 'json',
    });
    // stream endpoint returns { data: { url, iframe, raw: { url } } }
    const d = sData?.data || {};
    embedUrl =
      d.url ||
      d.raw?.url ||
      d.iframe?.match(/src="([^"]+)"/)?.[1] ||
      '';
    if (!embedUrl) embedUrl = sData?.url || '';
  } catch (e) {
    console.warn('[getStreamByLinkId] /stream failed for', linkId?.slice(0, 20), e?.message);
    return { m3u8: '', embedUrl: '', m3u8Headers: {} };
  }

  if (!embedUrl) return { m3u8: '', embedUrl: '', m3u8Headers: {} };

  // If embedUrl is already a direct m3u8, use it directly
  if (isDirectM3u8(embedUrl)) {
    return { m3u8: proxyUrl(embedUrl), embedUrl, m3u8Headers: headers };
  }

  try {
    const m3u8Url = await extractM3u8FromEmbed(embedUrl, headers);
    if (m3u8Url) {
      return { m3u8: proxyUrl(m3u8Url), embedUrl, m3u8Headers: headers };
    }
  } catch (e) {
    console.error('[getStreamByLinkId] extractM3u8FromEmbed failed:', e);
  }
  return { m3u8: '', embedUrl, m3u8Headers: headers };
}

export async function resolveSlug(animeTitle) {
  const results = await searchStream(animeTitle);
  if (!results.length) return { slug: slugify(animeTitle), candidates: [], ranked: [] };
  const lower = animeTitle.toLowerCase().trim();
  const score = (t) => {
    const tl = t.toLowerCase().trim();
    if (tl === lower) return 0;
    if (tl.startsWith(lower)) return 1;
    if (tl.includes(lower)) return 2;
    return 3;
  };
  const ranked = [...results].sort((a, b) => score(a.title) - score(b.title));
  // prefer first 5 ranked as candidates
  return { slug: ranked[0]?.id || slugify(animeTitle), candidates: results, ranked: ranked.slice(0, 5) };
}

export async function getAnimeServers(animeTitle, episode) {
  // Resolve slug via search ranking, then probe servers for each candidate until we find one with servers
  let lastSlug = slugify(animeTitle);
  try {
    const { ranked, slug: bestSlug } = await resolveSlug(animeTitle);
    lastSlug = bestSlug;
    if (ranked.length) {
      for (const cand of ranked) {
        if (!cand.id) continue;
        const res = await getServers(cand.id, episode);
        if (res.flat?.length || Object.keys(res.servers || {}).length) {
          return { ...res, candidates: ranked, resolvedTitle: cand.title };
        }
      }
    }
  } catch (e) {
    console.warn('[getAnimeServers] resolve failed:', e?.message);
  }
  // fallback to best slug / direct slug
  const fallback = await getServers(lastSlug, episode);
  if (fallback.flat?.length || Object.keys(fallback.servers || {}).length) {
    return { ...fallback, candidates: [], resolvedTitle: animeTitle };
  }
  // last try: also try slugify if different
  const directSlug = slugify(animeTitle);
  if (directSlug !== lastSlug) {
    const direct = await getServers(directSlug, episode);
    return { ...direct, candidates: [], resolvedTitle: animeTitle };
  }
  return fallback;
}

// ============================
// AniList fallback (kept for direct numeric-ID links / old bookmarks)
// ============================
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

// eslint-disable-next-line no-unused-vars
const HENTAI_EXCLUDE = ['Hentai'];

// eslint-disable-next-line no-unused-vars
const PAGE_QUERY = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $type: MediaType, $genre_not_in: [String]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total lastPage hasNextPage currentPage }
    media(sort: $sort, type: $type, genre_not_in: $genre_not_in) {
      ${MEDIA_FIELDS}
    }
  }
}`;

// eslint-disable-next-line no-unused-vars
const SEARCH_QUERY = `
query ($page: Int, $perPage: Int, $search: String, $sort: [MediaSort], $type: MediaType, $genre_not_in: [String]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total lastPage hasNextPage currentPage }
    media(search: $search, sort: $sort, type: $type, genre_not_in: $genre_not_in) {
      ${MEDIA_FIELDS}
    }
  }
}`;

// eslint-disable-next-line no-unused-vars
const RECENT_QUERY = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $type: MediaType, $status: MediaStatus, $genre_not_in: [String]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total lastPage hasNextPage currentPage }
    media(sort: $sort, type: $type, status: $status, genre_not_in: $genre_not_in) {
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

// ============================
// STREAM LISTINGS – make anime list match the streaming API (AniKoto)
// ============================

/**
 * Convert a raw AniKoto stream-API item into an AniList-compatible shape
 * so existing UI components (AnimeCard, HeroCarousel, Watch, etc.) keep working
 * without a full rewrite, while guaranteeing the title is actually streamable.
 */
export function normalizeStreamAnime(raw) {
  if (!raw) return null;
  const scoreNum = raw.score != null && raw.score !== '' ? parseFloat(String(raw.score)) : null;
  const avgScore = scoreNum != null && !Number.isNaN(scoreNum) ? Math.round(scoreNum * 10) : null; // 7.55 -> 76
  // stream API uses { sub, dub, total } or plain number; prefer total
  const episodesTotal = raw.episodes?.total ?? raw.episodes?.sub ?? raw.episode ?? raw.episodes ?? null;
  const epCount = episodesTotal != null ? parseInt(String(episodesTotal), 10) : null;
  const genres = Array.isArray(raw.genres)
    ? raw.genres.map((g) => (typeof g === 'string' ? g : g?.name)).filter(Boolean)
    : [];
  const titleClean = (raw.title || '').replace(/&#\d+;/g, (m) => String.fromCharCode(parseInt(m.slice(2, -1), 10)));
  const jpClean = (raw.jpTitle || '').replace(/&#\d+;/g, (m) => String.fromCharCode(parseInt(m.slice(2, -1), 10)));
  return {
    id: raw.slug || String(raw.id),
    slug: raw.slug || String(raw.id),
    title: {
      english: titleClean || raw.title || 'Unknown',
      romaji: jpClean || titleClean || raw.title || 'Unknown',
      native: jpClean || titleClean || 'Unknown',
    },
    coverImage: { large: raw.poster, medium: raw.poster },
    bannerImage: raw.poster,
    format: raw.type || 'TV',
    status: raw.status || null,
    episodes: Number.isNaN(epCount) ? null : epCount,
    genres,
    genresRaw: raw.genres || [],
    averageScore: avgScore,
    score: raw.score,
    description: raw.synopsis || raw.description || '',
    poster: raw.poster,
    type: raw.type,
    jpTitle: jpClean || raw.jpTitle || '',
    episode: raw.episode || null,
    episodeUrl: raw.episodeUrl || null,
    _raw: raw,
  };
}

function toPageInfo(pagination, count, perPage, rawLength, page) {
  const currentPage = pagination?.currentPage || page;
  const totalPages = pagination?.totalPages || null;
  if (totalPages) {
    return {
      hasNextPage: currentPage < totalPages,
      currentPage,
      lastPage: totalPages,
      total: count ?? rawLength,
      perPage,
    };
  }
  // Fallback when API omits totalPages (e.g. /search?q=naruto, /latest-episode)
  // Infer from count + perPage when possible
  if (count != null && perPage) {
    const lastPage = Math.max(1, Math.ceil(count / perPage));
    return {
      hasNextPage: page < lastPage && rawLength >= perPage,
      currentPage: page,
      lastPage,
      total: count,
      perPage,
    };
  }
  // No pagination at all (latest-episode) – single page
  return {
    hasNextPage: false,
    currentPage: 1,
    lastPage: 1,
    total: count ?? rawLength,
    perPage,
  };
}

async function fetchStreamList(endpoint, page = 1, perPage = 20) {
  const sep = endpoint.includes('?') ? '&' : '?';
  const url = `${STREAM_API}${endpoint}${sep}page=${page}`;
  try {
    // Try direct fetch first (CORS-enabled worker), fallback to proxy for strict environments
    let data;
    try {
      const res = await axios.get(url, { timeout: 15000, responseType: 'json' });
      data = res.data;
    } catch {
      // Fallback via proxy
      const res = await axios.get(rawProxyUrl(url), { timeout: 15000, responseType: 'json' });
      data = res.data;
    }
    if (!data?.success || !data?.data) throw new Error('No stream list data');
    const payload = data.data;
    const rawList = Array.isArray(payload.data) ? payload.data : [];
    const count = payload.count ?? rawList.length;
    const pagination = payload.pagination || {};
    const mediaAll = rawList.map(normalizeStreamAnime).filter(Boolean);
    // Respect perPage for UI slicing while keeping server pagination truth
    const pageInfo = toPageInfo(pagination, count, perPage, rawList.length, page);
    // If server page size differs from requested perPage, slice to requested size
    // (server is typically 30, UI may want 12). For paginated endpoints we still
    // return what server gave; slicing keeps grid predictable.
    const media = perPage && mediaAll.length > perPage ? mediaAll.slice(0, perPage) : mediaAll;
    return { media, pageInfo };
  } catch (e) {
    console.warn(`[fetchStreamList] ${endpoint} failed:`, e?.message);
    return { media: [], pageInfo: { hasNextPage: false, currentPage: page, lastPage: page, total: 0, perPage } };
  }
}

async function fetchStreamSearch(keyword, page = 1, perPage = 20) {
  // AniKoto search is GET /search?q=...&page=... (backed by /filter?keyword=...)
  const url = `${STREAM_API}/search?q=${encodeURIComponent(keyword)}&page=${page}`;
  try {
    let data;
    try {
      const res = await axios.get(url, { timeout: 15000, responseType: 'json' });
      data = res.data;
    } catch {
      const res2 = await axios.get(rawProxyUrl(url), { timeout: 15000, responseType: 'json' });
      data = res2.data;
    }
    if (!data?.success || !data?.data) throw new Error('No search data');
    const payload = data.data;
    const rawList = Array.isArray(payload.data) ? payload.data : [];
    const count = payload.count ?? rawList.length;
    const pagination = payload.pagination || {};
    // Server may return totalPages null when result set < page size; infer client paging.
    // If pagination missing, do client-side slicing for consistent page param.
    if (!pagination?.totalPages && count > perPage) {
      const totalPages = Math.ceil(count / perPage);
      const start = (page - 1) * perPage;
      const slice = rawList.slice(start, start + perPage);
      return {
        media: slice.map(normalizeStreamAnime).filter(Boolean),
        pageInfo: {
          hasNextPage: page < totalPages,
          currentPage: page,
          lastPage: totalPages,
          total: count,
          perPage,
        },
      };
    }
    const mediaAll = rawList.map(normalizeStreamAnime).filter(Boolean);
    const pageInfo = toPageInfo(pagination, count, perPage, rawList.length, page);
    const media = perPage && mediaAll.length > perPage ? mediaAll.slice(0, perPage) : mediaAll;
    return { media, pageInfo };
  } catch (e) {
    console.warn('[fetchStreamSearch] failed:', e?.message);
    return { media: [], pageInfo: { hasNextPage: false, currentPage: page, lastPage: page, total: 0, perPage } };
  }
}

// Public listing adapters – names kept for compatibility with existing pages
export async function getPopularAnime(page = 1, perPage = 12) {
  // Popular -> /new-release (fresh releases, most relevant for streaming)
  return fetchStreamList('/new-release', page, perPage);
}

export async function getTrendingAnime(page = 1, perPage = 10) {
  // Trending -> /new-added (newly added titles trend)
  return fetchStreamList('/new-added', page, perPage);
}

export async function getRecentAnime(page = 1, perPage = 20) {
  // New Episodes -> /latest-episode (most recently updated episodes)
  // This endpoint is not really paginated (12 items, no pagination) – treat page>1 as empty
  if (page > 1) return { media: [], pageInfo: { hasNextPage: false, currentPage: page, lastPage: 1, total: 12, perPage } };
  return fetchStreamList('/latest-episode', page, perPage);
}

export async function getTopRatedAnime(page = 1, perPage = 12) {
  // Top Rated -> /just-completed (completed series tend to have stable scores)
  return fetchStreamList('/just-completed', page, perPage);
}

export async function searchAnime(keyword, page = 1, perPage = 20) {
  if (!keyword || !keyword.trim()) {
    return getPopularAnime(page, perPage);
  }
  return fetchStreamSearch(keyword.trim(), page, perPage);
}

// Genre / Type helpers (exposed for Search page)
export async function getGenreAnime(genreSlug, page = 1, perPage = 20) {
  if (!genreSlug) return getPopularAnime(page, perPage);
  return fetchStreamList(`/genre/${encodeURIComponent(genreSlug)}`, page, perPage);
}

export async function getTypeAnime(typeSlug, page = 1, perPage = 20) {
  if (!typeSlug) return getPopularAnime(page, perPage);
  return fetchStreamList(`/type/${encodeURIComponent(typeSlug)}`, page, perPage);
}

// Raw accessors for Home if it wants explicit sections
export async function getNewRelease(page = 1, perPage = 20) { return fetchStreamList('/new-release', page, perPage); }
export async function getNewAdded(page = 1, perPage = 20) { return fetchStreamList('/new-added', page, perPage); }
export async function getJustCompleted(page = 1, perPage = 20) { return fetchStreamList('/just-completed', page, perPage); }
export async function getLatestEpisode(page = 1, perPage = 20) { return fetchStreamList('/latest-episode', page, perPage); }
export async function getUpcomingAnime(page = 1, perPage = 20) { return fetchStreamList('/upcoming', page, perPage); }

export async function getStreamGenres() {
  try {
    const { data } = await axios.get(`${STREAM_API}/genres`, { timeout: 10000, responseType: 'json' });
    return data?.data?.genres || data?.data || [];
  } catch {
    try {
      const { data } = await axios.get(rawProxyUrl(`${STREAM_API}/genres`), { timeout: 10000, responseType: 'json' });
      return data?.data?.genres || data?.data || [];
    } catch { return []; }
  }
}

// Detail: accept either numeric AniList ID or AniKoto slug
export async function getAnimeById(id) {
  const str = String(id);
  const isNumeric = /^\d+$/.test(str);
  if (!isNumeric) {
    // Treat as slug – fetch from stream API and convert to AniList-like detail shape
    try {
      const details = await getStreamAnimeDetails(str);
      if (details) return details;
    } catch (_e) { void _e; }
    // Fallthrough to AniList attempt if stream fetch fails (rare)
  }
  // Numeric -> AniList
  try {
    const data = await post(DETAILS_QUERY, { id: parseInt(str, 10) });
    return data.Media;
  } catch (e) {
    // If numeric AniList fails but we have a slug-like fallback, try stream once more
    if (isNumeric) throw e;
    throw e;
  }
}

/**
 * Fetch full anime details from AniKoto stream API (slug-based) and map to
 * the shape expected by Watch.jsx (title, coverImage, description, genres, etc.).
 */
export async function getStreamAnimeDetails(slug) {
  if (!slug) return null;

  // Resolve the provider slug via search first, since the API requires
  // provider slugs like "one-piece-81553" rather than plain titles.
  let providerSlug = slug;
  try {
    const results = await searchStream(slug);
    if (results.length) {
      const lower = slug.toLowerCase().trim();
      const match = results.find((r) => (r.title || '').toLowerCase().includes(lower))
        || results.find((r) => (r.id || '').includes(lower))
        || results[0];
      if (match.id) providerSlug = match.id;
    }
  } catch { /* continue with original slug */ }

  const enc = encodeURIComponent(providerSlug);
  // Try /watch/:providerSlug first (richest data), then /anime/:slug
  const endpoints = [`/watch/${enc}`, `/anime/${enc}`];
  for (const ep of endpoints) {
    let data;
    try {
      const res = await axios.get(`${STREAM_API}${ep}`, { timeout: 15000, responseType: 'json' });
      data = res.data;
    } catch {
      try {
        const res2 = await axios.get(rawProxyUrl(`${STREAM_API}${ep}`), { timeout: 15000, responseType: 'json' });
        data = res2.data;
      } catch { continue; }
    }
    try {
      if (!data?.success) continue;
      // /anime returns { anime, episodes, related, info, poster } or { data: ...}
      // /watch returns { anime, episodes, related, servers ...}
      const payload = data.data || data;
      const animeRaw = payload.anime || payload.data?.anime || payload;
      // The worker sometimes nests under payload.data.anime
      const raw = animeRaw && animeRaw.title ? animeRaw : (payload.data || payload);
      // If still not found, try to use payload itself when it has title/slug
      const a = raw?.anime || raw;
      const title = a?.title || raw?.title || slug;
      const jpTitle = a?.jpTitle || raw?.jpTitle || '';
      const poster = a?.poster || raw?.poster || payload.poster || '';
      const synopsis = a?.synopsis || raw?.synopsis || payload.info?.synopsis || '';
      const genresRaw = a?.genres || raw?.genres || payload.info?.genres || [];
      const genres = Array.isArray(genresRaw) ? genresRaw.map((g) => (typeof g === 'string' ? g : g?.name)).filter(Boolean) : [];
      const episodesCount = a?.episodes ?? raw?.episodes ?? payload.episodeCount ?? payload.episodes?.length ?? null;
      const epNum = episodesCount != null ? parseInt(String(episodesCount), 10) : null;
      const score = a?.score ?? raw?.score ?? payload.info?.score ?? null;
      const scoreNum = score != null && score !== '' && score !== '?' ? parseFloat(String(score)) : null;
      const avgScore = scoreNum != null && !Number.isNaN(scoreNum) ? Math.round(scoreNum * 10) : null;
      const status = a?.status || raw?.status || payload.info?.status || null;
      const type = a?.type || raw?.type || payload.info?.type || 'TV';
      const aired = a?.aired || raw?.aired || '';
      // Build AniList-compatible detail object
      return {
        id: providerSlug,
        slug: providerSlug,
        title: { english: title, romaji: jpTitle || title, native: jpTitle || title },
        coverImage: { large: poster, medium: poster },
        bannerImage: poster,
        format: type && type !== '?' ? type : 'TV',
        status: status || 'FINISHED',
        episodes: Number.isNaN(epNum) ? null : epNum,
        genres,
        genresRaw,
        averageScore: avgScore,
        description: synopsis || '',
        synopsis,
        poster,
        jpTitle,
        score,
        aired,
        // Keep rich data for Watch to use directly
        _raw: a || raw,
        rawPayload: payload,
        // For EpisodeSelector we keep count
        episodeCount: Number.isNaN(epNum) ? (Array.isArray(payload.episodes) ? payload.episodes.length : 0) : epNum,
        episodesList: Array.isArray(payload.episodes) ? payload.episodes : [],
        relatedRaw: payload.related || [],
        // Minimal compatibility for characters/relations/studios so Watch doesn't crash
        relations: { edges: (payload.related || []).slice(0, 6).map((r) => ({
          relationType: 'RELATED',
          node: { id: r.slug || r.id, title: { english: r.title, romaji: r.jpTitle || r.title }, coverImage: { large: r.poster } }
        })) },
        characters: { nodes: [] },
        studios: { nodes: [] },
        season: null,
        seasonYear: null,
        startDate: null,
        nextAiringEpisode: null,
      };
    } catch (_e) { void _e; }
  }
  return null;
}

export function getDisplayTitle(media) {
  if (!media) return 'Unknown';
  // Stream-normalized shape: title is object
  if (media.title && typeof media.title === 'object') {
    return media.title.english || media.title.romaji || media.title.native || media.title || 'Unknown';
  }
  // Raw stream shape fallback (title as string)
  if (typeof media.title === 'string' && media.title) return media.title;
  if (media.jpTitle) return media.jpTitle;
  return 'Unknown';
}

export function getEpisodeCount(media) {
  if (!media) return 24;
  if (typeof media.episodes === 'number' && !Number.isNaN(media.episodes)) return media.episodes;
  if (media.episodes && typeof media.episodes === 'object') {
    return media.episodes.total || media.episodes.sub || 12;
  }
  if (media.episodeCount) return media.episodeCount;
  if (Array.isArray(media.episodesList) && media.episodesList.length) return media.episodesList.length;
  return 24;
}

export async function getStreamUrl(animeTitle, episode, headers = {}) {
  let lastError;

  // Search first – slugify('Attack on Titan') -> 'attack-on-titan' always 404 (needs suffix like -bgaoa)
  // so we rank exact matches first to avoid OVA/season mismatches
  try {
    const results = await searchStream(animeTitle);
    if (results.length) {
      const lower = animeTitle.toLowerCase().trim();
      const score = (t) => {
        const tl = t.toLowerCase().trim();
        if (tl === lower) return 0;
        if (tl.startsWith(lower)) return 1;
        if (tl.includes(lower)) return 2;
        return 3;
      };
      const ranked = [...results].sort((a, b) => score(a.title) - score(b.title));

      let candidateError;
      for (const cand of ranked.slice(0, 5)) {
        if (!cand.id) continue;
        try {
          const r = await getStream(cand.id, episode, headers);
          if (r?.m3u8 || r?.embedUrl) return r;
          candidateError = new Error(`No stream for ${cand.title} (${cand.id})`);
          lastError = candidateError;
        } catch (e) {
          candidateError = e;
          lastError = e;
        }
      }
      if (candidateError) throw candidateError;
      if (!lastError) throw new Error('No stream found among search results');
    }
  } catch (err) {
    lastError = err;
  }

  // Fallback to direct slugified title (for already-correct slugs like "one-piece-155")
  try {
    const direct = await getStream(slugify(animeTitle), episode, headers);
    if (direct?.m3u8 || direct?.embedUrl) return direct;
    if (!lastError) lastError = new Error(`No stream for slugified title ${slugify(animeTitle)}`);
  } catch (err) {
    lastError = err;
  }

  throw lastError || new Error('No stream API available');
}
