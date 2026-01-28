import type { ReactNode } from "react";

import ItemFormDialog from "./ItemFormDialog";

import type { Item } from "../types/item-types";

type EditItemDialogProps = {
  item: Item;
  onUpdated: (item: Item) => void;
  onDeleted: (itemId: number) => void;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ItemFormState = {
  name: string;
  type: string;
  subtype: string;
  cost: string;
  variable: string;
  singleUse: boolean;
  rarity: string;
  uniqueTo: string;
  description: string;
  strength: string;
  range: string;
  save: string;
  statblock: StatblockState;
};

const STAT_KEYS = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"] as const;
type StatKey = (typeof STAT_KEYS)[number];
type StatblockState = Record<StatKey, string>;

const createEmptyStatblock = (): StatblockState =>
  STAT_KEYS.reduce<StatblockState>(
    (acc, key) => ({ ...acc, [key]: "" }),
    {
      M: "",
      WS: "",
      BS: "",
      S: "",
      T: "",
      W: "",
      I: "",
      A: "",
      Ld: "",
    }
  );

const parseStatblock = (statblock?: string | null): StatblockState => {
  const empty = createEmptyStatblock();
  if (!statblock) {
    return empty;
  }

  try {
    const parsed = JSON.parse(statblock) as Record<string, string | number>;
    return STAT_KEYS.reduce(
      (acc, key) => ({
        ...acc,
        [key]: parsed?.[key] !== undefined ? String(parsed[key]) : "",
      }),
      empty
    );
  } catch {
    const entries = statblock.split(",").map((entry) => entry.trim());
    const next = { ...empty };
    entries.forEach((entry) => {
      const match = entry.match(/^([A-Za-z]+)\s*:\s*(.+)$/);
      if (!match) {
        return;
      }
      const key = match[1].toUpperCase();
      const value = match[2].trim();
      if (STAT_KEYS.includes(key as StatKey)) {
        next[key as StatKey] = value;
      }
    });
    return next;
  }
};

const itemTypeOptions = ["Weapon", "Armour", "Animal", "Miscellaneous"];
const itemSubtypeOptions: Record<string, string[]> = {
  Weapon: ["Melee", "Ranged", "Blackpowder"],
  Armour: ["Armour", "Shield", "Helmet", "Barding"],
  Animal: ["Mount", "Attack"],
};

export default function EditItemDialog({
  item,
  onUpdated,
  onDeleted,
  trigger,
  open: openProp,
  onOpenChange,
}: EditItemDialogProps) {
  return (
    <ItemFormDialog
      mode="edit"
      item={item}
      campaignId={item.campaign_id ?? 0}
      onUpdated={onUpdated}
      onDeleted={onDeleted}
      trigger={trigger}
      open={openProp}
      onOpenChange={onOpenChange}
    />
  );
}
