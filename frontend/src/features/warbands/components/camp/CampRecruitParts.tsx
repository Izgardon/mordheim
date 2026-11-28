import { Minus, Plus } from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

import type { HenchmenGroup } from "../../types/warband-types";

/** The veterans' pool left after these recruits, and the XP each takes (a new group's, to set). */
export function VeteranXp({
  left,
  total,
  each,
  fixed,
  onEach,
}: {
  left: number;
  total: number;
  each: number;
  /** An existing group's recruits join at its XP. */
  fixed: boolean;
  onEach: (each: number) => void;
}) {
  return (
    <>
      <div className="flex items-baseline justify-between border-t border-line pt-2.5">
        <span className="text-xs font-bold text-muted-foreground">Veteran experience to share</span>
        <span className="font-mono text-sm text-text2">
          <span className={cn("font-bold", left < 0 ? "text-danger" : "text-head")}>{left}</span> of{" "}
          {total} left
        </span>
      </div>
      <div data-no-sheet-drag="" className="flex items-center gap-2.5">
        <span className="flex-1 text-sm font-semibold text-ink">
          {fixed ? "Each joins at the group's XP" : "XP each"}
        </span>
        {fixed ? null : (
          <IconButton
            aria-label="Less experience each"
            className="h-9 w-9"
            disabled={each <= 0}
            onClick={() => onEach(each - 1)}
          >
            <Minus aria-hidden="true" />
          </IconButton>
        )}
        <span className="min-w-[54px] text-center font-mono text-sm font-bold text-head">
          {each} XP
        </span>
        {fixed ? null : (
          <IconButton
            aria-label="More experience each"
            className="h-9 w-9"
            onClick={() => onEach(each + 1)}
          >
            <Plus aria-hidden="true" />
          </IconButton>
        )}
      </div>
    </>
  );
}

/** Recruits for a new group, or one of the warband's (not a creature's: those come from the store). */
export const NEW = "new";

/** Where the recruits go: a new group, or one of the groups the warband has, with its models and size. */
export function RecruitInto({
  groups,
  into,
  onInto,
}: {
  groups: HenchmenGroup[];
  /** NEW, or the group's id. */
  into: string;
  onInto: (into: string) => void;
}) {
  const options = [
    { id: NEW, text: "New group" },
    ...groups.map((entry) => ({
      id: String(entry.id),
      text: `${entry.name} (${entry.henchmen.filter((m) => !m.dead).length}/${entry.max_size ?? 5})`,
    })),
  ];
  return (
    <div role="radiogroup" aria-label="Recruit into" className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <Chip
          key={option.id}
          role="radio"
          aria-checked={into === option.id}
          pressed={into === option.id}
          onClick={() => onInto(option.id)}
        >
          {option.text}
        </Chip>
      ))}
    </div>
  );
}
