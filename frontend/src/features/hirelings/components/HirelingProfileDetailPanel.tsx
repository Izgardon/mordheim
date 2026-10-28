import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardBackground } from "@/components/ui/card-background";
import {
  DetailHeader,
  DetailSection,
  EntryStatTable,
} from "@/features/bestiary/components/detail/entry-detail-parts";
import { EntryBadge } from "@/features/catalogue/components/EntryBadge";

import { formatHirelingCost, hirelingRace } from "../hireling-catalogue-kinds";
import { useHirelingProfileDetail } from "../hooks/useHirelingProfileDetail";
import { personaTermsLine } from "../utils/hireling-display";
import HirelingDetailLinks from "./HirelingDetailLinks";

import type { HirelingCatalogueConfig } from "../hireling-catalogue-kinds";

type Props = {
  config: HirelingCatalogueConfig;
  campaignId: number;
  entryId: number;
  onClose: () => void;
  /** Edit (an `edit_catalogue` holder): opens the form on this entry. */
  onEdit?: () => void;
};

const TAG_CLASS = "rounded bg-background/60 px-2 py-0.5 text-xs";

/**
 * One hired sword or dramatis persona: name and badge, Edit and Back, the hire terms (and a
 * dramatis persona's), restrictions, skill lists, fluff, profile, and what it knows and carries.
 */
export default function HirelingProfileDetailPanel({
  config,
  campaignId,
  entryId,
  onClose,
  onEdit,
}: Props) {
  const { entry, isLoading, error } = useHirelingProfileDetail(config.kind, campaignId, entryId);

  if (isLoading) {
    return (
      <CardBackground className="surface-panel-strong p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </CardBackground>
    );
  }
  if (error || !entry) {
    return (
      <CardBackground className="surface-panel-strong space-y-3 p-6">
        <p className="text-sm text-red-600">{error || "Entry not found"}</p>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Back
        </Button>
      </CardBackground>
    );
  }

  const race = hirelingRace(entry);
  const terms = config.hasPersonaTerms ? personaTermsLine(entry) : "";
  return (
    <CardBackground className="surface-panel-strong space-y-4 p-4 sm:p-6">
      <DetailHeader
        name={entry.name}
        kind={`${config.labels.singular}${race ? ` • ${race}` : ""}`}
        entry={entry}
        onClose={onClose}
        badge={<EntryBadge entry={entry} />}
        actions={
          onEdit ? (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
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
        {entry.rating !== null ? (
          <span>
            Rating: <span className="font-semibold text-foreground">{entry.rating}</span>
          </span>
        ) : null}
      </div>
      {terms ? <p className="text-sm text-muted-foreground">{terms}</p> : null}

      {entry.restrictions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {entry.restrictions.map((link) => (
            <span
              key={`${link.restriction.id}-${link.additional_note}`}
              className={`${TAG_CLASS} text-muted-foreground`}
            >
              {link.restriction.restriction}
              {link.additional_note ? ` (${link.additional_note})` : ""}
            </span>
          ))}
        </div>
      ) : null}

      {entry.available_skill_types.length > 0 ? (
        <DetailSection title="Available Skill Types">
          {entry.available_skill_types.map((type) => (
            <span key={type} className={`${TAG_CLASS} text-foreground`}>
              {type}
            </span>
          ))}
        </DetailSection>
      ) : null}

      {entry.description ? (
        <p className="text-sm text-muted-foreground">{entry.description}</p>
      ) : null}

      <EntryStatTable entry={entry} />
      <HirelingDetailLinks entry={entry} />
    </CardBackground>
  );
}
