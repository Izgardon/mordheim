import { CheckboxField } from "@/components/ui/checkbox";
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
      <CheckboxField
        checked={sold}
        onChange={(event) => form.setAvailableInShop(event.target.checked)}
      >
        Available in the shop
      </CheckboxField>
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
      ) : null}
    </div>
  );
}
