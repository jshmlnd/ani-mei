import axios from 'axios';

const ANILIST_API = import.meta.env.VITE_ANILIST_API || 'https://graphql.anilist.co';
const ENV_STREAM_API_BASES = (import.meta.env.VITE_STREAM_API_BASE || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ANIMEPARADISE_ENTRY = 'animeparadise:https://api.animeparadise.moe';

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const STREAM_API_BASES = [
  ...ENV_STREAM_API_BASES,
  ...(ENV_STREAM_API_BASES.includes(ANIMEPARADISE_ENTRY) ? [] : [ANIMEPARADISE_ENTRY]),
];

const STREAM_ADAPTERS = {
  animekai: {
    async search(base, keyword) {
      const { data } = await axios.get(`${base}/api/search?keyword=${encodeURIComponent(keyword)}`, { timeout: 15000 });
      if (!data?.success || !data?.results?.length) return [];
      return data.results.map((r) => ({
        id: r.slug || '',
        title: r.title || '',
        type: 'sub',
      }));
    },
    async getStream(base, animeId, episode) {
      const { data: infoData } = await axios.get(`${base}/api/anime/${animeId}`, { timeout: 15000 });
      if (!infoData?.success || !infoData?.ani_id) throw new Error('Anime info not found');

      const { data: epData } = await axios.get(`${base}/api/episodes/${infoData.ani_id}`, { timeout: 15000 });
      if (!epData?.success || !epData?.episodes?.length) throw new Error('Episode list not found');
      const ep = epData.episodes.find((e) => String(e.number) === String(episode))
        || epData.episodes[Math.min(parseInt(episode) - 1, epData.episodes.length - 1)];
      if (!ep?.token) throw new Error('Episode not found');

      const { data: srvData } = await axios.get(`${base}/api/servers/${ep.token}`, { timeout: 15000 });
      if (!srvData?.success) throw new Error('Servers not found');
      const subServers = srvData.servers?.sub || srvData.servers?.softsub || [];
      if (!subServers.length) throw new Error('No servers available');
      const linkId = subServers[0].link_id;
      if (!linkId) throw new Error('No link ID');

      const { data: srcData } = await axios.get(`${base}/api/source/${linkId}`, { timeout: 20000 });
      if (!srcData?.success) throw new Error('Stream source not found');
      const source = srcData.sources?.find((s) => s.file?.includes('.m3u8')) || srcData.sources?.[0] || {};
      const m3u8 = source.file || '';
      if (!m3u8 || !m3u8.includes('.m3u8')) throw new Error('No valid m3u8 URL');

      return {
        m3u8,
        embedUrl: srcData.embed_url || '',
        m3u8Headers: {},
        skipIntro: srcData.skip?.intro || null,
        skipOutro: srcData.skip?.outro || null,
      };
    },
  },
  '123anime': {
    async search(base, keyword) {
      const directId = slugify(keyword);
      if (!directId) return [];
      return [{ id: directId, title: keyword, type: 'sub' }];
    },
    async getStream(base, animeId, episode) {
      const streamUrl = `${base}/episode-stream?id=${encodeURIComponent(animeId)}&ep=${episode}`;
      const { data } = await axios.get(streamUrl, { timeout: 20000 });
      if (!data?.success || !data?.data) throw new Error('Failed to get stream URL');
      const m3u8 = data.data.direct_m3u8 || '';
      const embedUrl = data.data.streaming_link || '';
      if (m3u8 && m3u8.includes('.m3u8')) {
        return {
          m3u8,
          embedUrl,
          m3u8Headers: data.data.m3u8_headers || {},
        };
      }
      if (embedUrl) {
        try {
          const extracted = await extractPlayerCdnM3u8(embedUrl);
          if (extracted?.m3u8) {
            return {
              m3u8: extracted.m3u8,
              embedUrl,
              m3u8Headers: { Referer: extracted.referer },
            };
          }
        } catch (err) {
          console.warn('PlayerCDN extraction failed, falling back to embed:', err.message);
        }
        return {
          m3u8: embedUrl,
          embedUrl,
          m3u8Headers: {},
        };
      }
      throw new Error('No valid m3u8 URL');
    },
  },
  hianime: {
    async search(base, keyword) {
      const { data } = await axios.get(`${base}/api/v1/search?keyword=${encodeURIComponent(keyword)}&page=1`, { timeout: 15000 });
      if (!data?.success || !data?.data?.animes?.length) return [];
      return data.data.animes.map((r) => ({
        id: r.id || '',
        title: r.title || r.alternativeTitle || '',
        type: 'sub',
      }));
    },
    async getStream(base, animeId, episode) {
      const epListUrl = `${base}/api/v1/episodes/${animeId}`;
      const { data: epData } = await axios.get(epListUrl, { timeout: 15000 });
      if (!epData?.success || !epData?.data?.episodes?.length) throw new Error('Episode list not found');
      const epId = epData.data.episodes.find((e) => e.episodeNumber === parseInt(episode))?.id
        || epData.data.episodes[Math.min(parseInt(episode) - 1, epData.data.episodes.length - 1)]?.id;
      if (!epId) throw new Error('Episode not found');
      const streamUrl = `${base}/api/v1/stream?id=${encodeURIComponent(epId)}&server=hd-1&type=sub`;
      const { data } = await axios.get(streamUrl, { timeout: 20000 });
      if (!data?.success || !data?.data) throw new Error('Failed to get stream URL');
      const m3u8 = data.data.link?.file || '';
      if (!m3u8 || !m3u8.includes('.m3u8')) throw new Error('No valid m3u8 URL');
      return {
        m3u8,
        embedUrl: m3u8,
        m3u8Headers: {},
      };
    },
  },
  anikoto: {
    async search(base, keyword) {
      const { data } = await axios.get(`${base}/api/search?q=${encodeURIComponent(keyword)}`, { timeout: 15000 });
      if (!data?.success || !data?.data?.length) return [];
      return data.data.map((r) => ({
        id: r.id || '',
        title: r.title || '',
        type: 'sub',
      }));
    },
    async getStream(base, animeId, episode) {
      const epListUrl = `${base}/api/episodes/${animeId}`;
      const { data: epData } = await axios.get(epListUrl, { timeout: 15000 });
      if (!epData?.success || !epData?.data?.episodes?.length) throw new Error('Episode list not found');
      const epId = epData.data.episodes.find((e) => e.number === parseInt(episode))?.id
        || epData.data.episodes[Math.min(parseInt(episode) - 1, epData.data.episodes.length - 1)]?.id;
      if (!epId) throw new Error('Episode not found');
      const streamUrl = `${base}/api/stream/${epId}?server=hd-1`;
      const { data } = await axios.get(streamUrl, { timeout: 20000 });
      if (!data?.success || !data?.data) throw new Error('Failed to get stream URL');
      const source = data.data.sources?.[0] || {};
      const m3u8 = source.file || '';
      if (!m3u8 || !m3u8.includes('.m3u8')) throw new Error('No valid m3u8 URL');
      return {
        m3u8,
        embedUrl: m3u8,
        m3u8Headers: {},
      };
    },
  },
  animeparadise: {
    async search(base, keyword) {
      const { data } = await axios.get(`${base}/search?q=${encodeURIComponent(keyword)}`, { timeout: 15000 });
      if (!data?.success || !data?.data?.length) return [];
      const lower = keyword.toLowerCase();
      const score = (title) => {
        const tl = (title || '').toLowerCase();
        if (tl === lower) return 0;
        if (tl.startsWith(lower)) return 1;
        if (tl.includes(lower)) return 2;
        return 3;
      };
      const best = [...data.data].sort((a, b) => score(a.title) - score(b.title))[0];
      if (!best?.link) return [];
      return [{ id: best.link, title: best.title || '', type: 'sub' }];
    },
    async getStream(base, animeId, episode) {
      const { data: info } = await axios.get(`${base}/anime/${animeId}`, { timeout: 15000 });
      if (!info?.success || !info?.data?._id) throw new Error('Anime info not found');
      const origin = info.data._id;

      const { data: eps } = await axios.get(`${base}/anime/${origin}/episode`, { timeout: 15000 });
      if (!eps?.success || !eps?.data?.length) throw new Error('Episode list not found');
      const ep = eps.data.find((e) => String(e.number) === String(episode))
        || eps.data[Math.min(parseInt(episode) - 1, eps.data.length - 1)];
      if (!ep?.uid) throw new Error('Episode not found');

      const proxyBase = typeof window !== 'undefined' ? window.location.origin : '';
      const { data } = await axios.get(
        `${proxyBase}/api/animeparadise?uid=${encodeURIComponent(ep.uid)}&origin=${encodeURIComponent(origin)}`,
        { timeout: 30000 },
      );
      if (!data?.success || !data?.m3u8) throw new Error('Failed to get stream');
      return {
        m3u8: data.m3u8,
        embedUrl: '',
        m3u8Headers: {},
      };
    },
  },
};

async function extractPlayerCdnM3u8(embedUrl) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    throw new Error('PlayerCDN extraction requires a browser');
  }
  let url;
  try {
    url = new URL(embedUrl);
  } catch {
    throw new Error('Invalid embed URL');
  }
  const outer = url.pathname.split('/').filter(Boolean).pop();
  if (!outer) throw new Error('No embed token');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const hsRes = await fetch(`${url.origin}/hs/${outer}`, { signal: controller.signal });
    if (!hsRes.ok) throw new Error(`Player page ${hsRes.status}`);
    const hsHtml = await hsRes.text();
    const dataId = hsHtml.match(/id="mg-player" data-id="([^"]+)"/)?.[1];
    if (!dataId) throw new Error('No data-id in player page');

    const srcRes = await fetch(`https://play2.echovideo.ru/getSources?id=${dataId}`, { signal: controller.signal });
    const raw = await srcRes.text();
    if (!raw || raw.trim() === '404') throw new Error('getSources rejected');

    let file = null;
    try {
      const json = JSON.parse(raw);
      const root = json?.data && Array.isArray(json.data.sources) ? json.data : json;
      const sources = root?.sources || [];
      file = sources.find((s) => typeof s.file === 'string' && s.file.includes('.m3u8'))?.file
        || sources[0]?.file || null;
    } catch {
      /* not JSON */
    }
    if (!file) {
      const m = raw.match(/"file"\s*:\s*"([^"]+\.m3u8[^"]*)"/)
        || raw.match(/(https?:\/\/[^"' ]+\.m3u8[^"' ]*)/);
      file = m ? m[1] : null;
    }
    if (!file || !file.includes('.m3u8')) throw new Error('No m3u8 in sources');
    return { m3u8: file, referer: url.origin + '/' };
  } finally {
    clearTimeout(timer);
  }
}

function parseStreamApiEntry(entry) {
  const match = entry.match(/^(animekai|123anime|hianime|anikoto|animeparadise):(.+)$/);
  if (match) return { type: match[1], base: match[2].trim().replace(/\/+$/, '') };
  return { type: '123anime', base: entry.trim().replace(/\/+$/, '') };
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

const HENTAI_QUERY = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $type: MediaType, $isAdult: Boolean) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total lastPage hasNextPage currentPage }
    media(sort: $sort, type: $type, isAdult: $isAdult) {
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

export async function getHentaiAnime(page = 1, perPage = 20) {
  const data = await post(HENTAI_QUERY, {
    page,
    perPage,
    sort: ['POPULARITY_DESC'],
    type: 'ANIME',
    isAdult: true,
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
  let embedFallback;

  for (const entry of STREAM_API_BASES) {
    const { type, base } = parseStreamApiEntry(entry);
    const adapter = STREAM_ADAPTERS[type];
    if (!adapter) {
      console.warn(`Unknown stream API type: ${type}`);
      continue;
    }
    try {
      const results = await adapter.search(base, animeTitle);
      if (!results.length) throw new Error('Anime not found');

      let firstEmbed;
      for (const candidate of results) {
        if (!candidate?.id) continue;
        let stream;
        try {
          stream = await adapter.getStream(base, candidate.id, episode);
        } catch {
          continue;
        }
        if (!stream?.m3u8) continue;

        const hasDirect = stream.m3u8.includes('.m3u8') || stream.m3u8.includes('/m3u8') || stream.m3u8.includes('.mp4');
        if (hasDirect) return stream;
        firstEmbed = firstEmbed || stream;
      }
      if (firstEmbed) {
        console.warn(`Stream API (${type}) returned embed-only results, deferring to fallback`);
        embedFallback = embedFallback || firstEmbed;
        continue;
      }
      throw new Error('No direct stream returned');
    } catch (err) {
      lastError = err;
      console.warn(`Stream API (${type}) failed for ${base}:`, err.message);
    }
  }

  if (embedFallback) return embedFallback;

  throw lastError || new Error('No stream API available');
}
