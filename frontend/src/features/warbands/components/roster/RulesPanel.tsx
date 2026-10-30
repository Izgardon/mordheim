import { useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import type { Item } from "@/features/items/types/item-types";

import type { ItemPlace } from "../../hooks/units/useUnitActions";
import { unitName, type RosterUnit } from "./unit-view";

/** What a box shows when opened: its name, a kind line and its rules text. */
export type BoxDetail = {
  name: string;
  kind: string;
  text?: string | null;
  /** Rule names (an item's properties). */
  rules?: string[];
  item?: Item;
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
  };
};

/** A box's rules under its row, and for an item the existing actions: move, stash, sell. */
export default function RulesPanel({ detail, onClose, itemActions }: RulesPanelProps) {
  const [selling, setSelling] = useState(false);
  const suggested = detail.item?.suggested_sale_price ?? detail.item?.cost ?? 0;
  const [price, setPrice] = useState(String(suggested ?? 0));
  const [target, setTarget] = useState("");

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
      {itemActions && detail.item ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
          <select
            aria-label="Move to"
            value={target}
            onChange={(event) => {
              const value = event.target.value;
              setTarget("");
              const [type, id] = value.split(":");
              if (type) itemActions.onMove({ type: type as ItemPlace["type"], id: Number(id) });
            }}
            className="h-9 border border-strong bg-page px-2 text-sm text-ink"
          >
            <option value="">Move to…</option>
            {itemActions.targets.map((entry) => (
              <option
                key={`${entry.kind}-${entry.unit.id}`}
                value={`${entry.kind}:${entry.unit.id}`}
              >
                {unitName(entry.unit)}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => itemActions.onMove({ type: "stash" })}
          >
            To stash
          </Button>
          {selling ? (
            <span className="flex items-center gap-1.5">
              <Input
                aria-label="Sale price"
                inputSize="sm"
                inputMode="numeric"
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
