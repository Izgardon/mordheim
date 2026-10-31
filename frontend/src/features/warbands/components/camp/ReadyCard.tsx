import { Check } from "lucide-react";

/** Once you are ready (design E): the side panel says so, and how many players are ready. */
export default function ReadyCard({ ready, total }: { ready: number; total: number }) {
  return (
    <section className="flex items-center gap-3 border border-border bg-surface px-[18px] py-4">
      <span className="flex h-[34px] w-[34px] items-center justify-center border border-good-line bg-good-bg text-good">
        <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      </span>
      <div className="flex flex-col">
        <span className="font-bold text-head">Ready for the next battle</span>
        <span className="text-xs text-muted-foreground">
          {ready} of {total} players ready
        </span>
      </div>
    </section>
  );
}
