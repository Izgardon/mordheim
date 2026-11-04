import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

import type { TemplateFighter } from "../../types/hire-template-types";
import { haveText, overCount } from "./hire-draft";

export const BY_HAND = "by-hand";

const STAT_SHORT = [
  ["WS", "weapon_skill"],
  ["BS", "ballistic_skill"],
  ["S", "strength"],
] as const;

/** "1 of 0–2 · 8 XP · WS 4 BS 3 S 3 · Combat, Shooting, Strength" (a group: "groups of 1–5"). */
function meta(fighter: TemplateFighter) {
  const written = fighter.written_stats ?? {};
  const stats = STAT_SHORT.map(([label, field]) => {
    const number = fighter[field];
    return `${label} ${number ?? ""}${written[field] ?? ""}`.trim();
  }).join(" ");
  const size =
    fighter.kind === "henchman" && fighter.group_max !== null
      ? fighter.group_min !== null && fighter.group_min !== fighter.group_max
        ? `groups of ${fighter.group_min}–${fighter.group_max}`
        : `groups of ${fighter.group_max}`
      : null;
  return [
    haveText(fighter),
    size,
    `${fighter.starting_xp} XP`,
    stats,
    fighter.skill_types.join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Recruit as (the templates plan, "Add a hero"): the template's heroes (or henchmen), each with
 * his cost and what the warband has of him, warning past his most; then someone not in the
 * template, typed by hand as before.
 */
export default function RecruitAsPicker({
  title,
  fighters,
  value,
  onPick,
}: {
  /** The warband type the template is for ("Reiklanders"). */
  title: string;
  fighters: TemplateFighter[];
  /** The picked fighter's key, or BY_HAND. */
  value: string;
  onPick: (key: string) => void;
}) {
  const row = (picked: boolean) =>
    cn(
      "flex w-full min-h-11 items-start gap-3 border-t border-line px-3 py-2 text-left first:border-t-0",
      picked ? "bg-accent-soft" : "hover:bg-raised"
    );
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-muted-foreground">Recruit as</span>
      <div role="radiogroup" aria-label="Recruit as" className="flex flex-col border border-line">
        <span className="px-3 pt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
          {title}
        </span>
        {fighters.map((fighter) => {
          const warning = overCount(fighter, 1);
          return (
            <button
              key={fighter.key}
              type="button"
              role="radio"
              aria-checked={value === fighter.key}
              className={row(value === fighter.key)}
              onClick={() => onPick(fighter.key)}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-bold text-ink">{fighter.name}</span>
                <span className="text-xs text-text2">{meta(fighter)}</span>
                {warning ? (
                  <span className="text-xs font-semibold text-danger">{warning}</span>
                ) : null}
              </span>
              <span className="font-mono text-sm font-bold text-head">{fighter.cost} gc</span>
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={value === BY_HAND}
          className={row(value === BY_HAND)}
          onClick={() => onPick(BY_HAND)}
        >
          <Plus className="mt-0.5 h-4 w-4 text-accent-text" aria-hidden="true" />
          <span className="text-sm font-bold text-accent-text">Someone not in the template</span>
        </button>
      </div>
    </div>
  );
}
