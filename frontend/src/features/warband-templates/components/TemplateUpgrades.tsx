import type { SpecialKind } from "@/components/ui/game-icons";
import { DetailSection, RuleBlock } from "@/features/reference/ReferenceDetail";

import type { TemplateUpgrade } from "../types/template-types";

const price = (upgrade: TemplateUpgrade) =>
  upgrade.cost === 0
    ? "free"
    : upgrade.cost !== null
      ? `${upgrade.cost} gc`
      : upgrade.cost_note || "";

/**
 * The template's upgrades (Mutations, Marks of Chaos, Blessings of Nurgle), by group, each with
 * its special's icon, and who takes each.
 */
export default function TemplateUpgrades({ upgrades }: { upgrades: TemplateUpgrade[] }) {
  const groups = [...new Set(upgrades.map((upgrade) => upgrade.group))];
  return (
    <>
      {groups.map((group) => (
        <DetailSection key={group} title={group}>
          <div className="flex flex-col gap-2.5">
            {upgrades
              .filter((upgrade) => upgrade.group === group)
              .map((upgrade) => (
                <RuleBlock
                  key={upgrade.id}
                  kind={upgrade.kind as SpecialKind}
                  category={upgrade.category}
                  name={
                    <span className="flex w-full items-baseline justify-between gap-3">
                      {upgrade.name}
                      <span className="font-mono text-[13px] font-normal text-ink">
                        {price(upgrade)}
                      </span>
                    </span>
                  }
                >
                  {upgrade.who_text ? (
                    <span className="block text-xs text-muted-foreground">{upgrade.who_text}</span>
                  ) : null}
                  {upgrade.description}
                </RuleBlock>
              ))}
          </div>
        </DetailSection>
      ))}
    </>
  );
}
