import { useState, useEffect } from "react";
import { useIsMobile } from "./useIsMobile";
import { isNativePlatform } from "~/lib/capacitor-utils";

/**
 * Sets a CSS variable `--app-height` on `<html>` to match `window.innerHeight`,
 * which excludes mobile browser chrome (address bar, bottom nav).
 * On native platforms (Capacitor), uses 100vh (no browser chrome) but respects safe areas.
 * Returns the current height as a CSS value string, or `"100dvh"` on desktop / before hydration.
 */
export function useViewportHeight(): string {
  const isMobile = useIsMobile();
  const [height, setHeight] = useState<string>("100dvh");

  useEffect(() => {
    // Native platforms: use 100vh, no browser chrome to account for
    if (isNativePlatform) {
      document.documentElement.style.setProperty("--app-height", "100vh");
      setHeight("100vh");
      return;
    }

    if (!isMobile) {
      document.documentElement.style.removeProperty("--app-height");
      setHeight("100dvh");
      return;
    }

    function update() {
      const h = window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${h}px`);
      setHeight(`${h}px`);
    }

    update();
    window.addEventListener("resize", update);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);

    return () => {
      window.removeEventListener("resize", update);
      vv?.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--app-height");
    };
  }, [isMobile]);

  return height;
}
