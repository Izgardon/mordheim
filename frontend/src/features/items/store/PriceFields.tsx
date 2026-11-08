import { Dices } from "lucide-react";

import { CheckboxField } from "@/components/ui/checkbox";
import DiceEntry from "@/components/ui/dice-entry";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { cn } from "@/lib/utils";

import type { Item, ItemAvailability } from "../types/item-types";
import { diceLabel } from "../utils/item-prices";

const LABEL = "flex flex-col gap-1 text-xs font-bold text-muted-foreground";

type PriceFieldsProps = {
  item: Item;
  row: ItemAvailability;
  price: string;
  rolled: number | null;
  free: boolean;
  reason: string;
  isMobile: boolean;
  /** In a rare item's left column: Free beside the price, not at the row's end. */
  inColumn?: boolean;
  onPrice: (text: string) => void;
  onRoll: (faces: number[]) => void;
  onFree: (free: boolean) => void;
  onReason: (text: string) => void;
};

/**
 * The price of one item in the store: the price each, prefilled and editable; a price with dice
 * ("25 + 2D6") rolled with the button or typed in its boxes; Free, for an item found or given,
 * with why.
 */
export default function PriceFields({ item, row, ...props }: PriceFieldsProps) {
  return (
    <>
      <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2.5">
        <label className={LABEL}>
          {props.isMobile ? "Price each" : "Price each (gc)"}
          <NumberInput
            aria-label={`Price each for ${item.name}`}
            className={cn("font-mono", props.isMobile ? "h-11 w-24" : "w-[110px]")}
            value={props.price}
            disabled={props.free}
            onChange={(event) => props.onPrice(event.target.value)}
          />
        </label>
        {row.dice ? (
          <div className="flex min-h-10 items-center gap-2">
            {props.isMobile ? null : (
              <span className="font-mono text-[13px] text-text2">
                {row.cost ?? 0} + {diceLabel(row)}
              </span>
            )}
            <DiceEntry
              key={row.id}
              dice={`${row.dice}D6`}
              size="sm"
              className="flex-nowrap"
              total={props.rolled}
              disabled={props.free}
              onFaces={props.onRoll}
              button={(roll) => (
                <button
                  type="button"
                  onClick={roll}
                  disabled={props.free}
                  className="flex min-h-9 items-center gap-1.5 border border-strong px-2.5 text-xs font-bold text-ink disabled:opacity-50"
                >
                  <Dices className="h-3.5 w-3.5" aria-hidden="true" />
                  {props.rolled === null ? "Roll it" : "Roll again"}
                </button>
              )}
            />
          </div>
        ) : null}
        <CheckboxField
          inline
          labelClassName={props.inColumn ? "text-[13px]" : "ml-auto text-[13px]"}
          checked={props.free}
          onChange={(event) => props.onFree(event.target.checked)}
        >
          Free
        </CheckboxField>
      </div>
      {props.free ? (
        <Input
          aria-label="Why it is free"
          placeholder="Why it is free"
          value={props.reason}
          maxLength={500}
          onChange={(event) => props.onReason(event.target.value)}
        />
      ) : null}
    </>
  );
}
