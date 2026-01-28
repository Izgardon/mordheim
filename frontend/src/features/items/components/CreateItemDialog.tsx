import type { ReactNode } from "react";

import ItemFormDialog from "./ItemFormDialog";

import type { Item } from "../types/item-types";

type CreateItemDialogProps = {
  campaignId: number;
  onCreated: (item: Item) => void;
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

const initialState: ItemFormState = {
  name: "",
  type: "",
  subtype: "",
  cost: "",
  variable: "",
  singleUse: false,
  rarity: "",
  uniqueTo: "",
  description: "",
  strength: "",
  range: "",
  save: "",
  statblock: createEmptyStatblock(),
};

const itemTypeOptions = ["Weapon", "Armour", "Animal", "Miscellaneous"];
const itemSubtypeOptions: Record<string, string[]> = {
  Weapon: ["Melee", "Ranged", "Blackpowder"],
  Armour: ["Armour", "Shield", "Helmet", "Barding"],
  Animal: ["Mount", "Attack"],
};

export default function CreateItemDialog({
  campaignId,
  onCreated,
  trigger,
  open: openProp,
  onOpenChange,
}: CreateItemDialogProps) {
  return (
    <ItemFormDialog
      mode="create"
      campaignId={campaignId}
      onCreated={onCreated}
      trigger={trigger}
      open={openProp}
      onOpenChange={onOpenChange}
    />
  );
}
