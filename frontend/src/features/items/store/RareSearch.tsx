import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import DiceEntry from "@/components/ui/dice-entry";
import { rollDice } from "@/lib/dice";
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

/** "Aldric rolled 4 + 3, +1 bonus = 8. Found one." */
export function searchText(search: StoreSearch) {
  const bonus = search.bonus ? `, ${search.bonus > 0 ? "+" : ""}${search.bonus} bonus` : "";
  const who = search.heroId === null ? "Rolled" : `${search.who} rolled`;
  return `${who} ${search.dice.join(" + ")}${bonus} = ${search.total}. ${search.found ? "Found one." : "None found."}`;
}

/**
 * A rare item's search (design E): boxes for the 2D6 rolled at the table, then one button per hero
 * (a hero whose trading action is spent still searches, with the server's warning) and No hero,
 * then Buy without searching. Each search takes the dice typed in, else rolls 2D6 here, and is
 * saved at once (today's rarity roll: the hero spends his trading action and the roll is logged);
 * the result line says whether one was found.
 */
export default function RareSearch(props: {
  warbandId: number;
  item: Item;
  rarity: number;
  bonus: number;
  searchers: { id: number; name: string; spent: boolean }[];
  search: StoreSearch | null;
  skipped: boolean;
  isMobile: boolean;
  onSearch: (search: StoreSearch) => void;
  onSkip: () => void;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  /** The 2D6 typed in, until a search takes them. */
  const [typed, setTyped] = useState<(number | null)[]>([null, null]);
  const { search } = props;
  const entered = typed.every((face) => face !== null) ? (typed as number[]) : null;
  const halfTyped = !entered && typed.some((face) => face !== null);

  const searchWith = async (heroId: number | null, who: string) => {
    const dice = entered ?? rollDice(2);
    const total = dice[0] + dice[1] + props.bonus;
    const found = total >= props.rarity;
    setSaving(true);
    try {
      await saveRarityRoll(queryClient, props.warbandId, {
        item_id: props.item.id,
        hero_id: heroId,
        roll: dice[0] + dice[1],
        modifier: props.bonus,
        rarity: `Rare ${props.rarity}`,
        success: found,
      });
      props.onSearch({ heroId, who, dice, bonus: props.bonus, total, found });
      setTyped([null, null]);
    } catch (error) {
      toast.error("Couldn't save the search.", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const button = cn(
    "border px-3 text-[13px] font-semibold disabled:opacity-50",
    props.isMobile ? "min-h-10" : "min-h-9"
  );
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <DiceEntry
          dice="2D6"
          size={props.isMobile ? "md" : "sm"}
          className="mr-1"
          total={entered ? entered[0] + entered[1] : null}
          disabled={saving}
          onChange={setTyped}
          onFaces={setTyped}
          button={null}
        />
        {props.searchers.map((hero) => (
          <button
            key={hero.id}
            type="button"
            disabled={saving || halfTyped}
            title={hero.spent ? "His trading action is spent: he can still search" : undefined}
            onClick={() => void searchWith(hero.id, hero.name)}
            className={cn(button, "border-accent-line bg-page text-accent-hi hover:bg-accent-soft")}
          >
            {hero.name}
            {hero.spent ? (
              <span className="ml-1 text-xs font-normal text-faint">(spent)</span>
            ) : null}
          </button>
        ))}
        <button
          type="button"
          disabled={saving || halfTyped}
          onClick={() => void searchWith(null, "No hero")}
          className={cn(button, "border-accent-line bg-page text-accent-hi hover:bg-accent-soft")}
        >
          No hero
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={props.onSkip}
          className={cn(button, "border-border text-muted-foreground hover:text-ink")}
        >
          {props.isMobile ? "Skip search" : "Buy without searching"}
        </button>
      </div>
      {search || props.skipped ? (
        <span
          role="status"
          className={cn(
            "text-[13px] font-bold",
            props.skipped || search?.found ? "text-good" : "text-danger"
          )}
        >
          {props.skipped || !search ? "Buying without a search" : searchText(search)}
        </span>
      ) : null}
    </>
  );
}
