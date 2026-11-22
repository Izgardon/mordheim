import type { ReactNode } from "react";

/** A labelled list in a header window ("Heroes", "Henchmen"): its rows are `li`s. */
export default function WindowSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col">
      <h3 className="m-0 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
        {label}
      </h3>
      <ul className="m-0 flex list-none flex-col p-0">{children}</ul>
    </section>
  );
}
