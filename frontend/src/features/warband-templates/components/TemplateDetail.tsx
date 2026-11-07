import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DetailSection, FactLine, ReferenceDetail } from "@/features/reference/ReferenceDetail";
import WarbandRules from "@/features/warbands/components/rules/WarbandRules";

import { useWarbandTemplate } from "../api/template-queries";
import { inVariant, rulesFor, termsFor } from "../template-view";
import TemplateFighterCard from "./TemplateFighterCard";
import TemplateLists from "./TemplateLists";
import TemplateUpgrades from "./TemplateUpgrades";

/** A campaign's template says whose it is: its own ("Custom"), or its house version of the book's. */
const sourceLabel = (template: { campaign_id: number | null; replaces?: number | null }) =>
  template.campaign_id === null ? "" : template.replaces ? "House version" : "Custom";

type TemplateDetailProps = {
  campaignId: number;
  templateId: number;
  /** The variant the row's warband type always is; "" when the player picks one. */
  preset: string;
  /** The row's warband type: its own rules show here only (null: a template serving none). */
  typeId: number | null;
  isMobile: boolean;
  /** Opens the template editor (those who edit the catalogue). */
  onEdit?: () => void;
};

/**
 * An open row of the Warbands page: the template's starting gold and warband size, its variant
 * switch (the type's own variant first), its rule pills (the warband sheet's rules modal), its
 * heroes and henchmen, and, beside them, its equipment lists and upgrades.
 */
export default function TemplateDetail({
  campaignId,
  templateId,
  preset,
  typeId,
  isMobile,
  onEdit,
}: TemplateDetailProps) {
  const query = useWarbandTemplate(campaignId, templateId);
  const [picked, setPicked] = useState<string | null>(null);
  const template = query.data;

  if (!template) {
    return (
      <p className="m-0 px-4 py-4 text-sm text-text2">
        {query.isError ? "Unable to load this warband." : "Loading…"}
      </p>
    );
  }

  const variant = picked ?? (preset || template.variants[0]?.key || "");
  // on the web at the top of the right-hand column; on a phone above the figures, not under the lists
  const editButton = (
    <Button variant="secondary" className="min-h-10 self-start" onClick={onEdit}>
      Edit template
    </Button>
  );
  const terms = termsFor(template, variant);
  const heroes = template.fighters.filter((fighter) => fighter.kind === "hero");
  const henchmen = template.fighters.filter((fighter) => fighter.kind === "henchman");
  const card = (fighter: (typeof template.fighters)[number]) => (
    <TemplateFighterCard
      key={fighter.id}
      fighter={inVariant(fighter, variant)}
      template={template}
      variant={variant}
    />
  );

  return (
    <ReferenceDetail
      title={template.name}
      kind={[sourceLabel(template), template.source].filter(Boolean).join(" · ")}
      isMobile={isMobile}
      aside={
        <>
          {onEdit && !isMobile ? editButton : null}
          <TemplateLists template={template} variant={variant} />
          <TemplateUpgrades upgrades={template.upgrades} />
        </>
      }
    >
      {onEdit && isMobile ? editButton : null}
      <FactLine
        facts={[
          { label: "Starting gold", value: `${terms.gold} gc` },
          { label: "Warband size", value: terms.mostWarriors },
        ]}
      />
      {template.variants.length ? (
        <div role="group" aria-label="Variant" className="flex flex-wrap gap-1.5">
          {template.variants.map((entry) => (
            <Chip
              key={entry.key}
              pressed={entry.key === variant}
              onClick={() => setPicked(entry.key)}
            >
              {entry.name}
            </Chip>
          ))}
        </div>
      ) : null}
      <WarbandRules
        warbandName={template.name}
        rules={rulesFor(template, variant, typeId)}
        canEdit={false}
      />
      {heroes.length ? (
        <DetailSection title="Heroes">
          <div className="flex flex-col">{heroes.map(card)}</div>
        </DetailSection>
      ) : null}
      {henchmen.length ? (
        <DetailSection title="Henchmen">
          <div className="flex flex-col">{henchmen.map(card)}</div>
        </DetailSection>
      ) : null}
    </ReferenceDetail>
  );
}
