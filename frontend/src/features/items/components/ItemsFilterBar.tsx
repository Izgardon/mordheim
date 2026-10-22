import type { ReactNode } from "react";

import { Input } from "@components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/select";

import {
  ALL_SINGLE_USE,
  ALL_SUBTYPES,
  SINGLE_USE_ONLY,
  type ItemsFilters,
} from "../hooks/useItemsFilters";

type ItemsFilterBarProps = {
  filters: ItemsFilters;
  /** What follows the filters (Add item). */
  children?: ReactNode;
};

/** Wargear's search, and the tab's subtype or single-use filter. */
export default function ItemsFilterBar({ filters, children }: ItemsFilterBarProps) {
  const { activeTab } = filters;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        type="search"
        value={filters.searchQuery}
        onChange={(event) => filters.setSearchQuery(event.target.value)}
        placeholder="Search items..."
        aria-label="Search items"
        className="flex-none w-[calc(50%-6px)] sm:w-full sm:max-w-sm"
      />
      {activeTab === "weapons" || activeTab === "armour" || activeTab === "animals" ? (
        <Select value={filters.selectedSubtype} onValueChange={filters.setSelectedSubtype}>
          <SelectTrigger className="w-[calc(50%-6px)] sm:w-56">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SUBTYPES}>All types</SelectItem>
            {filters.subtypeOptions.map((typeOption) => (
              <SelectItem key={typeOption} value={typeOption}>
                {typeOption}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {activeTab === "misc" ? (
        <Select value={filters.selectedSingleUse} onValueChange={filters.setSelectedSingleUse}>
          <SelectTrigger className="w-[calc(50%-6px)] sm:w-56">
            <SelectValue placeholder="Filter by usage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SINGLE_USE}>All usage</SelectItem>
            <SelectItem value={SINGLE_USE_ONLY}>Single use</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
      {children}
    </div>
  );
}
