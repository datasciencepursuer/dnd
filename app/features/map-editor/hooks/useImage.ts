import { useState, useEffect } from "react";

// Global cache for loaded images - persists across component unmounts
const imageCache = new Map<string, HTMLImageElement>();

/**
 * Hook to load an image with caching.
 * - Uses in-memory cache to avoid re-fetching when tokens/backgrounds move
 * - Checks browser cache for already-loaded images
 * - Shared across all components using the same URL
 */
export function useImage(url: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(() => {
    // Skip on server (SSR)
    if (typeof window === "undefined") return null;
    // Check cache on initial render
    if (url && imageCache.has(url)) {
      return imageCache.get(url) || null;
    }
    return null;
  });

  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }

    // Check cache first
    if (imageCache.has(url)) {
      setImage(imageCache.get(url) || null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous"; // Enable CORS for external URLs (UploadThing)
    img.src = url;

    // Check if already loaded (from browser cache)
    if (img.complete && img.naturalWidth > 0) {
      imageCache.set(url, img);
      setImage(img);
      return;
    }

    img.onload = () => {
      imageCache.set(url, img);
      setImage(img);
    };

    return () => {
      img.onload = null;
    };
  }, [url]);

  return image;
}

/**
 * Preload images into the cache without rendering them.
 * Useful for preloading preset images on app start.
 * Safe to call during SSR (no-op on server).
 */
export function preloadImages(urls: string[]): void {
  // Skip on server (SSR)
  if (typeof window === "undefined") return;

  urls.forEach((url) => {
    if (!imageCache.has(url)) {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imageCache.set(url, img);
      };
      img.src = url;
    }
  });
}

/**
 * Clear the image cache. Useful for memory management in long sessions.
 */
export function clearImageCache(): void {
  imageCache.clear();
}
