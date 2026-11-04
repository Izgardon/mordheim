import { useState } from "react";

import { Chip } from "@/components/ui/chip";
import { DetailSection, FactLine, ReferenceDetail } from "@/features/reference/ReferenceDetail";
import WarbandRules from "@/features/warbands/components/rules/WarbandRules";

import { useWarbandTemplate } from "../api/template-queries";
import { rulesFor } from "../template-view";
import TemplateFighterCard from "./TemplateFighterCard";
import TemplateLists from "./TemplateLists";
import TemplateUpgrades from "./TemplateUpgrades";

type TemplateDetailProps = {
  campaignId: number;
  templateId: number;
  /** The variant the row's warband type always is; "" when the player picks one. */
  preset: string;
  isMobile: boolean;
};

/**
 * An open row of the Warbands page: the template's starting gold and most warriors, its variant
 * switch (the type's own variant first), its rule pills (the warband sheet's rules modal), its
 * heroes and henchmen, and, beside them, its equipment lists and upgrades.
 */
export default function TemplateDetail({
  campaignId,
  templateId,
  preset,
  isMobile,
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
  const heroes = template.fighters.filter((fighter) => fighter.kind === "hero");
  const henchmen = template.fighters.filter((fighter) => fighter.kind === "henchman");
  const card = (fighter: (typeof template.fighters)[number]) => (
    <TemplateFighterCard key={fighter.id} fighter={fighter} template={template} variant={variant} />
  );

  return (
    <ReferenceDetail
      title={template.name}
      kind={template.source}
      isMobile={isMobile}
      aside={
        <>
          <TemplateLists template={template} />
          <TemplateUpgrades upgrades={template.upgrades} />
        </>
      }
    >
      <FactLine
        facts={[
          { label: "Starting gold", value: `${template.gold} gc` },
          { label: "Most warriors", value: template.most_warriors },
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
        rules={rulesFor(template, variant)}
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
