import PriceRowsField from "@/features/items/components/PriceRowsField";

import type { BestiaryEntryFormState } from "../../hooks/useBestiaryEntryForm";

/**
 * "Available in the shop": ticked, the item's price rows show (cost, dice, rarity, label, note and
 * who may buy at each: the item form's); unticked, they fold away and are kept, ready for when it
 * is sold again. The item itself always exists, so kits, trades and owned beasts keep working.
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
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        Available in the shop
      </label>
      {sold ? (
        <PriceRowsField
          campaignId={form.campaignId}
          rows={shop.rows}
          onChange={shop.setRows}
          errorOf={(path) => form.fieldErrors[path]}
          path="item.availabilities"
          idPrefix="bestiary-shop"
          label="Shop prices"
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Not sold. Its item still exists, so kits, trades and owned ones keep working
          {shop.rows.length > 0 ? "; its prices are kept for when it is sold again." : "."}
        </p>
      )}
    </div>
  );
}
