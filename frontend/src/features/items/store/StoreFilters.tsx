import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import ItemFormDialog from "../components/ItemFormDialog";
import type { Item } from "../types/item-types";
import { STORE_CATEGORIES, type StoreCategory } from "./store-items";

type StoreFiltersProps = {
  campaignId: number;
  isMobile: boolean;
  query: string;
  onQuery: (query: string) => void;
  /** The one switch: Their list for a unit recruited from the template, else Warband Only. */
  filter: { label: string; checked: boolean; onChange: (on: boolean) => void };
  category: StoreCategory;
  onCategory: (category: StoreCategory) => void;
  /** `edit_catalogue`: Add item makes a campaign item here and opens its row. */
  canAddItem?: boolean;
  onAdded: (item: Item) => void;
};

/**
 * What the store is showing: the search, its one switch (Their list or Warband Only), Add item,
 * and the category chips, which scroll across on a phone with room under them for their scrollbar.
 */
export default function StoreFilters(props: StoreFiltersProps) {
  return (
    <>
      <div className={cn("flex gap-2.5", props.isMobile ? "flex-col" : "items-stretch")}>
        <label className="flex min-h-11 flex-1 items-center gap-2 border border-strong bg-page px-3 text-muted-foreground">
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search the store"
            aria-label="Search the store"
            value={props.query}
            onChange={(event) => props.onQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
          />
        </label>
        <div className="flex gap-2.5">
          <Switch checked={props.filter.checked} onCheckedChange={props.filter.onChange}>
            {props.filter.label}
          </Switch>
          {props.canAddItem ? (
            <ItemFormDialog
              mode="create"
              campaignId={props.campaignId}
              onCreated={props.onAdded}
              trigger={
                <Button variant="secondary" className={props.isMobile ? "ml-auto min-h-11" : ""}>
                  Add item
                </Button>
              }
            />
          ) : null}
        </div>
      </div>
      <div
        role="group"
        aria-label="Category"
        className={cn("flex gap-1.5", props.isMobile ? "scroll-row -mx-4 px-4" : "flex-wrap")}
      >
        {STORE_CATEGORIES.map((entry) => (
          <Chip
            key={entry.id}
            pressed={props.category === entry.id}
            className="shrink-0"
            onClick={() => props.onCategory(entry.id)}
          >
            {entry.label}
          </Chip>
        ))}
      </div>
    </>
  );
}
