import { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function HorizontalRow({ children }) {
  const scrollRef = useRef(null);
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });
  const anim = useRef({ target: null, raf: null });

  // Animated glide to an absolute scroll position (cancels any in-flight glide)
  const animateTo = (target, duration = 500) => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    target = Math.min(Math.max(target, 0), Math.max(max, 0));
    if (anim.current.raf) cancelAnimationFrame(anim.current.raf);
    anim.current.target = target;
    const start = el.scrollLeft;
    const dist = target - start;
    if (Math.abs(dist) < 1) {
      anim.current.target = null;
      anim.current.raf = null;
      return;
    }
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      el.scrollLeft = start + dist * eased;
      if (t < 1) {
        anim.current.raf = requestAnimationFrame(tick);
      } else {
        anim.current.raf = null;
        anim.current.target = null;
      }
    };
    anim.current.raf = requestAnimationFrame(tick);
  };

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const base = anim.current.target ?? el.scrollLeft;
    animateTo(base + dir * 400, 500);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    const smoothTo = (target) => {
      animateTo(target, 180);
    };

    // Vertical wheel -> smooth horizontal glide (lets the page scroll at the ends)
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      if ((e.deltaY > 0 && el.scrollLeft >= max - 1) || (e.deltaY < 0 && el.scrollLeft <= 0))
        return;
      e.preventDefault();
      const base = anim.current.target ?? el.scrollLeft;
      const next = clamp(base + e.deltaY, 0, max);
      smoothTo(next);
    };

    // Mouse drag to scroll
    const onDown = (e) => {
      if (anim.current.raf) cancelAnimationFrame(anim.current.raf);
      anim.current.target = null;
      drag.current = { down: true, startX: e.pageX, startLeft: el.scrollLeft, moved: false };
    };
    const onMove = (e) => {
      if (!drag.current.down) return;
      const dx = e.pageX - drag.current.startX;
      if (Math.abs(dx) > 5) drag.current.moved = true;
      if (drag.current.moved) el.scrollLeft = drag.current.startLeft - dx;
    };
    const onUp = () => {
      drag.current.down = false;
    };
    // Suppress card clicks after a drag
    const onClickCapture = (e) => {
      if (drag.current.moved) {
        e.preventDefault();
        e.stopPropagation();
        drag.current.moved = false;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('click', onClickCapture, true);
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- anim is a plain object ref, not a React node
      if (anim.current.raf) cancelAnimationFrame(anim.current.raf);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  return (
    <div className="relative group/scroll">
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide cursor-grab active:cursor-grabbing select-none">
        {children}
      </div>
      <button
        type="button"
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 hover:bg-black/90 hover:scale-110"
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 hover:bg-black/90 hover:scale-110"
        onClick={() => scroll(1)}
        aria-label="Scroll right"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}