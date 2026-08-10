import { useState, useEffect } from "react";

// Global cache for loaded images - persists across component unmounts.
// Downscaled variants are cached separately under `${url}#${maxSize}`.
const imageCache = new Map<string, HTMLImageElement | HTMLCanvasElement>();

// Downscale an image so its largest dimension is at most maxSize.
// Uploaded assets can be huge (multi-MB); drawing them at full resolution
// on every Konva layer repaint is the main cost on image-heavy maps.
function downscaleImage(img: HTMLImageElement, maxSize: number): HTMLImageElement | HTMLCanvasElement {
  const scale = maxSize / Math.max(img.naturalWidth, img.naturalHeight);
  if (scale >= 1) return img;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return img;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Hook to load an image with caching.
 * - Uses in-memory cache to avoid re-fetching when tokens/backgrounds move
 * - Checks browser cache for already-loaded images
 * - Shared across all components using the same URL
 * - Pass maxSize to get a downscaled copy (cached per url+size); use
 *   `.width`/`.height` on the result — it may be a canvas, not an <img>
 */
export function useImage(url: string | null, maxSize?: number): HTMLImageElement | HTMLCanvasElement | null {
  const cacheKey = url ? (maxSize ? `${url}#${maxSize}` : url) : null;

  const [image, setImage] = useState<HTMLImageElement | HTMLCanvasElement | null>(() => {
    // Skip on server (SSR)
    if (typeof window === "undefined") return null;
    // Check cache on initial render
    if (cacheKey && imageCache.has(cacheKey)) {
      return imageCache.get(cacheKey) || null;
    }
    return null;
  });

  useEffect(() => {
    if (!url || !cacheKey) {
      setImage(null);
      return;
    }

    // Check cache first
    if (imageCache.has(cacheKey)) {
      setImage(imageCache.get(cacheKey) || null);
      return;
    }

    const store = (loaded: HTMLImageElement) => {
      const result = maxSize ? downscaleImage(loaded, maxSize) : loaded;
      imageCache.set(cacheKey, result);
      setImage(result);
    };

    // Reuse the full-size cached image (e.g. preloaded) instead of re-fetching
    const fullSize = imageCache.get(url);
    if (fullSize instanceof HTMLImageElement) {
      store(fullSize);
      return;
    }

    const img = new Image();
    // UploadThing's public CDN does not return an Access-Control-Allow-Origin
    // header. Do not opt into CORS here, or the browser will reject the image
    // before Konva can draw it. The editor only renders these images and does
    // not read pixels from or export the canvas.
    img.src = url;

    // Check if already loaded (from browser cache)
    if (img.complete && img.naturalWidth > 0) {
      store(img);
      return;
    }

    img.onload = () => {
      store(img);
    };

    return () => {
      img.onload = null;
    };
  }, [url, cacheKey, maxSize]);

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
