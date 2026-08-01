import { useEffect, useRef, useState } from 'react';

export function useIntersectionObserver(opts = {}) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const optsRef = useRef(opts);

  useEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const { threshold = 0.1, rootMargin } = optsRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(el);
      }
    }, { threshold, rootMargin });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, isVisible];
}
