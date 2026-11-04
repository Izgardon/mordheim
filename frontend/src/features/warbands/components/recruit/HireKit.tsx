import { useState } from "react";

import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

import type { TemplateLine } from "../../types/hire-template-types";
import { lineLabel, listPrice, pickKey, type KitPick } from "./hire-draft";

const SHOWN = 8; // lines shown before "+ N more"

/** "Sword 10", "Pistol, brace 30", "Gromril weapon · 3 × price". */
function chipText(line: TemplateLine, brace: boolean) {
  const price = listPrice(line, brace);
  const name = brace ? `${lineLabel(line)}, brace` : lineLabel(line);
  return price === null ? `${name} · ${line.cost_note || "price to type"}` : `${name} ${price}`;
}

/**
 * The kit in a hire (the templates plan, "Hiring"): while list prices are open, his lists' lines
 * at list price to pick (a brace at its brace price; a line he isn't meant to take dimmed with the
 * reason, still pickable); afterwards his lists to look at only, as the store kits him out.
 */
export default function HireKit({
  lists,
  lines,
  offLines,
  open,
  picks,
  onToggle,
}: {
  /** His lists' names. */
  lists: string;
  lines: TemplateLine[];
  offLines: number[];
  /** List prices are open. */
  open: boolean;
  picks: KitPick[];
  onToggle: (pick: KitPick) => void;
}) {
  const [all, setAll] = useState(false);
  if (!lines.length) return null;
  if (!open) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-muted-foreground">His lists · {lists}</span>
        <p className="m-0 text-[13px] text-text2">
          {lines.map((line) => lineLabel(line)).join(", ")}
        </p>
      </div>
    );
  }
  const options = lines.flatMap((line) => [
    { line, brace: false },
    ...(line.brace_cost !== null ? [{ line, brace: true }] : []),
  ]);
  const shown = all ? options : options.slice(0, SHOWN);
  const picked = new Set(picks.map(pickKey));
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-muted-foreground">
        Kit from the {lists}, at list price
      </span>
      <div className="flex flex-wrap gap-1.5">
        {shown.map(({ line, brace }) => {
          const pick = { lineId: line.id, brace };
          const off = offLines.includes(line.id);
          return (
            <Chip
              key={pickKey(pick)}
              pressed={picked.has(pickKey(pick))}
              className={cn(off && "opacity-60")}
              title={off ? line.who_text : undefined}
              onClick={() => onToggle(pick)}
            >
              {chipText(line, brace)}
              {off ? <span className="text-[11px] font-normal">({line.who_text})</span> : null}
            </Chip>
          );
        })}
        {options.length > SHOWN ? (
          <Chip onClick={() => setAll(!all)}>
            {all ? "Fewer" : `+ ${options.length - SHOWN} more`}
          </Chip>
        ) : null}
      </div>
    </div>
  );
}
