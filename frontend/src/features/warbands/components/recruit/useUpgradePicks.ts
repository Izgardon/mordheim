import { useState } from "react";

import type { TemplateUpgrade } from "../../types/hire-template-types";
import { overUpgradeMax, upgradePrice } from "./upgrade-draft";

const whole = (value: string) => Math.max(0, Math.trunc(Number(value) || 0));
const priceText = (price: number | null) => (price === null ? "" : String(price));

/** A picked upgrade as the tally shows it: its price (editable) and the warning past its group's most. */
export type UpgradePick = { upgrade: TemplateUpgrade; price: string; warning: string | null };

/**
 * The upgrades picked in a hire, in the order picked: the first of a group at its price, the
 * second and later at the later price (double for Mutations), each editable in the tally. A
 * price not yet edited follows when a pick before it in its group is dropped.
 */
export function useUpgradePicks(upgrades: TemplateUpgrade[]) {
  const [ids, setIds] = useState<number[]>([]);
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [edited, setEdited] = useState<number[]>([]);
  const byId = new Map(upgrades.map((upgrade) => [upgrade.id, upgrade]));
  const picked = ids.flatMap((id) => byId.get(id) ?? []);

  /** The prices once `next` is the picks: an edited one kept, the rest by their place in the group. */
  const repriced = (next: TemplateUpgrade[]) => {
    const seen = new Map<string, number>();
    return Object.fromEntries(
      next.map((upgrade) => {
        const held = seen.get(upgrade.group) ?? 0;
        seen.set(upgrade.group, held + 1);
        const kept = edited.includes(upgrade.id) ? prices[upgrade.id] : undefined;
        return [upgrade.id, kept ?? priceText(upgradePrice(upgrade, held))];
      })
    );
  };

  const toggle = (upgrade: TemplateUpgrade) => {
    const next = ids.includes(upgrade.id)
      ? picked.filter((entry) => entry.id !== upgrade.id)
      : [...picked, upgrade];
    setIds(next.map((entry) => entry.id));
    setPrices(repriced(next));
    setEdited(edited.filter((id) => next.some((entry) => entry.id === id)));
  };
  const setPrice = (id: number, value: string) => {
    setPrices({ ...prices, [id]: value });
    if (!edited.includes(id)) setEdited([...edited, id]);
  };

  const counts = new Map<string, number>();
  const picks: UpgradePick[] = picked.map((upgrade) => {
    const count = (counts.get(upgrade.group) ?? 0) + 1;
    counts.set(upgrade.group, count);
    return { upgrade, price: prices[upgrade.id] ?? "", warning: overUpgradeMax(upgrade, count) };
  });

  return {
    ids,
    picks,
    toggle,
    setPrice,
    /** How many of the group are picked, for the next one's price. */
    held: (group: string) => picked.filter((upgrade) => upgrade.group === group).length,
    total: picks.reduce((sum, pick) => sum + whole(pick.price), 0),
    unpriced: picks.some((pick) => pick.price.trim() === ""),
    /** The batch's `upgrades` for the hire (its create index 0). */
    lines: (createIndex = 0) =>
      picks.map((pick) => ({
        create_index: createIndex,
        upgrade_id: pick.upgrade.id,
        price: whole(pick.price),
      })),
  };
}

export type UpgradePicks = ReturnType<typeof useUpgradePicks>;
