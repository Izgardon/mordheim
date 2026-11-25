import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { UNIT_MARKER_ICONS, type UnitMarker } from "@/components/ui/game-icons";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { VictimOption } from "./battle-units";

/** Each mark in its kind's metal, as the warband page's cards (heroes gold, hired swords silver). */
const MARKER_TONE: Partial<Record<UnitMarker, string>> = {
  hero: "text-metal-gold",
  hired: "text-metal-silver",
};

/** A victim's mark from the warband page (William, 25 Nov 2026: "as we have space to work with"). */
function VictimMarker({ marker }: { marker: UnitMarker }) {
  const Marker = UNIT_MARKER_ICONS[marker];
  return (
    <Marker
      aria-hidden="true"
      focusable="false"
      data-marker={marker}
      className={cn("h-5 w-5 shrink-0", MARKER_TONE[marker] ?? "text-metal-bronze")}
    />
  );
}

/** One victim to pick: the box, the mark, the name and what it is. */
function VictimRow({
  entry,
  on,
  onPick,
}: {
  entry: VictimOption;
  on: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => onPick(entry.id)}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 border-t border-line px-2.5 py-1 text-left",
        on && "bg-accent-soft"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-4 w-4 shrink-0 border-2",
          on ? "border-primary bg-primary" : "border-strong bg-transparent"
        )}
      />
      <VictimMarker marker={entry.marker} />
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-ink">{entry.name}</span>
        <span className="text-xs text-muted-foreground">{entry.detail}</span>
      </span>
    </button>
  );
}

/**
 * A henchmen group opens to its standing members (William, 25 Nov 2026: "clicking the group should
 * expand it and show a list of henchmen names rather than the group being the checkbox").
 */
function VictimGroup({
  entry,
  victimId,
  onPick,
}: {
  entry: VictimOption & { members: VictimOption[] };
  victimId: string | null;
  onPick: (id: string) => void;
}) {
  const holdsPick = entry.members.some((member) => member.id === victimId);
  const [open, setOpen] = useState(holdsPick);
  const shown = open || holdsPick;
  return (
    <div>
      <button
        type="button"
        aria-expanded={shown}
        onClick={() => setOpen(!shown)}
        className={cn(
          "flex min-h-12 w-full items-center gap-3 border-t border-line px-2.5 py-1 text-left",
          holdsPick && "bg-accent-soft"
        )}
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            shown && "rotate-90"
          )}
        />
        <VictimMarker marker={entry.marker} />
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-ink">{entry.name}</span>
          <span className="text-xs text-muted-foreground">{entry.detail}</span>
        </span>
      </button>
      {shown ? (
        <div
          role="group"
          aria-label={entry.name}
          className="border-l-[3px] border-l-accent-line bg-page"
        >
          {entry.members.map((member) => (
            <VictimRow key={member.id} entry={member} on={member.id === victimId} onPick={onPick} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The kill sheet's victims on one side, each with its mark (a henchmen group opening to its
 * members), then Someone else with a typed name.
 */
export default function KillVictims({
  victims,
  victimId,
  typed,
  onPick,
  onType,
}: {
  victims: VictimOption[];
  victimId: string | null;
  typed: string;
  onPick: (id: string) => void;
  onType: (text: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Victim" className="flex flex-col">
      {victims.map((entry) =>
        entry.members ? (
          <VictimGroup
            key={entry.id}
            entry={{ ...entry, members: entry.members }}
            victimId={victimId}
            onPick={onPick}
          />
        ) : (
          <VictimRow key={entry.id} entry={entry} on={entry.id === victimId} onPick={onPick} />
        )
      )}
      {victims.length === 0 ? (
        <p className="m-0 border-t border-line px-2.5 py-3 text-sm text-muted-foreground">
          Nobody left standing here.
        </p>
      ) : null}
      <label className="flex min-h-12 items-center gap-2.5 border-t border-line px-2.5 py-1 text-[13px] text-muted-foreground">
        Someone else
        <Input
          value={typed}
          placeholder="Name"
          onChange={(event) => onType(event.target.value)}
          className="flex-1"
        />
      </label>
    </div>
  );
}
