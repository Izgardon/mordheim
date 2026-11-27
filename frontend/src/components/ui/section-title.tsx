import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A section's title on a page (design E): the overview's, the Battles page's, the warband page's
 * and the settings and account cards'. One size and style everywhere.
 */
export const SECTION_TITLE = "m-0 font-display text-[22px] font-semibold leading-tight text-head";

/** A part's title inside a section (Home's Workshop: its Warbands, Warband lists, My content). */
const SUBSECTION_TITLE = "m-0 text-xs font-bold uppercase tracking-[0.12em] text-faint";

type SectionTitleProps = {
  id?: string;
  /** 3: a part of a section, a smaller h3. */
  level?: 2 | 3;
  /** Extra classes (a danger card's title takes `text-danger`). */
  className?: string;
  children: ReactNode;
};

export function SectionTitle({ id, level = 2, className, children }: SectionTitleProps) {
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <Heading id={id} className={cn(level === 3 ? SUBSECTION_TITLE : SECTION_TITLE, className)}>
      {children}
    </Heading>
  );
}

type SectionHeadProps = {
  title: ReactNode;
  id?: string;
  level?: 2 | 3;
  /** Beside the title, on the right: a count, a link, the section's button. */
  aside?: ReactNode;
  className?: string;
};

/** A section's title with what sits beside it. */
export function SectionHead({ title, id, level, aside, className }: SectionHeadProps) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <SectionTitle id={id} level={level}>
        {title}
      </SectionTitle>
      {aside}
    </div>
  );
}
