import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Input } from "@components/input";
import {
  formatHirelingCost,
  hirelingRace,
  type HirelingCatalogueKind,
} from "@/features/hirelings/hireling-catalogue-kinds";
import { personaTermsLine } from "@/features/hirelings/utils/hireling-display";
import { useCatalogue } from "@/lib/catalogue-queries";

import { isDramatisPersona } from "../../../../../units/kinds/hireling-terms";

import type { HireSource } from "../../../../../api/warbands-hirelings";
import type { HirelingProfile } from "@/features/hirelings/types/hireling-catalogue-types";
import type { WarbandHireling } from "../../../../../types/warband-types";

const CATALOGUES: Record<HireSource, { kind: HirelingCatalogueKind; noun: string }> = {
  hired_sword: { kind: "hired-swords", noun: "hired swords" },
  dramatis_persona: { kind: "dramatis-personae", noun: "dramatis personae" },
};

type Props = {
  source: HireSource;
  campaignId: number;
  /** The catalogue is read only while the dialog is open. */
  enabled: boolean;
  units: WarbandHireling[];
  /** The warband has as many hired swords as the campaign allows. */
  atCap: boolean;
  maxHiredSwords: number;
  onPick: (entry: HirelingProfile) => void;
};

/**
 * One of the Hire dialog's lists, searchable: the campaign's hired swords or dramatis personae.
 * At the cap the hired swords can't be picked (the server refuses them) and say why; a dramatis
 * persona already in the warband is marked (hiring him again only warns).
 */
export default function HireCatalogueList({
  source,
  campaignId,
  enabled,
  units,
  atCap,
  maxHiredSwords,
  onPick,
}: Props) {
  const { kind, noun } = CATALOGUES[source];
  const { data, isLoading, error } = useCatalogue(kind, campaignId, { enabled });
  const [query, setQuery] = useState("");
  const blocked = source === "hired_sword" && atCap;
  const hiredPersonae = useMemo(
    () =>
      new Set(
        units.filter((unit) => isDramatisPersona(unit) && !unit.dead).map((unit) => unit.unit_type)
      ),
    [units]
  );
  const entries = useMemo(() => {
    const search = query.trim().toLowerCase();
    return data
      .filter((entry) => !search || entry.name.toLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, query]);

  if (isLoading) {
    return <p className="py-4 text-sm text-muted-foreground">Loading {noun}...</p>;
  }
  if (error) {
    return <p className="py-4 text-sm text-red-600">{error}</p>;
  }
  if (data.length === 0) {
    return source === "dramatis_persona" ? (
      <p role="status" className="py-4 text-sm text-muted-foreground">
        No dramatis personae in the catalogue yet. Add one on the{" "}
        <Link to={`/campaigns/${campaignId}/dramatis-personae`} className="underline">
          Dramatis Personae
        </Link>{" "}
        page.
      </p>
    ) : (
      <p role="status" className="py-4 text-sm text-muted-foreground">
        No hired swords in the campaign&apos;s catalogue.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {blocked ? (
        <p role="status" className="text-sm text-amber-200">
          Maximum of {maxHiredSwords} hired swords reached. A dramatis persona doesn&apos;t count,
          and a blood-pacted hired sword can still be added by hand under Edit Hired Swords.
        </p>
      ) : null}
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${noun}...`}
        aria-label={`Search ${noun}`}
      />
      <ul
        className="max-h-[50vh] space-y-1.5 overflow-y-auto"
        aria-label={`The catalogue's ${noun}`}
      >
        {entries.map((entry) => {
          const race = hirelingRace(entry);
          const terms = source === "dramatis_persona" ? personaTermsLine(entry) : "";
          const alreadyHired = source === "dramatis_persona" && hiredPersonae.has(entry.name);
          return (
            <li key={entry.id}>
              <button
                type="button"
                disabled={blocked}
                onClick={() => onPick(entry)}
                className="flex w-full flex-col gap-0.5 rounded border border-border/50 bg-black/25 px-3 py-2 text-left transition hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="text-sm font-semibold text-foreground">{entry.name}</span>
                <span className="text-xs text-muted-foreground">
                  {race ? `${race} · ` : ""}Hire{" "}
                  {formatHirelingCost(entry.hire_cost, entry.hire_cost_expression)} · Upkeep{" "}
                  {formatHirelingCost(entry.upkeep_cost, entry.upkeep_cost_expression)}
                </span>
                {terms ? <span className="text-xs text-muted-foreground">{terms}</span> : null}
                {alreadyHired ? (
                  <span className="text-xs text-amber-200">Already in your warband</span>
                ) : null}
              </button>
            </li>
          );
        })}
        {entries.length === 0 ? (
          <li className="py-2 text-sm text-muted-foreground">No {noun} match your search.</li>
        ) : null}
      </ul>
    </div>
  );
}
