import AuthCard from "../components/AuthCard";

export default function Landing() {
  return (
    <main className="landing min-h-screen px-6 py-20 md:py-24">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-7">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-100/80">
            City of the Damned
          </p>
          <h1 className="text-3xl font-semibold leading-tight text-amber-50 drop-shadow-[0_3px_0_rgba(0,0,0,0.55)] md:text-5xl">
            Mordheim
          </h1>
          <p className="max-w-xl text-lg text-amber-100/80">
            The comet fell. The city burned. Chronicle every warband, shard, and scar across your
            campaigns.
          </p>
          <p className="text-sm italic text-amber-100/70">
            "Every stone hides a story worth fighting for."
          </p>
        </section>

        <AuthCard />
      </div>
    </main>
  );
}
