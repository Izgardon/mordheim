import type { IconType } from "react-icons";
import {
  GiBeamsAura,
  GiBiceps,
  GiBlunderbuss,
  GiBowArrow,
  GiBreastplate,
  GiBroadsword,
  GiCheckedShield,
  GiChest,
  GiCrossedSwords,
  GiCrystalGrowth,
  GiDeathSkull,
  GiHorseHead,
  GiKnapsack,
  GiLaurels,
  GiLightBackpack,
  GiMuscleUp,
  GiPocketBow,
  GiPotionBall,
  GiRuneStone,
  GiScrollUnfurled,
  GiShop,
  GiSpellBook,
  GiSpikedTentacle,
  GiStitchedWound,
  GiSwapBag,
  GiThreeFriends,
  GiTombstone,
  GiTrade,
  GiTreasureMap,
  GiTrophyCup,
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
  // the info lines: the warband's (Rating, Gold, Units, Record) and the overview's stats
  rating: GiLaurels,
  units: GiThreeFriends,
  record: GiTrophyCup,
  battles: GiCrossedSwords,
  warbands: GiCheckedShield,
  lost: GiTombstone,
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

/** Boons & Banes: whether a special helps the unit, holds it back or neither (the server's `kind`). */
export type SpecialKind = "boon" | "bane" | "trait";

/** What a special is (the server's `category`), which picks its icon. */
export type SpecialCategory = "injury" | "mutation" | "aura" | "body";

export const SPECIAL_CATEGORY_ICONS: Record<SpecialCategory, IconType> = {
  injury: GiStitchedWound,
  mutation: GiSpikedTentacle,
  aura: GiBeamsAura,
  body: GiMuscleUp,
};

/** The colour a special's kind gives its icon: a boon gold, a bane red, a trait the ink. */
export const SPECIAL_KIND_COLOURS: Record<SpecialKind, string> = {
  boon: "text-kind-special",
  bane: "text-danger",
  trait: "text-ink",
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

/**
 * A special's icon: its category's, in its kind's colour (one with neither yet is an aura and a
 * trait, as the server's defaults are).
 */
export function SpecialIcon({
  category,
  kind,
  className,
}: {
  category?: SpecialCategory | null;
  kind?: SpecialKind | null;
  className?: string;
}) {
  const Icon = SPECIAL_CATEGORY_ICONS[category ?? "aura"];
  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      className={cn("h-4 w-4 shrink-0", SPECIAL_KIND_COLOURS[kind ?? "trait"], className)}
    />
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
