import { useEffect, useMemo, useRef, useState } from "react";

import AuthCard from "../components/AuthCard";

export default function Landing() {
  const youtubeId = "WCB10AkLI4k";
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const [videoSize, setVideoSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const randomStart = useMemo(
    () => Math.floor(Math.random() * (360 - 10 + 1)) + 10,
    []
  );
  const youtubeEmbedSrc = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&playsinline=1&loop=1&playlist=${youtubeId}&modestbranding=1&iv_load_policy=3&fs=0&disablekb=1&start=${randomStart}`;

  useEffect(() => {
    const container = videoContainerRef.current;
    if (!container) {
      return;
    }

    const aspect = 16 / 9;
    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) {
        return;
      }
      const containerRatio = width / height;
      if (containerRatio > aspect) {
        const nextWidth = width;
        const nextHeight = width / aspect;
        setVideoSize({ width: nextWidth, height: nextHeight });
      } else {
        const nextHeight = height;
        const nextWidth = height * aspect;
        setVideoSize({ width: nextWidth, height: nextHeight });
      }
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <main className="landing h-screen min-h-screen">
      <section className="landing-auth">
        <AuthCard />
      </section>
      <section
        className={`landing-video${isVideoLoaded ? " is-loaded" : ""}`}
        aria-hidden="true"
        ref={videoContainerRef}
      >
        <iframe
          src={youtubeEmbedSrc}
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
      </section>
    </main>
  );
}
