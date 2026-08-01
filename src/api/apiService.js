import axios from 'axios';

const ANILIST_API = import.meta.env.VITE_ANILIST_API || 'https://graphql.anilist.co';
const STREAM_API_BASES = (import.meta.env.VITE_STREAM_API_BASE || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const PROXY_BASE = '/api/proxy';

function proxyUrl(targetUrl) {
  return `${PROXY_BASE}?url=${encodeURIComponent(targetUrl)}`;
}

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
        m3u8: proxyUrl(m3u8),
        embedUrl: srcData.embed_url || '',
        m3u8Headers: {},
        skipIntro: srcData.skip?.intro || null,
        skipOutro: srcData.skip?.outro || null,
      };
    },
  },
  '123anime': {
    async search(base, keyword) {
      const { data: results } = await axios.get(`${base}/search?keyword=${encodeURIComponent(keyword)}`, { timeout: 15000 });
      if (!results?.length) return [];
      return results.map((r) => ({
        id: r.japanese_title
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || '',
        title: r.title || '',
        type: r.type || 'sub',
      }));
    },
    async getStream(base, animeId, episode) {
      const streamUrl = `${base}/episode-stream?id=${encodeURIComponent(animeId)}&ep=${episode}`;
      const { data } = await axios.get(streamUrl, { timeout: 20000 });
      if (!data?.success || !data?.data) throw new Error('Failed to get stream URL');
      const m3u8 = data.data.direct_m3u8 || '';
      if (!m3u8 || !m3u8.includes('.m3u8')) throw new Error('No valid m3u8 URL');
      return {
        m3u8: proxyUrl(m3u8),
        embedUrl: data.data.streaming_link || '',
        m3u8Headers: data.data.m3u8_headers || {},
      };
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
        m3u8: proxyUrl(m3u8),
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
        m3u8: proxyUrl(m3u8),
        embedUrl: m3u8,
        m3u8Headers: {},
      };
    },
  },
};

function parseStreamApiEntry(entry) {
  const match = entry.match(/^(animekai|123anime|hianime|anikoto):(.+)$/);
  if (match) return { type: match[1], base: match[2].trim() };
  return { type: '123anime', base: entry };
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

      const lower = animeTitle.toLowerCase();
      const best = results.find((r) => r.title.toLowerCase().includes(lower)) || results[0];

      if (!best.id) throw new Error('No valid anime ID');

      return await adapter.getStream(base, best.id, episode);
    } catch (err) {
      lastError = err;
      console.warn(`Stream API (${type}) failed for ${base}:`, err.message);
    }
  }

  throw lastError || new Error('No stream API available');
}
