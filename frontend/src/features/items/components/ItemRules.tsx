import { RuleBlock } from "@/features/reference/ReferenceDetail";
import { ProfileStrip } from "@/features/reference/profile";

import type { Item, ItemAvailability, RuleTable } from "../types/item-types";
import { priceLabel, rarityLabel } from "../utils/item-prices";
import { beastOf } from "../utils/item-listing";
import { beastSpecials } from "../utils/item-rules";
import ItemRuleBlock, { RuleTableView } from "./ItemRuleBlock";

const PROFILE = ["profile", "m", "ws", "bs", "s", "t", "w", "i", "a", "ld"];
const PROFILE_LABELS = ["Profile", "M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"];

/** A vehicle's or an animal's profile rows (the item's statblock JSON) as a table; null without. */
function statblockTable(statblock: string | null | undefined): RuleTable | null {
  if (!statblock) return null;
  try {
    const rows = JSON.parse(statblock) as Record<string, string>[];
    if (!Array.isArray(rows) || !rows.length) return null;
    return {
      columns: PROFILE_LABELS,
      rows: rows.map((row) => PROFILE.map((key) => String(row[key] ?? ""))),
    };
  } catch {
    return null;
  }
}

/** An item's figures for a `FactLine`: range, strength and save, the price row's cost and rarity. */
export function itemFacts(item: Item, row: ItemAvailability | null) {
  return [
    ...(item.range ? [{ label: "Range", value: item.range }] : []),
    ...(item.strength ? [{ label: "Strength", value: item.strength }] : []),
    ...(item.save ? [{ label: "Save", value: item.save }] : []),
    ...(row ? [{ label: "Cost", value: priceLabel(row) }] : []),
    ...(row ? [{ label: "Rarity", value: rarityLabel(row.rarity) }] : []),
  ];
}

/**
 * An item's rules as its Wargear card reads them: a beast's profile or a vehicle's statblock, each
 * rule (a shared one tagged "shared rule", the item's own unnamed one under the item's name) with
 * its summary and D6 tables; a beast's specials only when its item has no rules, since the item's
 * are the same rules again (William, 22 Nov 2026: "I just need the top version").
 */
export default function ItemRules({ item }: { item: Item }) {
  const beast = beastOf(item);
  const profile = beast?.has_profile ? beast : null;
  const table = profile ? null : statblockTable(item.statblock);
  const rules = item.rules ?? [];
  const specials = beastSpecials(item);
  return (
    <>
      {profile ? <ProfileStrip profile={profile} /> : null}
      {table ? <RuleTableView table={table} /> : null}
      {rules.length || specials.length ? (
        <div className="flex flex-col gap-2.5">
          {rules.map((rule) => (
            <ItemRuleBlock key={rule.id} rule={rule} itemName={item.name} />
          ))}
          {specials.map((special) => (
            <RuleBlock key={`special-${special.id}`} name={special.name}>
              {special.description}
            </RuleBlock>
          ))}
        </div>
      ) : null}
    </>
  );
}
