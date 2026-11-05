import { useState } from "react";
import { Plus } from "lucide-react";

import { SearchCombobox } from "@/components/ui/search-select";
import { warnedLast } from "@/features/catalogue/search-options";
import { itemName, searchWords } from "@/features/items/store/store-items";
import type { Item } from "@/features/items/types/item-types";

import type { ItemCharts } from "./item-charts";

/**
 * Add an item, with the store's search (name, tags and rules: "scimitar" finds the Sword): any
 * item can go on the list; one the template's types can't usually buy is greyed with the reason,
 * after the rest.
 */
export default function AddItem({
  charts,
  onAdd,
}: {
  charts: ItemCharts;
  onAdd: (item: Item) => void;
}) {
  const [adding, setAdding] = useState(false);
  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="inline-flex min-h-9 items-center gap-1.5 self-start border border-dashed border-strong px-3 text-[13px] font-bold text-accent-text hover:bg-raised"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Add an item
      </button>
    );
  }
  const options = warnedLast(
    charts.items.map((item) => ({
      id: item.id,
      title: itemName(item),
      subtitle: charts.chartOf(item.id),
      warning: charts.reasonOf(item.id),
      keywords: searchWords(item).join(" "),
    }))
  );
  return (
    <SearchCombobox
      label="Add an item"
      placeholder="Search Wargear"
      options={options}
      loading={charts.isLoading}
      autoFocus
      emptyText="Nothing in Wargear by that name."
      onPick={(option) => {
        const item = charts.byId.get(Number(option.id));
        if (item) onAdd(item);
        setAdding(false);
      }}
      onDismiss={() => setAdding(false)}
    />
  );
}
