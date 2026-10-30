import { useState } from "react";
import { X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { useCatalogue } from "@/lib/catalogue-queries";

import { parseAvailableSkills, skillAbbrevToType } from "../../utils/warband-utils";

export type PendingList = "skills" | "spells" | "specials";

const CATALOGUE = { skills: "skills", spells: "spells", specials: "specials" } as const;
const NOUN = { skills: "skill", spells: "spell", specials: "special" } as const;

/** The skill lists a unit may pick from: its skill access, as type names (empty: any list). */
function accessTypes(raw: unknown) {
  const record = parseAvailableSkills(raw);
  return Object.entries(record)
    .filter(([key, on]) => on && key !== "Spc")
    .map(([key]) => skillAbbrevToType[key] ?? key);
}

/**
 * A pending "New skill" (or spell, special) from an advance, resolved from the card: search the
 * campaign's list (skills from the unit's skill access when it has any) and pick one to take the
 * placeholder's place.
 */
export default function PendingPick({
  campaignId,
  list,
  access,
  onPick,
  onClose,
}: {
  campaignId: number;
  list: PendingList;
  /** The unit's `available_skills`, for skills. */
  access?: unknown;
  onPick: (entryId: number) => void;
  onClose: () => void;
}) {
  const entries = useCatalogue(CATALOGUE[list], campaignId).data ?? [];
  const [search, setSearch] = useState("");
  const allowed = list === "skills" ? accessTypes(access) : [];
  const query = search.trim().toLowerCase();
  const shown = entries
    .filter((entry) => (entry as { type?: string }).type !== "Pending")
    .filter((entry) => !allowed.length || allowed.includes((entry as { type?: string }).type ?? ""))
    .filter((entry) => entry.name.toLowerCase().includes(query));

  return (
    <div className="flex flex-col gap-2.5 border border-accent-line bg-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-lg font-semibold text-head">
          Pick a new {NOUN[list]}
        </span>
        <IconButton aria-label="Close" className="h-9 w-9" onClick={onClose}>
          <X aria-hidden="true" />
        </IconButton>
      </div>
      {allowed.length ? (
        <span className="text-xs text-muted-foreground">From {allowed.join(", ")}</span>
      ) : null}
      <Input
        inputSize="sm"
        type="search"
        aria-label={`Search ${list}`}
        placeholder={`Search ${list}`}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <ul className="m-0 flex max-h-72 list-none flex-col overflow-y-auto border-t border-line p-0">
        {shown.length === 0 ? (
          <li className="py-2 text-[13px] text-text2">Nothing matches.</li>
        ) : null}
        {shown.map((entry) => (
          <li key={entry.id} className="border-b border-line">
            <button
              type="button"
              onClick={() => onPick(entry.id)}
              className="flex w-full items-baseline justify-between gap-3 px-1 py-2 text-left hover:bg-raised"
            >
              <span className="text-sm font-semibold text-ink">{entry.name}</span>
              <span className="text-xs text-muted-foreground">
                {(entry as { type?: string }).type}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
