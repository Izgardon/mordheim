type RebuildingPageProps = {
  title: string;
  /** The redesign step that brings the page back, as in "step 2". */
  step: string;
};

/** A campaign page whose old version is gone and whose new one comes in a later redesign step. */
export default function RebuildingPage({ title, step }: RebuildingPageProps) {
  return (
    <section className="flex flex-col gap-2 px-4 py-6 min-[960px]:px-0">
      <h1 className="font-display text-3xl font-semibold text-head">{title}</h1>
      <p className="text-sm text-muted-foreground">Rebuilding in {step}.</p>
    </section>
  );
}
