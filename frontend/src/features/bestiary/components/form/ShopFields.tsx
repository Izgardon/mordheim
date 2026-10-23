import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import HirelingRestrictionsField from "@/features/hirelings/components/form/HirelingRestrictionsField";

import type { BestiaryEntryFormState } from "../../hooks/useBestiaryEntryForm";
import type { ShopPriceRow } from "../../utils/beast-shop";

/** One price: price and rarity, the variable cost, and who may buy at it. */
function PriceRow({
  form,
  row,
  index,
}: {
  form: BestiaryEntryFormState;
  row: ShopPriceRow;
  index: number;
}) {
  const { shop, fieldErrors } = form;
  const many = shop.rows.length > 1;
  const id = (name: string) => `bestiary-shop-${name}-${row.key}`;
  const error = (field: string) => fieldErrors[`item.availabilities.${index}.${field}`];
  return (
    <div className="space-y-3 rounded-lg border border-input/80 bg-background/40 p-3">
      {many ? (
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Price {index + 1}
          </span>
          <button
            type="button"
            onClick={() => shop.remove(row.key)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Remove price ${index + 1}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("cost")}>Price</Label>
          <NumberInput
            id={id("cost")}
            min={0}
            step={1}
            value={row.cost}
            onChange={(event) => shop.set(row.key, "cost", event.target.value)}
            aria-invalid={Boolean(error("cost"))}
            placeholder="80"
          />
          <FieldError message={error("cost")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("rarity")}>
            Rarity <span className="text-xs text-muted-foreground">(Common = 2)</span>
          </Label>
          <NumberInput
            id={id("rarity")}
            min={2}
            max={20}
            step={1}
            value={row.rarity}
            onChange={(event) => shop.set(row.key, "rarity", event.target.value)}
            aria-invalid={Boolean(error("rarity"))}
            placeholder="11"
          />
          <FieldError message={error("rarity")} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id("variable")}>Variable cost</Label>
        <Input
          id={id("variable")}
          value={row.variableCost}
          onChange={(event) => shop.set(row.key, "variableCost", event.target.value)}
          aria-invalid={Boolean(error("variable_cost"))}
          placeholder="e.g. +2D6"
        />
        <FieldError message={error("variable_cost")} />
      </div>
      <HirelingRestrictionsField
        restrictions={{
          available: shop.available,
          rows: row.restrictions,
          add: (restriction) => shop.addRestriction(row.key, restriction),
          remove: (linkKey) => shop.removeRestriction(row.key, linkKey),
          setNote: (linkKey, note) => shop.setNote(row.key, linkKey, note),
        }}
      />
    </div>
  );
}

/**
 * "Available in the shop": ticked, the item's prices show (price, rarity, variable cost,
 * restrictions with notes); unticked, they fold away and are kept, ready for when it is sold
 * again. The item itself always exists, so kits, trades and owned beasts keep working.
 */
export default function ShopFields({ form }: { form: BestiaryEntryFormState }) {
  const { values, shop } = form;
  const sold = values.available_in_shop;
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={sold}
          onChange={(event) => form.setAvailableInShop(event.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        Available in the shop
      </label>
      {sold ? (
        <div className="flex flex-col gap-3">
          <FieldError message={form.fieldErrors["item.availabilities"]} />
          {shop.rows.map((row, index) => (
            <PriceRow key={row.key} form={form} row={row} index={index} />
          ))}
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={shop.add}>
              Add another price
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Not sold. Its item still exists, so kits, trades and owned ones keep working
          {shop.rows.length > 0 ? "; its prices are kept for when it is sold again." : "."}
        </p>
      )}
    </div>
  );
}
