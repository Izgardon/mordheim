import type { IconType } from "react-icons";
import {
  GiBleedingWound,
  GiBlunderbuss,
  GiBreastplate,
  GiBroadsword,
  GiChest,
  GiCrystalGrowth,
  GiDeathSkull,
  GiHorseHead,
  GiKnapsack,
  GiLightBackpack,
  GiPocketBow,
  GiPotionBall,
  GiShop,
  GiSkills,
  GiSpellBook,
  GiStarMedal,
  GiSwapBag,
  GiTrade,
  GiTreasureMap,
  GiTwoCoins,
  GiUpgrade,
} from "react-icons/gi";

import { cn } from "@/lib/utils";

/**
 * Every fantasy icon the app shows, from Game Icons (game-icons.net, CC BY 3.0: `GameIconsCredit` is the
 * attribution). One file holds every choice, so a swap is one edit; plain controls
 * (chevrons, close, plus and minus, search) stay lucide.
 */
export const GAME_ICONS = {
  store: GiShop,
  stash: GiChest,
  locations: GiTreasureMap,
  gold: GiTwoCoins,
  wyrdstone: GiCrystalGrowth,
  kills: GiDeathSkull,
  xp: GiUpgrade,
  items: GiKnapsack,
  loadout: GiLightBackpack,
  skills: GiSkills,
  specials: GiStarMedal,
  spells: GiSpellBook,
  injuries: GiBleedingWound,
} satisfies Record<string, IconType>;

export type GameIconName = keyof typeof GAME_ICONS;

/** What an item is (`features/items/item-kind.ts` maps an item's type and subtype to one). */
export type ItemKind =
  | "melee"
  | "missile"
  | "blackpowder"
  | "armour"
  | "animal"
  | "consumable"
  | "trade"
  | "misc";

export const ITEM_KIND_ICONS: Record<ItemKind, IconType> = {
  melee: GiBroadsword,
  missile: GiPocketBow,
  blackpowder: GiBlunderbuss,
  armour: GiBreastplate,
  animal: GiHorseHead,
  consumable: GiPotionBall,
  trade: GiTrade,
  misc: GiSwapBag,
};

/** A game icon at the text's size and colour (the tokens), hidden from screen readers. */
export function GameIcon({ name, className }: { name: GameIconName; className?: string }) {
  const Icon = GAME_ICONS[name];
  return (
    <Icon aria-hidden="true" focusable="false" className={cn("h-4 w-4 shrink-0", className)} />
  );
}

/** An item's kind icon. */
export function ItemKindIcon({ kind, className }: { kind: ItemKind; className?: string }) {
  const Icon = ITEM_KIND_ICONS[kind];
  return (
    <Icon aria-hidden="true" focusable="false" className={cn("h-4 w-4 shrink-0", className)} />
  );
}

const CREDIT_LINK = "font-semibold text-text2 underline-offset-2 hover:text-head hover:underline";

/** The attribution CC BY 3.0 asks for, small and out of the way (the landing page, Account). */
export function GameIconsCredit({ className }: { className?: string }) {
  return (
    <p className={cn("m-0 text-xs text-faint", className)}>
      Icons by Lorc, Delapouite and contributors,{" "}
      <a
        href="https://game-icons.net"
        target="_blank"
        rel="noopener noreferrer"
        className={CREDIT_LINK}
      >
        game-icons.net
      </a>
      ,{" "}
      <a
        href="https://creativecommons.org/licenses/by/3.0/"
        target="_blank"
        rel="noopener noreferrer"
        className={CREDIT_LINK}
      >
        CC BY 3.0
      </a>
    </p>
  );
}
