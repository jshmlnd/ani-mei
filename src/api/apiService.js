import axios from 'axios';

const ANILIST_API = import.meta.env.VITE_ANILIST_API || 'https://graphql.anilist.co';
const STREAM_API_BASES = (import.meta.env.VITE_STREAM_API_BASE || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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

  for (const base of STREAM_API_BASES) {
    try {
      const searchUrl = `${base}/search?keyword=${encodeURIComponent(animeTitle)}`;
      const { data: results } = await axios.get(searchUrl, { timeout: 15000 });
      if (!results?.length) {
        throw new Error('Anime not found on streaming source');
      }

      const lower = animeTitle.toLowerCase();
      const best = results.find(
        (r) => r.type === 'sub' && r.title.toLowerCase().includes(lower)
      ) || results.find((r) => r.type === 'sub') || results[0];

      const slug = best.japanese_title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const streamUrl = `${base}/episode-stream?id=${encodeURIComponent(slug)}&ep=${episode}`;
      const { data } = await axios.get(streamUrl, { timeout: 20000 });

      if (!data?.success || !data?.data) {
        throw new Error('Failed to get stream URL');
      }

      return {
        embedUrl: data.data.streaming_link || '',
        m3u8: data.data.direct_m3u8 || '',
        m3u8Headers: data.data.m3u8_headers || {},
      };
    } catch (err) {
      lastError = err;
      console.warn(`Stream API failed for ${base}:`, err.message);
    }
  }

  throw lastError || new Error('No stream API available');
}
