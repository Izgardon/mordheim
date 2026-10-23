import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { CardBackground } from "@/components/ui/card-background";
import { Input } from "@/components/ui/input";

import { useCatalogue } from "@/lib/catalogue-queries";
import { BeastKindLabel } from "./BeastKindIcon";

import type { BestiaryEntrySummary } from "../types/bestiary-types";

type BestiaryPickerProps = {
  campaignId: number;
  onSelect: (entry: BestiaryEntrySummary) => void;
  onClose: () => void;
};

/** A creature's stats in short, or "No profile" for one without. */
function ShortProfile({ entry }: { entry: BestiaryEntrySummary }) {
  if (!entry.has_profile) {
    return <span className="text-[0.55rem] italic text-muted-foreground">No profile</span>;
  }
  return (
    <div className="flex gap-1 text-[0.55rem] text-muted-foreground">
      <span>M{entry.movement}</span>
      <span>WS{entry.weapon_skill}</span>
      <span>S{entry.strength}</span>
      <span>T{entry.toughness}</span>
      <span>W{entry.wounds}</span>
    </div>
  );
}

/**
 * The battle's Load from Bestiary: the creatures only (a temporary ally or enemy is a creature;
 * mounts and pets go with a unit), searched by name, from the bestiary list the pages share.
 */
export default function BestiaryPicker({ campaignId, onSelect, onClose }: BestiaryPickerProps) {
  const { data: entries, isLoading } = useCatalogue("bestiary", campaignId);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => e.kind === "creature" && (!q || e.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, search]);

  return (
    <CardBackground className="space-y-3 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
          Add from Bestiary
        </p>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <Input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search creatures..."
        aria-label="Search creatures"
        className="h-8 text-xs"
      />

      <div className="max-h-64 space-y-1 overflow-y-auto">
        {isLoading ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No creatures found.</p>
        ) : (
          filtered.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect(entry)}
              className="flex w-full items-center justify-between gap-2 rounded border border-border/40 bg-black/25 px-3 py-2 text-left transition hover:bg-black/40"
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground">
                  {entry.name}
                </span>
                <span className="text-[0.55rem] uppercase tracking-[0.15em] text-muted-foreground">
                  <BeastKindLabel kind={entry.kind} />
                  {entry.large ? " • Large" : ""}
                </span>
              </div>
              <ShortProfile entry={entry} />
            </button>
          ))
        )}
      </div>
    </CardBackground>
  );
}
