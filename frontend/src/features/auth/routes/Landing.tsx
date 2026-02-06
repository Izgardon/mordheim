import { useMemo } from "react";

import AuthCard from "../components/AuthCard";
import titleImage from "@/assets/background/title.webp";

export default function Landing() {
  const youtubeId = "WCB10AkLI4k";
  const randomStart = useMemo(
    () => Math.floor(Math.random() * (360 - 10 + 1)) + 10,
    []
  );
  const youtubeEmbedSrc = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&playsinline=1&loop=1&playlist=${youtubeId}&modestbranding=1&iv_load_policy=3&fs=0&disablekb=1&start=${randomStart}`;

  return (
    <main className="landing min-h-screen px-6 py-20 md:py-24">
      <div className="landing-video" aria-hidden="true">
        <iframe
          src={youtubeEmbedSrc}
          title="Mordheim atmosphere video"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          aria-hidden="true"
        />
      </div>
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
        <section
          className="space-y-7"
          style={{ textShadow: "0 0 14px rgba(0, 0, 0, 0.85)" }}
        >
          <img
            src={titleImage}
            alt="Mordheim: City of the Damned"
            className="w-full max-w-[420px] drop-shadow-[0_6px_12px_rgba(0,0,0,0.6)] md:max-w-[520px]"
          />
          <p className="max-w-xl text-lg font-medium text-foreground/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            The comet fell. The city burned. Chronicle every shard, victory and death across your
            campaign.
          </p>
        </section>

        <AuthCard />
      </div>
    </main>
  );
}
