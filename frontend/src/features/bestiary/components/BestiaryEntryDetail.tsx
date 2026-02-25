import { useEffect, useState } from "react";

import { CardBackground } from "@/components/ui/card-background";
import { Button } from "@/components/ui/button";
import { getBestiaryEntry } from "../api/bestiary-api";

import type { BestiaryEntry } from "../types/bestiary-types";

const STAT_HEADERS = [
  { key: "movement", label: "M" },
  { key: "weapon_skill", label: "WS" },
  { key: "ballistic_skill", label: "BS" },
  { key: "strength", label: "S" },
  { key: "toughness", label: "T" },
  { key: "wounds", label: "W" },
  { key: "initiative", label: "I" },
  { key: "attacks", label: "A" },
  { key: "leadership", label: "Ld" },
] as const;

type BestiaryEntryDetailProps = {
  entryId: number;
  onClose: () => void;
};

export default function BestiaryEntryDetail({
  entryId,
  onClose,
}: BestiaryEntryDetailProps) {
  const [entry, setEntry] = useState<BestiaryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    getBestiaryEntry(entryId)
      .then((data) => {
        if (!cancelled) setEntry(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entryId]);

  if (isLoading) {
    return (
      <CardBackground className="p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </CardBackground>
    );
  }

  if (error || !entry) {
    return (
      <CardBackground className="space-y-3 p-6">
        <p className="text-sm text-red-600">{error || "Entry not found"}</p>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Back
        </Button>
      </CardBackground>
    );
  }

  return (
    <CardBackground className="space-y-4 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg text-foreground">{entry.name}</h2>
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
            {entry.type}
            {entry.large ? " \u2022 Large" : ""}
            {entry.caster !== "No" ? ` \u2022 ${entry.caster}` : ""}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Back
        </Button>
      </div>

      {entry.description ? (
        <p className="text-sm text-muted-foreground">{entry.description}</p>
      ) : null}

      <div className="overflow-x-auto rounded border border-border/60 bg-background/60">
        <table className="min-w-full text-xs text-muted-foreground">
          <thead className="bg-background/80 uppercase tracking-[0.2em]">
            <tr>
              {STAT_HEADERS.map((h) => (
                <th key={h.key} className="px-3 py-1.5 text-center font-semibold">
                  {h.label}
                </th>
              ))}
              <th className="px-3 py-1.5 text-center font-semibold">AS</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border/60">
              {STAT_HEADERS.map((h) => (
                <td
                  key={h.key}
                  className="px-3 py-1.5 text-center text-sm font-semibold text-foreground"
                >
                  {entry[h.key]}
                </td>
              ))}
              <td className="px-3 py-1.5 text-center text-sm font-semibold text-foreground">
                {entry.armour_save || "-"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {entry.skills.length > 0 ? (
        <section className="space-y-1">
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
            Skills
          </p>
          <div className="flex flex-wrap gap-2">
            {entry.skills.map((skill) => (
              <span
                key={skill.id}
                className="rounded bg-background/60 px-2 py-0.5 text-xs text-foreground"
              >
                {skill.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {entry.specials.length > 0 ? (
        <section className="space-y-1">
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
            Special Rules
          </p>
          <div className="flex flex-wrap gap-2">
            {entry.specials.map((special) => (
              <span
                key={special.id}
                className="rounded bg-background/60 px-2 py-0.5 text-xs text-foreground"
              >
                {special.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {entry.spells.length > 0 ? (
        <section className="space-y-1">
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
            Spells
          </p>
          <div className="flex flex-wrap gap-2">
            {entry.spells.map((spell) => (
              <span
                key={spell.id}
                className="rounded bg-background/60 px-2 py-0.5 text-xs text-foreground"
              >
                {spell.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {entry.equipment.length > 0 ? (
        <section className="space-y-1">
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
            Equipment
          </p>
          <div className="flex flex-wrap gap-2">
            {entry.equipment.map((equip) => (
              <span
                key={equip.item.id}
                className="rounded bg-background/60 px-2 py-0.5 text-xs text-foreground"
              >
                {equip.item.name}
                {equip.quantity > 1 ? ` x${equip.quantity}` : ""}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </CardBackground>
  );
}
