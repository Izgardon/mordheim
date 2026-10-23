import type { ReactNode } from "react";

import { CardBackground } from "@/components/ui/card-background";
import OverflowTagList from "@/features/bestiary/components/OverflowTagList";
import { EntryBadge } from "@/features/catalogue/components/EntryBadge";
import { STAT_FIELDS } from "@/features/catalogue/utils/statblock";

import { formatHirelingCost, hirelingRace } from "../hireling-catalogue-kinds";
import { personaTermsLine } from "../utils/hireling-display";

import type { HirelingCatalogueConfig } from "../hireling-catalogue-kinds";
import type { HirelingProfile } from "../types/hireling-catalogue-types";

const TAG_CLASS = "rounded bg-background/60 px-1.5 py-0.5 text-[10px]";

function CardStats({ entry }: { entry: HirelingProfile }) {
  return (
    <div className="overflow-x-auto rounded border border-border/60 bg-background/60">
      <table className="min-w-full text-[10px] text-muted-foreground">
        <thead className="bg-background/80 uppercase tracking-[0.2em]">
          <tr>
            {STAT_FIELDS.map((field) => (
              <th key={field.key} className="px-2 py-1 text-center font-semibold">
                {field.label}
              </th>
            ))}
            <th className="px-2 py-1 text-center font-semibold">AS</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border/60">
            {STAT_FIELDS.map((field) => (
              <td
                key={field.key}
                className="px-2 py-1 text-center text-xs font-semibold text-foreground"
              >
                {entry[field.key]}
              </td>
            ))}
            <td className="px-2 py-1 text-center text-xs font-semibold text-foreground">
              {entry.armour_save != null ? `${entry.armour_save}+` : "-"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

type Props = {
  config: HirelingCatalogueConfig;
  entry: HirelingProfile;
  /** Opens the entry's detail; without it (the Archived list) the card doesn't open. */
  onOpen?: (entry: HirelingProfile) => void;
  /** Beside the name: the Archived list's Restore. */
  action?: ReactNode;
};

/**
 * A hired sword or dramatis persona in its catalogue: name with its Custom, House rule or Archived
 * badge, what it is (race, size, caster), the hire terms, restrictions, skill lists, fluff and
 * profile.
 */
export default function HirelingProfileCard({ config, entry, onOpen, action }: Props) {
  const race = hirelingRace(entry);
  const terms = config.hasPersonaTerms ? personaTermsLine(entry) : "";
  const opens = Boolean(onOpen);
  return (
    <div
      className={`min-h-[244px] ${opens ? "cursor-pointer transition hover:brightness-110" : ""}`}
      {...(opens
        ? {
            role: "button",
            tabIndex: 0,
            onClick: () => onOpen?.(entry),
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") onOpen?.(entry);
            },
          }
        : { role: "article", "aria-label": entry.name })}
    >
      <CardBackground className="surface-panel-strong h-full space-y-2 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              {entry.name}
              <EntryBadge entry={entry} />
            </h3>
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
              {config.labels.singular}
              {race ? ` • ${race}` : ""}
              {entry.large ? " • Large" : ""}
              {entry.caster !== "No" ? ` • ${entry.caster}` : ""}
            </p>
          </div>
          {action}
        </div>

        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span>
            Hire:{" "}
            <span className="font-semibold text-foreground">
              {formatHirelingCost(entry.hire_cost, entry.hire_cost_expression)}
            </span>
          </span>
          <span>
            Upkeep:{" "}
            <span className="font-semibold text-foreground">
              {formatHirelingCost(entry.upkeep_cost, entry.upkeep_cost_expression)}
            </span>
          </span>
        </div>
        {terms ? <p className="text-xs text-muted-foreground">{terms}</p> : null}

        {entry.restrictions.length > 0 ? (
          <OverflowTagList
            tags={entry.restrictions.map((link) => ({
              key: `${link.restriction.id}-${link.additional_note}`,
              label:
                link.restriction.restriction +
                (link.additional_note ? ` (${link.additional_note})` : ""),
            }))}
            tagClassName={`${TAG_CLASS} text-muted-foreground`}
          />
        ) : null}

        {entry.available_skill_types.length > 0 ? (
          <OverflowTagList
            tags={entry.available_skill_types.map((type) => ({ key: type, label: type }))}
            tagClassName={`${TAG_CLASS} text-foreground`}
          />
        ) : null}

        {entry.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{entry.description}</p>
        ) : null}

        <CardStats entry={entry} />
      </CardBackground>
    </div>
  );
}
