import { useState } from "react";
import { X } from "lucide-react";

import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ROW_SELECT, SectionedSelect } from "@/components/ui/sectioned-select";
import type { Item } from "@/features/items/types/item-types";
import PsychologyRuleLink from "@/features/rules/components/PsychologyRuleLink";

import type { ItemPlace } from "../../hooks/units/useUnitActions";
import { placeOf, unitSections } from "./unit-sections";
import { isGroup, type RosterUnit } from "./unit-view";

/** What a box shows when opened: its name, a kind line and its rules text. */
export type BoxDetail = {
  name: string;
  kind: string;
  text?: string | null;
  /** Rule names (an item's rules). */
  rules?: string[];
  item?: Item;
  /** A boon or bane: a psychology one links its part of the Rules page ("Fear in the rules"). */
  special?: boolean;
};

type RulesPanelProps = {
  detail: BoxDetail;
  onClose: () => void;
  /** The unit carrying it and the others it could move to; omitted when the viewer can't act. */
  itemActions?: {
    owner: RosterUnit;
    targets: RosterUnit[];
    onMove: (to: ItemPlace) => void;
    onSell: (price: number) => void;
    /** Opens the store for the unit with this item, at the campaign's current price. */
    onBuyAgain: () => void;
  };
};

/** A box's rules under its row, and for an item the existing actions: move, stash, sell, buy again. */
export default function RulesPanel({ detail, onClose, itemActions }: RulesPanelProps) {
  const [selling, setSelling] = useState(false);
  // a group sells a loadout row: a copy for each member who carries it (henchmen loadouts)
  const copies = itemActions && isGroup(itemActions.owner) ? (detail.item?.carriers ?? 1) : 1;
  const suggested = (detail.item?.suggested_sale_price ?? detail.item?.cost ?? 0) * copies;
  const [price, setPrice] = useState(String(suggested ?? 0));

  return (
    <div className="flex flex-col gap-2 border border-accent-line bg-panel p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-bold text-head">{detail.name}</span>
          <span className="text-xs text-muted-foreground">{detail.kind}</span>
        </div>
        <IconButton aria-label="Close rules" look="plain" className="h-8 w-8" onClick={onClose}>
          <X aria-hidden="true" />
        </IconButton>
      </div>
      {detail.rules?.length ? (
        <p className="text-[13px] text-text2">
          <span className="font-bold text-accent-hi">Rules</span> · {detail.rules.join(", ")}
        </p>
      ) : null}
      {detail.text ? (
        <p className="whitespace-pre-line text-[13px] text-text2">{detail.text}</p>
      ) : null}
      {detail.special ? <PsychologyRuleLink specialName={detail.name} /> : null}
      {itemActions && detail.item ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
          <SectionedSelect
            aria-label="Move to"
            placeholder="Move to…"
            value=""
            sections={unitSections(itemActions.targets)}
            className="h-9 w-auto gap-1.5 pl-2.5 pr-2 md:h-9"
            contentClassName={ROW_SELECT.contentClassName}
            onValueChange={(value) => {
              const to = placeOf(value);
              if (to) itemActions.onMove(to);
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => itemActions.onMove({ type: "stash" })}
          >
            To stash
          </Button>
          <Button size="sm" variant="secondary" onClick={itemActions.onBuyAgain}>
            Buy again
          </Button>
          {selling ? (
            <span className="flex items-center gap-1.5">
              <NumberInput
                compact
                aria-label="Sale price"
                inputSize="sm"
                className="w-20"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
              <Button size="sm" onClick={() => itemActions.onSell(Number(price) || 0)}>
                Sell for {Number(price) || 0} gc
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setSelling(true)}>
              Sell
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
