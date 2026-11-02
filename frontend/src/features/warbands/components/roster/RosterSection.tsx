import type { ReactNode } from "react";
import { Plus } from "lucide-react";

import { SectionTitle } from "@/components/ui/section-title";
import { cn } from "@/lib/utils";

import { ROSTER_DIVIDED } from "../page/warband-layout";

/** One roster section (design E): its title and count, its add button, the inline form, the cards. */
export default function RosterSection({
  title,
  meta,
  add,
  onAdd,
  divided = false,
  form,
  children,
}: {
  title: string;
  meta: string;
  add?: string;
  onAdd: () => void;
  /** Under a hairline: every section after the first. */
  divided?: boolean;
  /** The inline recruit form, at the top of the section while it is open. */
  form?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-3", divided && ROSTER_DIVIDED)}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <SectionTitle>{title}</SectionTitle>
          <span className="text-[13px] text-faint">{meta}</span>
        </div>
        {add && !form ? (
          <button
            type="button"
            onClick={onAdd}
            className="flex min-h-9 items-center gap-1.5 border border-border px-3 text-[13px] font-bold text-accent-text hover:bg-raised"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {add}
          </button>
        ) : null}
      </div>
      {form}
      {children}
    </section>
  );
}
