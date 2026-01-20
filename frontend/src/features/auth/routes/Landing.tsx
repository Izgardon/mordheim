import AuthCard from "../components/AuthCard";

export default function Landing() {
  return (
    <main className="landing min-h-screen px-4 py-16">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-red-100/70">
            Mordheim
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
            Rally the warband. Track the fallout. Keep the story alive.
          </h1>
          <p className="max-w-lg text-lg text-red-100/80">
            Keep every roster, injury, and reward in one place. Sign in and pick up where the last
            battle ended.
          </p>
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-red-600/80 text-lg font-semibold text-white">
              M
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Campaign control room</p>
              <p className="text-xs text-red-100/70">Plan, play, and log results fast.</p>
            </div>
          </div>
        </section>

        <AuthCard />
      </div>
    </main>
  );
}
