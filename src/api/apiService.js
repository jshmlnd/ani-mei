import axios from 'axios';

const ANILIST_API = import.meta.env.VITE_ANILIST_API || 'https://graphql.anilist.co';
const STREAM_API = 'https://animeiapi.joshuaklein-malonda.workers.dev';

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

async function searchStream(keyword) {
  const { data } = await axios.get(
    `${STREAM_API}/api/v1/search?q=${encodeURIComponent(keyword)}`,
    { timeout: 15000 }
  );
  if (!data?.success || !data?.data?.length) return [];
  return data.data.map((r) => ({
    id: r.slug || '',
    title: r.title?.replace(/&#\d+;/g, (m) => String.fromCharCode(parseInt(m.slice(2, -1)))) || '',
    type: r.type || 'sub',
  }));
}

async function getStream(slug, episode) {
  const { data: streamData } = await axios.get(
    `${STREAM_API}/api/v1/episode-stream?slug=${encodeURIComponent(slug)}&ep=${episode}`,
    { timeout: 20000 }
  );
  if (!streamData?.success || !streamData?.data) throw new Error('Failed to get stream');

  const embedUrl = streamData.data.streaming_link || '';

  if (embedUrl) {
    try {
      const m3u8Url = await extractM3u8FromEmbed(embedUrl);
      if (m3u8Url) {
        return {
          m3u8: proxyUrl(m3u8Url),
          embedUrl,
          m3u8Headers: {},
        };
      }
    } catch {}
  }

  return { m3u8: '', embedUrl, m3u8Headers: {} };
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

  try {
    return await getStream(slugify(animeTitle), episode);
  } catch (err) {
    lastError = err;
  }

  try {
    const results = await searchStream(animeTitle);
    if (!results.length) throw new Error('Anime not found on streaming source');
    const lower = animeTitle.toLowerCase();
    const best = results.find((r) => r.title.toLowerCase().includes(lower)) || results[0];
    if (!best.id) throw new Error('No valid anime ID');
    return await getStream(best.id, episode);
  } catch (err) {
    lastError = err;
  }

  throw lastError || new Error('No stream API available');
}
