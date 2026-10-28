import { CardBackground } from "@/components/ui/card-background";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DETAIL_CHIP_CLASS,
  DetailSection,
} from "@/features/bestiary/components/detail/entry-detail-parts";
import DetailCardContent from "@/features/warbands/components/shared/unit_details/DetailCardContent";

import type { DetailEntry } from "@/features/warbands/components/shared/unit_details/detail-types";
import type { HirelingProfileDetail } from "../types/hireling-catalogue-types";

/** A linked skill, rule, spell or item: a chip whose text opens in a tooltip. */
function DetailChip({ label, entry }: { label: string; entry: DetailEntry }) {
  return (
    <Tooltip
      trigger={<span className={DETAIL_CHIP_CLASS}>{label}</span>}
      content={
        <CardBackground className="surface-panel-strong max-h-[40vh] overflow-y-auto p-5 text-foreground shadow-xl">
          <DetailCardContent entry={entry} />
        </CardBackground>
      }
      contentClassName="fixed z-[60] max-h-[40vh] overflow-visible bg-transparent p-0 shadow-none"
      minWidth={320}
      maxWidth={320}
      maxHeight="40vh"
    />
  );
}

/** What the entry knows and carries: skills and special rules, spells, and its kit with quantities. */
export default function HirelingDetailLinks({ entry }: { entry: HirelingProfileDetail }) {
  return (
    <>
      {entry.skills.length > 0 || entry.specials.length > 0 ? (
        <DetailSection title="Skills & Special Rules">
          {entry.skills.map((skill) => (
            <DetailChip
              key={`skill-${skill.id}`}
              label={skill.name}
              entry={{ id: skill.id, type: "skill", name: skill.name }}
            />
          ))}
          {entry.specials.map((special) => (
            <DetailChip
              key={`special-${special.id}`}
              label={special.name}
              entry={{ id: special.id, type: "special", name: special.name }}
            />
          ))}
        </DetailSection>
      ) : null}

      {entry.spells.length > 0 ? (
        <DetailSection title="Spells">
          {entry.spells.map((spell) => (
            <DetailChip
              key={`spell-${spell.id}`}
              label={spell.name}
              entry={{ id: spell.id, type: "spell", name: spell.name }}
            />
          ))}
        </DetailSection>
      ) : null}

      {entry.equipment.length > 0 ? (
        <DetailSection title="Equipment">
          {entry.equipment.map(({ item, quantity }) => (
            <DetailChip
              key={`item-${item.id}`}
              label={`${item.name}${quantity > 1 ? ` x${quantity}` : ""}`}
              entry={{ id: item.id, type: "item", name: item.name }}
            />
          ))}
        </DetailSection>
      ) : null}
    </>
  );
}
