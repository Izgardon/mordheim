import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dices, Lock, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import DiceEntry, { boxName } from "@/components/ui/dice-entry";
import { IconButton } from "@/components/ui/icon-button";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { saveRarityRoll } from "../api/purchase";
import type { Item } from "../types/item-types";

/** A search made in the store: who searched (no hero: null), the 2D6, the bonus and the outcome. */
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
const SIDES = [6, 6];

type RareSearchProps = {
  warbandId: number;
  item: Item;
  rarity: number;
  /** Where the bonus starts: the warband's variant's (Marienburg +1, the Kurgan -1). */
  startBonus: number;
  searchers: { id: number; name: string; spent: boolean }[];
  /** The hero the store was opened for: they search unless another is picked. */
  firstHeroId: number | null;
  search: StoreSearch | null;
  /** Nothing to search for (the item is free). */
  disabled: boolean;
  isMobile: boolean;
  /**
   * No search (William, 7 Nov 2026: "add to basket is blocked unless someone has found it OR there
   * is a checkbox ... that says No Search"), under the search's row.
   */
  noSearch: { checked: boolean; onChange: (checked: boolean) => void };
  onSearch: (search: StoreSearch) => void;
};

/**
 * A rare item's search, above its price (William, 22 Nov 2026: "the rare roll section and
 * searching should appear above the pricing which isn't important unless it's found"): who
 * searches (the heroes, one whose trading action is spent still searching with the server's
 * warning, and No hero), the bonus (from the variant's, −3 to +10), then Search with a box for
 * each die beside it, which the roll fills or the dice rolled at the table are typed into, and the
 * total against what the item needs; No search under that row. The search is saved at once (the
 * hero spends their trading action and the roll is logged), then Search locks as Searched and the
 * other searchers grey out: one search for the item.
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
  const cannotRoll = !picked || saving || props.disabled || props.noSearch.checked;

  const take = async (dice: number[]) => {
    if (!picked || cannotRoll) return;
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
  const box = props.isMobile ? "h-12 w-12 text-xl" : "h-10 w-10 text-lg";
  const searchButton = (roll: () => void) => (
    <Button
      onClick={search ? undefined : roll}
      disabled={Boolean(search) || cannotRoll}
      variant={search ? "secondary" : "primary"}
      className={cn(
        props.isMobile ? "h-12 px-5" : "h-10",
        search && "border-border bg-raised text-muted-foreground disabled:opacity-100"
      )}
    >
      {search ? <Lock aria-hidden="true" /> : <Dices aria-hidden="true" />}
      {search ? "Searched" : "Search"}
    </Button>
  );

  return (
    <div className="flex flex-col gap-3">
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
              hero.spent ? "Their trading action is spent: they can still search" : undefined
            )
          )}
          {chip(NO_HERO, NO_HERO.who)}
        </div>
      </div>
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {search ? (
          <div className="flex items-center gap-2">
            {searchButton(() => undefined)}
            <span className="flex gap-1.5">
              {search.dice.map((face, index) => (
                <input
                  key={index}
                  readOnly
                  aria-label={boxName(SIDES, index)}
                  value={face}
                  className={cn(
                    "box-border border border-strong bg-page p-0 text-center font-mono font-bold text-head",
                    box
                  )}
                />
              ))}
            </span>
          </div>
        ) : (
          <DiceEntry
            dice="2D6"
            size={props.isMobile ? "lg" : "md"}
            className="flex-nowrap"
            disabled={cannotRoll}
            onFaces={(faces) => void take(faces)}
            button={searchButton}
          />
        )}
        <span role="status" className="flex flex-wrap items-baseline gap-1.5 text-sm">
          {search ? (
            <>
              <span className="font-mono font-bold text-head">
                {search.bonus ? `${search.bonus > 0 ? "+" : ""}${search.bonus} ` : ""}={" "}
                {search.total}
              </span>{" "}
              <span className={cn("font-bold", search.found ? "text-good" : "text-danger")}>
                {search.found ? "Found" : "Not found"}
              </span>{" "}
            </>
          ) : null}
          <span className="font-semibold text-text2">Need {props.rarity}+</span>
        </span>
      </div>
      <CheckboxField
        checked={props.noSearch.checked}
        onChange={(event) => props.noSearch.onChange(event.target.checked)}
        labelClassName="text-[13px]"
      >
        No search
      </CheckboxField>
    </div>
  );
}
