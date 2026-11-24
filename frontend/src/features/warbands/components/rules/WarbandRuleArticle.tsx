import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { WarbandRule } from "../../types/warband-types";

const scrollTo = (node: HTMLElement | null) => node?.scrollIntoView?.({ block: "nearest" });

/**
 * One warband rule as the rules modal reads it: its title (and the editors' button across from it)
 * over its description. The rule a pill opened at is picked out and scrolled to. The battle Rules
 * sheet's Warband rules show the same.
 */
export default function WarbandRuleArticle({
  rule,
  opened = false,
  action,
}: {
  rule: Pick<WarbandRule, "title" | "description">;
  opened?: boolean;
  action?: ReactNode;
}) {
  return (
    <article
      ref={opened ? scrollTo : undefined}
      aria-label={rule.title}
      data-opened={opened || undefined}
      className={cn(
        "flex flex-col gap-1 border-t border-line px-3 py-3 first:border-t-0",
        opened && "bg-accent-soft"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="m-0 font-bold text-head">{rule.title}</h3>
        {action}
      </div>
      {rule.description ? (
        <p className="m-0 whitespace-pre-line text-sm text-text2">{rule.description}</p>
      ) : null}
    </article>
  );
}
