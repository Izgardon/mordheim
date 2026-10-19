import type { ReactNode } from "react";

import { CardBackground } from "@/components/ui/card-background";
import { cn } from "@/lib/utils";

export type PostbattleSectionKey = "exploration" | "roster" | "stats" | "finds" | "upkeep";

export const POSTBATTLE_SECTION_LABELS: Record<PostbattleSectionKey, string> = {
  exploration: "Exploration",
  roster: "Roster",
  stats: "Stat changes",
  finds: "Finds",
  upkeep: "Upkeep",
};

export const getPostbattleSectionId = (section: PostbattleSectionKey) =>
  `battle-postbattle-section-${section}`;

/** One postbattle section: a card on desktop, a plain section on the phone. */
export default function PostbattleSection({
  section,
  isMobile,
  className,
  children,
}: {
  section: PostbattleSectionKey;
  isMobile: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = getPostbattleSectionId(section);
  if (isMobile) {
    return (
      <section id={id} className={cn("space-y-4", className)}>
        {children}
      </section>
    );
  }

  return (
    <CardBackground
      as="section"
      id={id}
      className={cn("battle-card space-y-4 p-4 sm:p-5", className)}
    >
      {children}
    </CardBackground>
  );
}
