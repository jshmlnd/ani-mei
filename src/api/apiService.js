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

async function extractM3u8FromEmbed(embedUrl) {
  const { data: html } = await axios.get(rawProxyUrl(embedUrl), {
    timeout: 10000,
    responseType: 'text',
    transformResponse: [(d) => d],
  });
  const match = html.match(/"sourceUrl"\s*:\s*"([^"]+)"/);
  if (!match) return null;
  const sourceUrl = match[1].startsWith('http')
    ? match[1]
    : `${new URL(embedUrl).origin}${match[1]}`;
  const { data: sourceData } = await axios.get(rawProxyUrl(sourceUrl), {
    timeout: 10000,
    headers: { Accept: 'application/json' },
  });
  if (sourceData?.status === 'ok' && sourceData?.source) {
    return sourceData.source;
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

async function getStream(slug, episode) {
  // New API flow: GET /player/:slug/:episode -> { player: { url }, stream: { url } }
  // then extract m3u8 from embedUrl via proxy
  let embedUrl = '';
  try {
    const api = `${STREAM_API}/player/${encodeURIComponent(slug)}/${episode}`;
    const { data: playerData } = await axios.get(rawProxyUrl(api), {
      timeout: 20000,
      responseType: 'json',
    });
    if (playerData?.success && playerData?.data) {
      embedUrl =
        playerData.data.player?.url ||
        playerData.data.stream?.url ||
        playerData.data.url ||
        playerData.data.player?.iframe?.match(/src="([^"]+)"/)?.[1] ||
        '';
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

  try {
    const m3u8Url = await extractM3u8FromEmbed(embedUrl);
    if (m3u8Url) {
      return {
        m3u8: proxyUrl(m3u8Url),
        embedUrl,
        m3u8Headers: {},
      };
    }
  } catch (e) {
    console.error('[stream] extractM3u8FromEmbed failed:', e);
  }

  return { m3u8: '', embedUrl, m3u8Headers: {} };
}

export async function getServers(slug, episode) {
  // Try /servers/:slug/:episode first — returns { servers: {sub, dub, raw, hsub...}, flat }
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

export async function getStreamByLinkId(linkId) {
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

  try {
    const m3u8Url = await extractM3u8FromEmbed(embedUrl);
    if (m3u8Url) {
      return { m3u8: proxyUrl(m3u8Url), embedUrl, m3u8Headers: {} };
    }
  } catch (e) {
    console.error('[getStreamByLinkId] extractM3u8FromEmbed failed:', e);
  }
  return { m3u8: '', embedUrl, m3u8Headers: {} };
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

const HENTAI_EXCLUDE = ['Hentai'];

const PAGE_QUERY = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $type: MediaType, $genre_not_in: [String]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total lastPage hasNextPage currentPage }
    media(sort: $sort, type: $type, genre_not_in: $genre_not_in) {
      ${MEDIA_FIELDS}
    }
  }
}`;

const SEARCH_QUERY = `
query ($page: Int, $perPage: Int, $search: String, $sort: [MediaSort], $type: MediaType, $genre_not_in: [String]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total lastPage hasNextPage currentPage }
    media(search: $search, sort: $sort, type: $type, genre_not_in: $genre_not_in) {
      ${MEDIA_FIELDS}
    }
  }
}`;

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

export async function getPopularAnime(page = 1, perPage = 12) {
  const data = await post(PAGE_QUERY, {
    page,
    perPage,
    sort: ['POPULARITY_DESC'],
    type: 'ANIME',
    genre_not_in: HENTAI_EXCLUDE,
  });
  return { media: data.Page.media, pageInfo: data.Page.pageInfo };
}

export async function getTrendingAnime(page = 1, perPage = 10) {
  const data = await post(PAGE_QUERY, {
    page,
    perPage,
    sort: ['TRENDING_DESC', 'POPULARITY_DESC'],
    type: 'ANIME',
    genre_not_in: HENTAI_EXCLUDE,
  });
  return { media: data.Page.media, pageInfo: data.Page.pageInfo };
}

export async function getRecentAnime(page = 1, perPage = 20) {
  const data = await post(RECENT_QUERY, {
    page,
    perPage,
    sort: ['UPDATED_AT_DESC'],
    type: 'ANIME',
    status: 'RELEASING',
    genre_not_in: HENTAI_EXCLUDE,
  });
  return { media: data.Page.media, pageInfo: data.Page.pageInfo };
}

export async function getTopRatedAnime(page = 1, perPage = 12) {
  const data = await post(PAGE_QUERY, {
    page,
    perPage,
    sort: ['SCORE_DESC'],
    type: 'ANIME',
    genre_not_in: HENTAI_EXCLUDE,
  });
  return { media: data.Page.media, pageInfo: data.Page.pageInfo };
}

export async function searchAnime(keyword, page = 1, perPage = 20) {
  const data = await post(SEARCH_QUERY, {
    page,
    perPage,
    search: keyword,
    sort: ['SEARCH_MATCH'],
    type: 'ANIME',
    genre_not_in: HENTAI_EXCLUDE,
  });
  return { media: data.Page.media, pageInfo: data.Page.pageInfo };
}

export async function getAnimeById(id) {
  const data = await post(DETAILS_QUERY, { id: parseInt(id) });
  return data.Media;
}

export function getDisplayTitle(media) {
  if (!media?.title) return 'Unknown';
  return media.title.english || media.title.romaji || media.title.native || 'Unknown';
}

export function getEpisodeCount(media) {
  return media?.episodes || 24;
}

export async function getStreamUrl(animeTitle, episode) {
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
          const r = await getStream(cand.id, episode);
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
    const direct = await getStream(slugify(animeTitle), episode);
    if (direct?.m3u8 || direct?.embedUrl) return direct;
    if (!lastError) lastError = new Error(`No stream for slugified title ${slugify(animeTitle)}`);
  } catch (err) {
    lastError = err;
  }

  throw lastError || new Error('No stream API available');
}
