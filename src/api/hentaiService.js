import axios from 'axios';

const HENTAI_API = 'https://hentaiapi.joshuaklein-malonda.workers.dev';

export const hentaiApiBase = HENTAI_API;

const TIMEOUT = 15000;

async function get(path, params = {}) {
  const { data } = await axios.get(`${HENTAI_API}${path}`, {
    params,
    timeout: TIMEOUT,
    responseType: 'json',
  });
  return data;
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

// Grid card shape: { title, titleJapanese, slug, link, image, episodes, type }
export function normalizeHentai(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const slug = raw.slug ?? null;
  const title = raw.title ?? 'Unknown Title';
  // Fall back to a slug derived from the link so cards stay clickable
  const linkSlug = !slug && typeof raw.link === 'string'
    ? raw.link.split('?')[0].split('#')[0].replace(/\/+$/, '').split('/').pop()
    : null;
  const id = slug ?? linkSlug ?? title;
  if (!id) return null;
  return {
    id: String(id),
    slug: slug ? String(slug) : linkSlug ? String(linkSlug) : null,
    title: String(title),
    titleJapanese: raw.titleJapanese ?? '',
    image: raw.image ?? raw.poster ?? raw.thumbnail ?? '',
    episodes: raw.episodes ?? '',
    type: raw.type ?? raw.category ?? '',
    link: raw.link ?? '',
    description: raw.description ?? raw.synopsis ?? '',
    _raw: raw,
  };
}

// Spotlight/hero shape: { title, titleJapanese, description, image, detailLink, watchLink, meta }
export function normalizeSpotlight(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const base = normalizeHentai(raw);
  if (!base) return null;
  const slugFrom = (url) =>
    typeof url === 'string' && url
      ? url.split('?')[0].split('#')[0].replace(/\/+$/, '').split('/').pop()
      : null;
  return {
    ...base,
    description: raw.description ?? '',
    // Prefer the detail slug; fall back to watch/episode links
    slug:
      base.slug ??
      slugFrom(raw.detailLink) ??
      slugFrom(raw.watchLink) ??
      base.id,
    meta: raw.meta ?? '',
    detailLink: raw.detailLink ?? '',
    watchLink: raw.watchLink ?? '',
  };
}

export async function getHentaiLatest(page = 1, limit = 24) {
  const data = await get('/latest', { page, limit });
  return pickList(data).map(normalizeHentai).filter(Boolean);
}

export async function getHentaiPopular(page = 1, limit = 12) {
  const data = await get('/popular', { page, limit });
  return pickList(data).map(normalizeHentai).filter(Boolean);
}

export async function getHentaiSpotlight(limit = 5) {
  const data = await get('/spotlight');
  return pickList(data).map(normalizeSpotlight).filter(Boolean).slice(0, limit);
}

export async function searchHentai(query, page = 1, limit = 24) {
  if (!query || !query.trim()) return [];
  const data = await get('/search', { q: query.trim(), page, limit });
  return pickList(data).map(normalizeHentai).filter(Boolean);
}

export async function getHentaiGenres() {
  const data = await get('/genres');
  const list = pickList(data);
  return list
    .map((g) =>
      typeof g === 'string'
        ? { name: g, slug: g.toLowerCase().replace(/[^a-z0-9]+/g, '-') }
        : { name: g?.name ?? g?.title ?? '', slug: g?.slug ?? '' }
    )
    .filter((g) => g.name && g.slug);
}

export async function getHentaiByGenre(slug, page = 1, limit = 24) {
  if (!slug) return [];
  const data = await get('/genre', { slug, page, limit });
  return pickList(data).map(normalizeHentai).filter(Boolean);
}

export async function getHentaiDetail(slug) {
  if (!slug) throw new Error('Missing slug');
  const data = await get('/anime-detail', { slug });
  const d = data?.data ?? data;
  if (!d || typeof d !== 'object' || !d.title) throw new Error('Title not found');
  return {
    title: d.title ?? 'Unknown Title',
    titleJapanese: d.titleJapanese ?? '',
    synopsis: d.synopsis ?? d.description ?? '',
    image: d.image ?? d.poster ?? '',
    category: d.category ?? d.type ?? '',
    status: d.status ?? '',
    aired: d.aired ?? '',
    genres: Array.isArray(d.genres)
      ? d.genres.map((g) => (typeof g === 'string' ? g : g?.name)).filter(Boolean)
      : [],
    watchLink: d.watchLink ?? '',
    slug: String(slug),
  };
}

export async function getHentaiEpisodes(slug) {
  if (!slug) return [];
  const data = await get('/watch-list', { slug });
  return pickList(data)
    .map((ep, i) => {
      if (!ep || typeof ep !== 'object') return null;
      return {
        id: ep.videoId ?? ep.id ?? `${slug}-ep-${i + 1}`,
        n: i + 1,
        title: ep.title ?? `Episode ${i + 1}`,
        link: ep.link ?? ep.watchUrl ?? '',
        thumbnail: ep.thumbnail ?? '',
        added: ep.added ?? '',
        _raw: ep,
      };
    })
    .filter(Boolean);
}

// Resolve playable embeds for a title. Returns { episodes: [{ title, iframe, player, streamUrl, ... }] }
export async function getHentaiWatch(slug, limit = 5) {
  if (!slug) throw new Error('Missing slug');
  const data = await get('/watch', { slug, limit });
  const payload = data?.data ?? data;
  const episodes = pickList(payload?.episodes ?? payload).map((ep, i) => {
    if (!ep || typeof ep !== 'object') return null;
    const player = ep.player ?? {};
    return {
      id: ep.videoId ?? ep.id ?? `${slug}-ep-${i + 1}`,
      n: i + 1,
      title: ep.title ?? `Episode ${i + 1}`,
      iframe: ep.iframe ?? '',
      playerMain: player.main ?? '',
      playerBackup: player.backup ?? '',
      streamUrl: ep.streamUrl ?? '',
      thumbnail: ep.thumbnail ?? '',
      servers: Array.isArray(ep.servers) ? ep.servers : [],
      downloads: Array.isArray(ep.downloads) ? ep.downloads : [],
      _raw: ep,
    };
  }).filter(Boolean);
  return {
    slug: payload?.slug ?? String(slug),
    title: payload?.title ?? '',
    episodes,
  };
}

// Backwards-compatible stub used by older imports
export const fetchHentai = async (query) => {
  if (query) return searchHentai(query);
  return getHentaiLatest();
};
