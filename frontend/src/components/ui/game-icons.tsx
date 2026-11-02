import type { IconType } from "react-icons";
import {
  GiBiceps,
  GiBleedingWound,
  GiBlunderbuss,
  GiBowArrow,
  GiBreastplate,
  GiBroadsword,
  GiChest,
  GiCrossedSwords,
  GiCrystalGrowth,
  GiCursedStar,
  GiDeathSkull,
  GiHorseHead,
  GiKnapsack,
  GiKnot,
  GiLightBackpack,
  GiPocketBow,
  GiPotionBall,
  GiRuneStone,
  GiScrollUnfurled,
  GiShop,
  GiSpellBook,
  GiSunbeams,
  GiSwapBag,
  GiTrade,
  GiTreasureMap,
  GiTwoCoins,
  GiUpgrade,
  GiWingfoot,
  GiYinYang,
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
  skills: GiRuneStone, // the special lists' icon (William: "match the special skill icon in the pills")
  specials: GiYinYang, // Boons & Banes: good and bad
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

/** A skill's list: the five core lists each have their own, every special list shares one. */
export type SkillList = "combat" | "shooting" | "academic" | "strength" | "speed" | "special";

export const SKILL_LIST_ICONS: Record<SkillList, IconType> = {
  combat: GiCrossedSwords,
  shooting: GiBowArrow,
  academic: GiScrollUnfurled,
  strength: GiBiceps,
  speed: GiWingfoot,
  special: GiRuneStone,
};

/** Boons & Banes: what a special is (the server's `kind`). */
export type SpecialKind = "boon" | "bane" | "trait";

export const SPECIAL_KIND_ICONS: Record<SpecialKind, IconType> = {
  boon: GiSunbeams,
  bane: GiCursedStar,
  trait: GiKnot,
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

/** A skill list's icon. */
export function SkillListIcon({ list, className }: { list: SkillList; className?: string }) {
  const Icon = SKILL_LIST_ICONS[list];
  return (
    <Icon aria-hidden="true" focusable="false" className={cn("h-4 w-4 shrink-0", className)} />
  );
}

/** A boon's, bane's or trait's icon (a special with no kind yet is a trait). */
export function SpecialKindIcon({
  kind,
  className,
}: {
  kind?: SpecialKind | null;
  className?: string;
}) {
  const Icon = SPECIAL_KIND_ICONS[kind ?? "trait"];
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
