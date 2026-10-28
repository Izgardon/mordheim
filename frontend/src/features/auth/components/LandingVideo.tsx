import { useEffect, useMemo, useRef, useState } from "react";

const YOUTUBE_ID = "WCB10AkLI4k";

/**
 * True once the page has finished loading, and never during the first render: the video waits
 * for the window's load event (or, when the page has loaded already, for the next task).
 */
function usePageLoaded() {
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    const show = () => setIsLoaded(true);
    if (document.readyState === "complete") {
      const timer = window.setTimeout(show, 0);
      return () => window.clearTimeout(timer);
    }
    window.addEventListener("load", show, { once: true });
    return () => window.removeEventListener("load", show);
  }, []);
  return isLoaded;
}

/**
 * The landing page's background video, the desktop half beside the sign-in card (decision 5,
 * AUTH-TWEAK-05): YouTube's no-cookie embed, mounted only after the page has loaded, autoplaying
 * muted from a random start and scaled to cover its half. No other page loads it.
 */
export function LandingVideo() {
  const containerRef = useRef<HTMLElement | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const isPageLoaded = usePageLoaded();
  const randomStart = useMemo(() => Math.floor(Math.random() * (360 - 10 + 1)) + 10, []);
  const embedSrc = `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&playsinline=1&loop=1&playlist=${YOUTUBE_ID}&modestbranding=1&iv_load_policy=3&fs=0&disablekb=1&start=${randomStart}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const aspect = 16 / 9;
    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) {
        return;
      }
      setVideoSize(
        width / height > aspect
          ? { width, height: width / aspect }
          : { width: height * aspect, height }
      );
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      className={`landing-video${isVideoLoaded ? " is-loaded" : ""}`}
      aria-hidden="true"
      ref={containerRef}
    >
      {isPageLoaded ? (
        <iframe
          src={embedSrc}
          title="Mordheim atmosphere video"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          aria-hidden="true"
          style={{
            width: videoSize.width ? `${videoSize.width}px` : undefined,
            height: videoSize.height ? `${videoSize.height}px` : undefined,
          }}
          onLoad={() => setIsVideoLoaded(true)}
        />
      ) : null}
    </section>
  );
}
