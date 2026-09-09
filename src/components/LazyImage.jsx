import { useState, useRef, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';

export default function LazyImage({ src, alt, className = '', ...props }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const load = () => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
      } else {
        setError(true);
      }
    };
    // No IntersectionObserver (very old browser / SSR / headless quirks) → load immediately
    if (!('IntersectionObserver' in window)) {
      load();
      return;
    }
    let done = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          done = true;
          load();
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(img);
    // Fallback: if the observer never fires, load anyway so images never stay blank
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        load();
        observer.disconnect();
      }
    }, 1500);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!error && (
        <img
          ref={imgRef}
          data-src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          {...props}
        />
      )}
      {!loaded && !error && (
        <div className="absolute inset-0 bg-[var(--bg-elevated)]">
          <div className="animate-shimmer w-full h-full" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 bg-[var(--bg-elevated)] flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-[var(--text-muted)]" />
        </div>
      )}
    </div>
  );
}
