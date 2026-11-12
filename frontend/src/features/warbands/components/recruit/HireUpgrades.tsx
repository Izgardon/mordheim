import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

import type { TemplateUpgrade } from "../../types/hire-template-types";
import { groupNote, upgradeGroups, upgradePrice } from "./upgrade-draft";
import type { UpgradePicks } from "./useUpgradePicks";

/** "50 gc", "free" (the Marks), or "· price to type" where the book gives none: as the kit's chips read. */
const chipPrice = (price: string) =>
  price.trim() === "" ? "· price to type" : Number(price) === 0 ? "free" : `${price} gc`;

/**
 * A hero's upgrades in a hire (the templates plan, phase 3): his template's Mutations, Blessings,
 * Sacred markings or Marks by group, before and after the first battle, each at what it would
 * cost him next (the second and later of a group at double where the book says); one he isn't
 * meant to take dimmed with the reason, still pickable. A pick is a line of the tally.
 */
export default function HireUpgrades({
  upgrades,
  offUpgrades,
  picks,
}: {
  upgrades: TemplateUpgrade[];
  /** The upgrades his `who` doesn't allow. */
  offUpgrades: number[];
  picks: UpgradePicks;
}) {
  if (!upgrades.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-muted-foreground">Upgrades</span>
      {upgradeGroups(upgrades).map(([group, members]) => (
        <div key={group} role="group" aria-label={group} className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
            {group}
          </span>
          {groupNote(members) ? (
            <span className="text-xs text-muted-foreground">{groupNote(members)}</span>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {members.map((upgrade) => {
              const pick = picks.picks.find((entry) => entry.upgrade.id === upgrade.id);
              const pressed = pick !== undefined;
              const off = offUpgrades.includes(upgrade.id);
              const price = pick
                ? pick.price
                : String(upgradePrice(upgrade, picks.held(group)) ?? "");
              return (
                <Chip
                  key={upgrade.id}
                  pressed={pressed}
                  className={cn(off && "opacity-60")}
                  title={off ? upgrade.who_text : undefined}
                  onClick={() => picks.toggle(upgrade)}
                >
                  {upgrade.name} {chipPrice(price)}
                  {off ? (
                    <span className="text-[11px] font-normal">({upgrade.who_text})</span>
                  ) : null}
                </Chip>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
