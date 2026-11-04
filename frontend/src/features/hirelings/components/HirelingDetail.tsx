import { Button } from "@/components/ui/button";
import { whoLine } from "@/features/items/utils/item-prices";
import type { HireAccess } from "@/features/items/types/item-types";
import {
  DetailSection,
  FactLine,
  Flavour,
  ReferenceDetail,
  RuleBlock,
  TagList,
} from "@/features/reference/ReferenceDetail";
import { ProfileStrip } from "@/features/reference/profile";

import { formatFee } from "../fees";
import { hirelingRace, type HirelingCatalogueConfig } from "../hireling-catalogue-kinds";
import { useHirelingProfileDetail } from "../hooks/useHirelingProfileDetail";
import type { HirelingProfile } from "../types/hireling-catalogue-types";
import { personaTermsLine } from "../utils/hireling-display";

type HirelingDetailProps = {
  config: HirelingCatalogueConfig;
  campaignId: number;
  entry: HirelingProfile;
  /** Whether your warband can usually hire him (the server's who-can/), when you have one. */
  access?: HireAccess;
  isMobile: boolean;
  onHire?: () => void;
  onEdit?: () => void;
};

/**
 * The open entry: profile, terms, who can hire him (the items rebuild: warband types and groups,
 * with the book's sentence, and whether your warband usually can), his rules and kit (read on
 * opening), Hire from here and Edit.
 */
export default function HirelingDetail(props: HirelingDetailProps) {
  const { config, entry, access } = props;
  const detail = useHirelingProfileDetail(config.kind, props.campaignId, entry.id);
  const full = detail.entry;
  const terms = config.hasPersonaTerms ? personaTermsLine(entry) : "";
  const rules = full
    ? [
        ...full.specials.map((special) => ({ key: `special-${special.id}`, ...special })),
        ...full.skills.map((skill) => ({ key: `skill-${skill.id}`, ...skill })),
        ...full.spells.map((spell) => ({
          key: `spell-${spell.id}`,
          ...spell,
          description: spell.description ?? "",
        })),
      ]
    : [];
  const aside = (
    <>
      {props.onHire ? (
        <Button className="min-h-11 w-full" onClick={props.onHire}>
          Hire from here
        </Button>
      ) : null}
      <DetailSection title="Who can hire">
        <span className="text-[13px] text-ink">{whoLine(entry)}</span>
        {entry.hire_note ? (
          <span className="text-xs italic text-text2">{entry.hire_note}</span>
        ) : null}
        {access && !access.can_hire ? (
          <span className="text-xs font-semibold text-danger">{access.reason}</span>
        ) : null}
      </DetailSection>
      {entry.available_skill_types.length ? (
        <DetailSection title="Skill groups">
          <TagList tags={entry.available_skill_types.map((type) => ({ label: type }))} />
        </DetailSection>
      ) : null}
      {full?.equipment.length ? (
        <DetailSection title="Carries">
          <TagList
            tags={full.equipment.map(({ item, quantity }) => ({
              label: quantity > 1 ? `${item.name} ×${quantity}` : item.name,
            }))}
          />
        </DetailSection>
      ) : null}
      {entry.grade ? (
        <DetailSection title="Source">
          <span className="text-[13px] text-ink">Grade {entry.grade}</span>
        </DetailSection>
      ) : null}
      {props.onEdit ? (
        <Button variant="secondary" className="min-h-10 self-start" onClick={props.onEdit}>
          Edit {config.labels.noun}
        </Button>
      ) : null}
    </>
  );
  return (
    <ReferenceDetail
      title={entry.name}
      kind={hirelingRace(entry)}
      isMobile={props.isMobile}
      aside={aside}
    >
      {entry.description?.trim() ? <Flavour>{entry.description}</Flavour> : null}
      <FactLine
        facts={[
          { label: "Hire fee", value: formatFee(entry.hire_fee) },
          { label: "Upkeep", value: formatFee(entry.upkeep_fee) },
          ...[entry.hire_fee?.note, entry.upkeep_fee?.note]
            .filter((note): note is string => Boolean(note))
            .map((note) => ({ label: "Note", value: note })),
          ...(entry.rating !== null ? [{ label: "Rating", value: `+${entry.rating}` }] : []),
          ...(terms ? [{ label: "Terms", value: terms }] : []),
        ]}
      />
      <ProfileStrip profile={entry} />
      {detail.error && !full ? <p className="m-0 text-sm text-danger">{detail.error}</p> : null}
      {!full && !detail.error ? (
        <span className="text-[13px] text-muted-foreground">Reading his rules…</span>
      ) : null}
      {rules.length ? (
        <div className="flex flex-col gap-2.5">
          {rules.map((rule) => (
            <RuleBlock
              key={rule.key}
              name={rule.name}
              kind={"kind" in rule ? rule.kind : undefined}
            >
              {rule.description}
            </RuleBlock>
          ))}
        </div>
      ) : null}
    </ReferenceDetail>
  );
}
