import { useState, useRef, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';

export default function LazyImage({ src, alt, className = '', ...props }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          img.src = img.dataset.src;
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(img);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!error && (
        <img
          ref={imgRef}
          data-src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          {...props}
        />
      )}
      {!loaded && !error && (
        <div className="absolute inset-0 bg-base-300 animate-pulse" />
      )}
      {error && (
        <div className="absolute inset-0 bg-base-300 flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-base-content/20" />
        </div>
      )}
    </div>
  );
}
