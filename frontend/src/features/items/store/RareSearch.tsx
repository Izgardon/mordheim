import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import RollControl from "@/components/ui/roll-control";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { saveRarityRoll } from "../api/purchase";
import type { Item } from "../types/item-types";

/** A search made in the store: who searched (no hero: null), his 2D6, the bonus and the outcome. */
export type StoreSearch = {
  heroId: number | null;
  who: string;
  dice: number[];
  bonus: number;
  total: number;
  found: boolean;
};

type Searcher = { id: number | null; who: string };

const NO_HERO: Searcher = { id: null, who: "No hero" };
const LABEL = "text-xs font-bold text-muted-foreground";

type RareSearchProps = {
  warbandId: number;
  item: Item;
  rarity: number;
  /** Where the bonus starts: the warband's variant's (Marienburg +1, the Kurgan -1). */
  startBonus: number;
  searchers: { id: number; name: string; spent: boolean }[];
  /** The hero the store was opened for: he searches unless another is picked. */
  firstHeroId: number | null;
  search: StoreSearch | null;
  /** Nothing to search for (the item is free). */
  disabled: boolean;
  isMobile: boolean;
  /** The price each and Free, under Who searches. */
  price: ReactNode;
  onSearch: (search: StoreSearch) => void;
};

/**
 * A rare item's search (layout D, William, 7 Nov 2026: "i like 2 divided and without numbers but
 * also need an option to add bonus which i want to have +- buttons. i also want the roll button to
 * search to be prominent and blocked once searched"): on the left who searches (the heroes, a hero
 * whose trading action is spent still searching with the server's warning, and No hero) above the
 * price; on the right, under the rarity, what the search needs, the bonus (from the variant's,
 * −3 to +10) and Roll to search, its dice rolled here or typed in. The search is saved at once
 * (the hero spends his trading action and the roll is logged), then the button is locked as
 * Searched and the other searchers grey out: one search for the item.
 */
export default function RareSearch(props: RareSearchProps) {
  const queryClient = useQueryClient();
  const { search, searchers } = props;
  const [picked, setPicked] = useState<Searcher | null>(() => {
    if (search) return { id: search.heroId, who: search.who };
    const first = searchers.find((hero) => hero.id === props.firstHeroId);
    if (first) return { id: first.id, who: first.name };
    return searchers.length ? null : NO_HERO;
  });
  const [bonus, setBonus] = useState(search?.bonus ?? props.startBonus);
  const [saving, setSaving] = useState(false);
  const shut = Boolean(search) || saving || props.disabled;

  const take = async (dice: number[]) => {
    if (!picked) return;
    const roll = dice.reduce((sum, face) => sum + face, 0);
    const found = roll + bonus >= props.rarity;
    setSaving(true);
    try {
      await saveRarityRoll(queryClient, props.warbandId, {
        item_id: props.item.id,
        hero_id: picked.id,
        roll,
        modifier: bonus,
        rarity: `Rare ${props.rarity}`,
        success: found,
      });
      props.onSearch({
        heroId: picked.id,
        who: picked.who,
        dice,
        bonus,
        total: roll + bonus,
        found,
      });
    } catch (error) {
      toast.error("Couldn't save the search.", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const chip = (searcher: Searcher, label: ReactNode, title?: string) => {
    const mine = picked !== null && picked.id === searcher.id;
    return (
      <Chip
        key={searcher.id ?? "none"}
        pressed={mine}
        title={title}
        disabled={search ? !mine : shut}
        onClick={() => (search ? undefined : setPicked(searcher))}
        className={props.isMobile ? "min-h-10" : undefined}
      >
        {label}
      </Chip>
    );
  };
  const step = props.isMobile ? "h-10 w-10" : "h-8 w-8";

  return (
    <div
      className={cn(
        "grid",
        props.isMobile ? "grid-cols-1 gap-3" : "grid-cols-[minmax(0,1fr)_auto] gap-y-3"
      )}
    >
      <div className={cn("flex min-w-0 flex-col gap-3", !props.isMobile && "pr-4")}>
        <div role="group" aria-label="Who searches" className="flex flex-col gap-1.5">
          <span className={LABEL}>Who searches</span>
          <div className="flex flex-wrap gap-1.5">
            {searchers.map((hero) =>
              chip(
                { id: hero.id, who: hero.name },
                <>
                  {hero.name}
                  {hero.spent ? (
                    <span className="text-xs font-normal text-faint">(spent)</span>
                  ) : null}
                </>,
                hero.spent ? "His trading action is spent: he can still search" : undefined
              )
            )}
            {chip(NO_HERO, NO_HERO.who)}
          </div>
        </div>
        {props.price}
      </div>
      <div
        className={cn(
          "flex flex-col gap-2.5",
          props.isMobile ? "border-t border-line pt-3" : "items-end border-l border-line pl-4"
        )}
      >
        <span className="text-[13px] font-bold text-head">Need {props.rarity}+ on 2D6</span>
        <div role="group" aria-label="Search bonus" className="flex items-center gap-1.5">
          <span className={LABEL}>Bonus</span>
          <IconButton
            aria-label="Lower the bonus"
            className={step}
            disabled={shut || bonus <= -3}
            onClick={() => setBonus(bonus - 1)}
          >
            <Minus aria-hidden="true" />
          </IconButton>
          <span className="min-w-[30px] text-center font-mono text-sm font-bold text-head">
            {bonus > 0 ? `+${bonus}` : bonus}
          </span>
          <IconButton
            aria-label="Raise the bonus"
            className={step}
            disabled={shut || bonus >= 10}
            onClick={() => setBonus(bonus + 1)}
          >
            <Plus aria-hidden="true" />
          </IconButton>
        </div>
        <RollControl
          dice="2D6"
          label="Roll to search"
          lockedLabel="Searched"
          bonus={bonus}
          entry="link"
          faces={search?.dice ?? null}
          onResult={(dice) => void take(dice)}
          verdict={
            search ? (
              <span className={cn("font-bold", search.found ? "text-good" : "text-danger")}>
                {search.found ? "Found" : "Not found"}
              </span>
            ) : null
          }
          disabled={!picked || saving || props.disabled}
          size={props.isMobile ? "lg" : "default"}
          className={props.isMobile ? "items-stretch" : "items-end"}
        />
      </div>
    </div>
  );
}
