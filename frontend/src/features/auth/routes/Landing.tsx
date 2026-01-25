import AuthCard from "../components/AuthCard";

export default function Landing() {
  const youtubeId = "WCB10AkLI4k";
  const youtubeEmbedSrc = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&playsinline=1&loop=1&playlist=${youtubeId}&modestbranding=1&iv_load_policy=3&fs=0&disablekb=1&start=10`;

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
        <section className="space-y-7">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground drop-shadow-[0_1px_0_rgba(0,0,0,0.65)]">
            City of the Damned
          </p>
          <h1 className="text-3xl font-semibold leading-tight text-foreground drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)] md:text-5xl">
            Mordheim
          </h1>
          <p className="max-w-xl text-lg font-medium text-foreground/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            The comet fell. The city burned. Chronicle every warband, shard, and scar across your
            campaigns.
          </p>
          <p className="text-sm italic text-muted-foreground drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">
            "Every stone hides a story worth fighting for."
          </p>
        </section>

        <AuthCard />
      </div>
    </main>
  );
}
