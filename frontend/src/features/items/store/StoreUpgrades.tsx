import { cn } from "@/lib/utils";
import {
  AT_RECRUIT,
  groupNote,
  overUpgradeMax,
  upgradeGroups,
  upgradePrice,
  upgradePriceText,
} from "@/features/warbands/components/recruit/upgrade-draft";
import type { TemplateUpgrade } from "@/features/warbands/types/hire-template-types";

/** One he already has, or has only in the basket (buying it again links it twice). */
const HAS_IT = "He has it already.";
const IN_BASKET = "In the basket.";

/**
 * Upgrades in the store (the templates plan, phase 3), buying for a hero from the template: his
 * template's upgrades by group, each at what it costs him next (the second and later of a group
 * at double where the book says), with its warnings: one his `who` doesn't allow dimmed with the
 * reason, past his group's most, and "Bought only when recruited."; Get puts it in the basket,
 * where its price can be changed. How the Marauder leader gets his Mark later.
 */
export default function StoreUpgrades({
  upgrades,
  offUpgrades,
  held,
  holds,
  canBuy,
  isMobile,
  onGet,
}: {
  upgrades: TemplateUpgrade[];
  offUpgrades: number[];
  /** How many of the group he has, his specials and the basket's lines for him. */
  held: (group: string) => number;
  /** Where he holds the upgrade: "his" (its special), "basket" (only there), or null. */
  holds: (upgrade: TemplateUpgrade) => "his" | "basket" | null;
  canBuy: boolean;
  isMobile: boolean;
  onGet: (upgrade: TemplateUpgrade, price: number) => void;
}) {
  if (!upgrades.length) return null;
  return (
    <section aria-label="Upgrades" className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">Upgrades</span>
      {upgradeGroups(upgrades).map(([group, members]) => (
        <ul
          key={group}
          aria-label={group}
          className="m-0 flex list-none flex-col border-t border-line p-0"
        >
          <li className="pt-2 text-xs font-bold text-muted-foreground">{group}</li>
          {groupNote(members) ? (
            <li className="text-xs text-muted-foreground">{groupNote(members)}</li>
          ) : null}
          {members.map((upgrade) => {
            const count = held(group);
            const price = upgradePrice(upgrade, count);
            const off = offUpgrades.includes(upgrade.id) ? upgrade.who_text : "";
            const where = holds(upgrade);
            const warnings = [
              where === "his" ? HAS_IT : where === "basket" ? IN_BASKET : "",
              off,
              // one in the basket is counted already: Buy all gives him `count`
              overUpgradeMax(upgrade, where === "basket" ? count : count + 1) ?? "",
              upgrade.at_recruit ? AT_RECRUIT : "",
            ].filter(Boolean);
            return (
              <li key={upgrade.id} className="flex items-center gap-3 border-b border-line py-2.5">
                <div className={cn("flex min-w-0 flex-1 flex-col gap-px")}>
                  <span className={cn("font-bold text-ink", off && "opacity-60")}>
                    {upgrade.name}
                  </span>
                  {warnings.map((text) => (
                    <span key={text} className="text-xs font-semibold text-danger">
                      {text}
                    </span>
                  ))}
                </div>
                <span
                  className={cn(
                    "shrink-0 font-mono text-sm font-bold text-head",
                    off && "opacity-60"
                  )}
                >
                  {upgradePriceText(price)}
                </span>
                {canBuy ? (
                  <button
                    type="button"
                    aria-label={`Get ${upgrade.name}`}
                    onClick={() => onGet(upgrade, price ?? 0)}
                    className={cn(
                      "shrink-0 border border-accent-line bg-accent-soft px-3 text-[13px] font-bold text-accent-hi",
                      isMobile ? "min-h-11 min-w-16" : "min-h-10 min-w-[72px]"
                    )}
                  >
                    Get
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ))}
    </section>
  );
}
