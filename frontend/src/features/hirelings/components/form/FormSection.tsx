import type { ReactNode } from "react";

/**
 * One part of the hired sword and dramatis persona form (William, 7 Nov 2026: "improve general
 * layout and grouping"): a small caption over its fields, ruled off from the part above.
 */
export default function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-col gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0"
    >
      <h3 className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">{title}</h3>
      {children}
    </section>
  );
}
