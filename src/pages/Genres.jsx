import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAnimeByGenre } from '../api/apiService';
import { getGenresList, getManhwaByGenre } from '../api/manhwaService';
import AnimeCard from '../components/AnimeCard';
import { ManhwaCard, ManhwaDetail } from '../components/Manhwa';
import LoadingSpinner from '../components/LoadingSpinner';
import { Clapperboard, BookOpen, Check, Tag, Search as SearchIcon } from 'lucide-react';

const PER_PAGE = 24;

// Names both sources accept. AniList's `genre_in` only knows canonical genres
// (Historical / School / Isekai are tags there and return 0), and the manhwa
// worker tags titles with MangaDex genre names — this is the intersection, so
// the same chip yields results in both tabs.
const SHARED_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mecha',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Thriller',
];

/* ---------- Genre index (/genres) ---------- */
function GenreIndex({ counts, onPick }) {
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Tag className="w-6 h-6 text-[var(--accent)]" />
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Browse by Genre</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-1.5">
          Anime and manga/manhwa, filtered by genre
        </p>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {SHARED_GENRES.map((g) => {
          const n = counts[g] ?? 0;
          return (
            <button
              key={g}
              onClick={() => onPick(g)}
              className="group px-5 py-2.5 rounded-full border border-[var(--border-subtle)] bg-white/[0.03] hover:bg-[var(--accent)]/10 hover:border-[var(--accent)]/30 transition-all duration-200 text-sm font-semibold text-[var(--text-secondary)] hover:text-white"
            >
              {g}
              {n > 0 && (
                <span className="ml-2 text-[11px] text-[var(--text-muted)] group-hover:text-[var(--accent)]">
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Single-genre results (/genres/:genre) ---------- */
function GenreResults({ genre }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('anime');

  // ---- Anime (AniList, real pagination) ----
  const [animeList, setAnimeList] = useState([]);
  const [animePage, setAnimePage] = useState(1);
  const [animeInfo, setAnimeInfo] = useState(null);
  const [animeLoading, setAnimeLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // ---- Manga & Manhwa (pooled worker listings) ----
  const [mangaItems, setMangaItems] = useState([]);
  const [mangaLoading, setMangaLoading] = useState(false);
  const [mangaDetailId, setMangaDetailId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setAnimeLoading(true);
        setAnimeList([]);
        setAnimeInfo(null);
        setAnimePage(1);
        const res = await getAnimeByGenre(genre, 1, PER_PAGE);
        if (cancelled) return;
        setAnimeList(res.media);
        setAnimeInfo(res.pageInfo);
      } catch {
        if (!cancelled) setAnimeList([]);
      } finally {
        if (!cancelled) setAnimeLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [genre]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setMangaLoading(true);
        setMangaItems([]);
        setMangaDetailId(null);
        const items = await getManhwaByGenre(genre);
        if (cancelled) return;
        setMangaItems(items);
      } catch {
        if (!cancelled) setMangaItems([]);
      } finally {
        if (!cancelled) setMangaLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [genre]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !animeInfo?.hasNextPage) return;
    setLoadingMore(true);
    const next = animePage + 1;
    try {
      const res = await getAnimeByGenre(genre, next, PER_PAGE);
      setAnimeList((prev) => [...prev, ...res.media]);
      setAnimeInfo(res.pageInfo);
      setAnimePage(next);
    } catch {
      // keep the list as-is
    } finally {
      setLoadingMore(false);
    }
  }, [animeInfo, animePage, genre, loadingMore]);

  useEffect(() => {
    if (tab !== 'anime' || mangaDetailId) return;
    const handleScroll = () => {
      if (loadingMore || !animeInfo?.hasNextPage) return;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 800) loadMore();
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [tab, mangaDetailId, loadingMore, animeInfo, loadMore]);

  if (mangaDetailId) {
    return (
      <ManhwaDetail
        key={mangaDetailId}
        id={mangaDetailId}
        onBack={() => setMangaDetailId(null)}
        onOpen={(id) => id && setMangaDetailId(id)}
        onReadChapter={(chapterId) => {
          if (chapterId) navigate(`/manhwa/read/${mangaDetailId}/${chapterId}`);
        }}
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 min-w-0">
          <Tag className="w-6 h-6 text-[var(--accent)] shrink-0" />
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight truncate">{genre}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          {[
            { key: 'anime', label: 'Anime', icon: Clapperboard },
            { key: 'manhwa', label: 'Manga & Manhwa', icon: BookOpen },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-full border transition-all duration-200 ${
                tab === t.key
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm shadow-[var(--accent)]/25'
                  : 'bg-white/[0.03] text-[var(--text-muted)] border-[var(--border-subtle)] hover:bg-[var(--accent)]/[0.08] hover:text-white hover:border-[var(--accent)]/[0.2]'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'anime' ? (
        animeLoading ? (
          <LoadingSpinner />
        ) : animeList.length === 0 ? (
          <EmptyState label={`No anime tagged "${genre}"`} />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {animeList.map((a) => (
                <AnimeCard key={a.id} anime={a} />
              ))}
            </div>
            {loadingMore && (
              <div className="py-10">
                <LoadingSpinner />
              </div>
            )}
            {!animeInfo?.hasNextPage && (
              <EndMarker total={animeInfo?.total ?? animeList.length} label="titles" />
            )}
          </>
        )
      ) : mangaLoading ? (
        <LoadingSpinner />
      ) : mangaItems.length === 0 ? (
        <EmptyState label={`No manga/manhwa tagged "${genre}"`} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {mangaItems.map((item) => (
              <ManhwaCard
                key={item.id}
                item={item}
                onOpen={(id) => id && setMangaDetailId(id)}
              />
            ))}
          </div>
          <EndMarker total={mangaItems.length} label="titles" />
        </>
      )}
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="text-center py-24">
      <SearchIcon className="w-20 h-20 mx-auto text-[var(--text-muted)]/30 mb-4" />
      <p className="text-xl font-bold text-[var(--text-secondary)] mb-2">{label}</p>
      <p className="text-sm text-[var(--text-muted)]">Try another genre</p>
    </div>
  );
}

function EndMarker({ total, label }) {
  return (
    <div className="py-10 text-center">
      <div className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[var(--text-muted)] bg-white/[0.03] rounded-full border border-white/[0.06]">
        <Check className="w-3.5 h-3.5" />
        {total > 0 ? `${total} ${label}` : 'Nothing here'}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function Genres() {
  const { genre } = useParams();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    getGenresList()
      .then((list) => {
        if (cancelled) return;
        const map = {};
        for (const g of list) map[g.name.toLowerCase()] = g.count;
        setCounts(map);
      })
      .catch(() => {
        // chips still render, just without counts
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (genre) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <GenreResults genre={genre} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <GenreIndex counts={counts} onPick={(g) => navigate(`/genres/${encodeURIComponent(g)}`)} />
      </div>
    </div>
  );
}
