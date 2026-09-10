import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getTitleForId,
  getChaptersForTitle,
  getPagesForChapter,
  chapterLabel,
} from '../api/manhwaService';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ImageIcon,
} from 'lucide-react';

const QUALITY_KEY = 'animei-reader-quality';
const MAX_CHAPTER_PAGES = 8; // 8 x 100 chapters cap for prev/next navigation

/* ---------- Page image: single timed retry, then placeholder ----------
   Page URLs already come proxied (/pages and /wt/pages are always called
   with proxy=1, rewritten to same-domain /image). At-home nodes flap, so
   on error we wait ~1s and reload the same URL once before giving up.
   Remounts (key change) reset the cycle. */
function ReaderPage({ src, alt, eager }) {
  const [nonce, setNonce] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const retryAll = () => {
    clearTimeout(timerRef.current);
    setFailed(false);
    setWaiting(false);
    setNonce((n) => n + 1);
  };

  if (failed) {
    return (
      <div className="w-full aspect-[3/4] bg-[var(--bg-elevated)] flex items-center justify-center">
        <div className="text-center px-6 max-w-xs">
          <ImageIcon className="w-8 h-8 mx-auto text-[var(--text-muted)] mb-2" />
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Page failed to load — the image host may be blocking this network.
          </p>
          <button
            onClick={retryAll}
            className="mt-3 px-4 py-1.5 text-xs font-bold rounded-full border border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
          >
            Retry page
          </button>
        </div>
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="w-full aspect-[3/4] bg-[var(--bg-elevated)] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)]/20 border-t-[var(--accent)] animate-spin" />
      </div>
    );
  }

  return (
    <img
      key={nonce}
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      referrerPolicy="no-referrer"
      onError={() => {
        if (nonce >= 1) {
          setFailed(true);
          return;
        }
        setWaiting(true);
        timerRef.current = setTimeout(() => {
          setWaiting(false);
          setNonce((n) => n + 1);
        }, 1000);
      }}
      className="w-full h-auto block bg-[var(--bg-elevated)]"
    />
  );
}

export default function ManhwaRead() {
  const { hid, chapterId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [chaptersAsc, setChaptersAsc] = useState([]);
  const [total, setTotal] = useState(null);
  const [quality, setQuality] = useState(() => {
    try {
      return localStorage.getItem(QUALITY_KEY) === 'high' ? 'high' : 'dataSaver';
    } catch {
      return 'dataSaver';
    }
  });
  const [pages, setPages] = useState([]);
  const [pagesInfo, setPagesInfo] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingPages, setLoadingPages] = useState(true);
  const [error, setError] = useState(null);

  // Title + full chapter list (for prev/next + position counter)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoadingMeta(true);
        setError(null);
        const [detail, first] = await Promise.all([
          getTitleForId(hid).catch(() => null),
          getChaptersForTitle(hid, { page: 1, limit: 100, order: 'asc' }),
        ]);
        if (cancelled) return;
        if (detail) setTitle(detail.title || '');
        let all = [...first.chapters];
        let pageInfo = first.pageInfo;
        let page = 1;
        while (pageInfo?.hasNext && page < MAX_CHAPTER_PAGES) {
          page += 1;
          try {
            const res = await getChaptersForTitle(hid, { page, limit: 100, order: 'asc' });
            if (cancelled) return;
            all = [...all, ...res.chapters];
            pageInfo = res.pageInfo;
          } catch {
            break;
          }
        }
        if (cancelled) return;
        setChaptersAsc(all);
        setTotal(pageInfo?.total ?? all.length);
      } catch {
        if (!cancelled) setError('Failed to load this title.');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    };
    if (hid) load();
    return () => {
      cancelled = true;
    };
  }, [hid]);

  // Pages for the current chapter + quality
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!chapterId) {
        setError('Chapter not found.');
        setLoadingPages(false);
        return;
      }
      try {
        setLoadingPages(true);
        setError(null);
        setPages([]);
        setPagesInfo(null);
        const res = await getPagesForChapter(chapterId, quality);
        if (!cancelled) {
          setPages(res.pages || []);
          setPagesInfo({
            readable: res.readable !== false,
            via: res.via ?? null,
            externalUrl: res.externalUrl || '',
            message: res.message || '',
          });
        }
      } catch {
        if (!cancelled) setError('Could not load chapter pages. Try the other quality.');
      } finally {
        if (!cancelled) setLoadingPages(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [chapterId, quality]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [chapterId]);

  const changeQuality = (q) => {
    setQuality(q);
    try {
      localStorage.setItem(QUALITY_KEY, q);
    } catch {
      // private mode — preference lasts for the session
    }
  };

  const idx = chaptersAsc.findIndex((c) => c.id === chapterId);
  const chapter = idx >= 0 ? chaptersAsc[idx] : null;
  const goOlder = () => {
    if (idx > 0) navigate(`/manhwa/read/${hid}/${chaptersAsc[idx - 1].id}`);
  };
  const goNewer = () => {
    if (idx >= 0 && idx < chaptersAsc.length - 1) {
      navigate(`/manhwa/read/${hid}/${chaptersAsc[idx + 1].id}`);
    }
  };

  if (!hid || !chapterId) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] pt-20 flex flex-col items-center justify-center py-32 gap-4 px-6 text-center">
        <AlertCircle className="w-16 h-16 text-[var(--text-muted)]" />
        <p className="text-lg text-[var(--text-secondary)]">Invalid chapter link.</p>
        <button
          onClick={() => navigate('/manhwa')}
          className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-bold text-sm rounded-full transition-all"
        >
          Back to Manhwa
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] pt-20 animate-fade-in">
      {/* Reader top bar */}
      <div className="sticky top-20 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(hid ? `/manhwa?title=${encodeURIComponent(hid)}` : '/manhwa')}
            aria-label="Back to Manhwa"
            className="p-2 rounded-full hover:bg-white/[0.06] text-[var(--text-secondary)] hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate badge badge-soft rounded-full glass">{loadingMeta ? 'Loading...' : title || 'Manhwa'}</div>
            <p className="text-[11px] text-[#a188ad]">
              {chapter ? chapterLabel(chapter) : 'Chapter'}
              {(total ?? chaptersAsc.length) > 0 && ` · ${idx >= 0 ? idx + 1 : '–'} / ${total ?? chaptersAsc.length}`}
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-full glass border border-[var(--border-subtle)] shrink-0">
            {[
              { v: 'dataSaver', label: 'Saver' },
              { v: 'high', label: 'HD' },
            ].map((q) => (
              <button
                key={q.v}
                onClick={() => changeQuality(q.v)}
                className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${
                  quality === q.v
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[#a188ad] hover:text-white'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pages */}
      <div className="max-w-3xl mx-auto px-0 sm:px-6 py-0 sm:py-4">
        {loadingPages ? (
          <LoadingSpinner />
        ) : error || (!pages.length && pagesInfo?.readable !== false) ? (
          <div className="text-center py-24 px-6">
            <AlertCircle className="w-16 h-16 mx-auto text-[var(--text-muted)]/50 mb-4" />
            <p className="text-base text-[var(--text-secondary)] mb-2">{error || 'No pages found.'}</p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => changeQuality(quality === 'high' ? 'dataSaver' : 'high')}
                className="px-5 py-2 text-xs font-bold rounded-full border border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
              >
                Try {quality === 'high' ? 'Data Saver' : 'HD'} quality
              </button>
            </div>
          </div>
        ) : pagesInfo?.readable === false ? (
          <div className="text-center py-24 px-6">
            <AlertCircle className="w-16 h-16 mx-auto text-[var(--text-muted)]/50 mb-4" />
            <p className="text-base text-[var(--text-secondary)] mb-2">
              {pagesInfo.message || 'This chapter is only available from an external source.'}
            </p>
            {pagesInfo.externalUrl ? (
              <a
                href={pagesInfo.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-4 px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-bold text-sm rounded-full transition-all"
              >
                Read officially
              </a>
            ) : (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => changeQuality(quality === 'high' ? 'dataSaver' : 'high')}
                  className="px-5 py-2 text-xs font-bold rounded-full border border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
                >
                  Try {quality === 'high' ? 'Data Saver' : 'HD'} quality
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {pages.map((src, i) => (
              <ReaderPage
                key={`${chapterId}-${i}-${src}`}
                src={src}
                alt={`Page ${i + 1}`}
                eager={i < 2}
              />
            ))}
          </div>
        )}
      </div>

      {/* Chapter nav */}
      {!loadingPages && idx >= 0 && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-12 pt-4">
          <div className="glass-panel rounded-2xl p-4 flex items-center justify-between gap-3">
            <button
              onClick={goOlder}
              disabled={idx <= 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white hover:border-[var(--accent)]/30 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Older
            </button>
            <span className="text-xs text-[var(--text-muted)] font-semibold">
              {chapter ? chapterLabel(chapter) : ''}
            </span>
            <button
              onClick={goNewer}
              disabled={idx >= chaptersAsc.length - 1}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              Newer
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
