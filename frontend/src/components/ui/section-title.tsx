import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A section's title on a page (design E): the overview's, the Battles page's, the warband page's
 * and the settings and account cards'. One size and style everywhere.
 */
export const SECTION_TITLE = "m-0 font-display text-[22px] font-semibold leading-tight text-head";

type SectionTitleProps = {
  id?: string;
  /** Extra classes (a danger card's title takes `text-danger`). */
  className?: string;
  children: ReactNode;
};

export function SectionTitle({ id, className, children }: SectionTitleProps) {
  return (
    <h2 id={id} className={cn(SECTION_TITLE, className)}>
      {children}
    </h2>
  );
}

type SectionHeadProps = {
  title: ReactNode;
  id?: string;
  /** Beside the title, on the right: a count, a link, the section's button. */
  aside?: ReactNode;
  className?: string;
};

/** A section's title with what sits beside it. */
export function SectionHead({ title, id, aside, className }: SectionHeadProps) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <SectionTitle id={id}>{title}</SectionTitle>
      {aside}
    </div>
  );
}
