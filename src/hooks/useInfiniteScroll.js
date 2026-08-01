import { useEffect, useRef, useCallback, useState } from 'react';

export function useInfiniteScroll(callback, options = {}) {
  const { threshold = 200, enabled = true } = options;
  const observerRef = useRef(null);

  const setSentinel = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node || !enabled) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          callback();
        }
      },
      { rootMargin: `${threshold}px` }
    );
    observerRef.current.observe(node);
  }, [callback, threshold, enabled]);

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  return { sentinelRef: null, setSentinel };
}

export function useIntersectionObserver() {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting) {
          setHasIntersected(true);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, isIntersecting, hasIntersected };
}
