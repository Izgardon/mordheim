import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import siteBackground from "@/assets/background/site_background.webp";

type AuthShellProps = {
  children: ReactNode;
};

export default function AuthShell({ children }: AuthShellProps) {
  const youtubeId = "WCB10AkLI4k";
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const [videoSize, setVideoSize] = useState<{ width: number; height: number }>(
    {
      width: 0,
      height: 0,
    }
  );
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const isMobile = useMediaQuery("(max-width: 960px)");
  const randomStart = useMemo(
    () => Math.floor(Math.random() * (360 - 10 + 1)) + 10,
    []
  );
  const youtubeEmbedSrc = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&playsinline=1&loop=1&playlist=${youtubeId}&modestbranding=1&iv_load_policy=3&fs=0&disablekb=1&start=${randomStart}`;

  useEffect(() => {
    if (isMobile) {
      return;
    }
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
  }, [isMobile]);

  return (
    <main
      className={cn("landing h-screen min-h-screen", isMobile && "landing--mobile")}
      style={
        isMobile
          ? {
              backgroundImage: `radial-gradient(420px 320px at 0% 0%, rgba(57, 255, 77, 0.18), transparent 60%),
                radial-gradient(520px 380px at 100% 0%, rgba(57, 255, 77, 0.14), transparent 62%),
                radial-gradient(520px 380px at 0% 100%, rgba(57, 255, 77, 0.12), transparent 62%),
                radial-gradient(520px 380px at 100% 100%, rgba(57, 255, 77, 0.16), transparent 62%),
                linear-gradient(rgba(6, 5, 4, 0.25), rgba(6, 5, 4, 0.25)),
                url(${siteBackground})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundAttachment: "scroll",
            }
          : undefined
      }
    >
      <section className="landing-auth">{children}</section>
      {!isMobile ? (
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
      ) : null}
    </main>
  );
}
