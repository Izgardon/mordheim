import { useCallback, useEffect, useState } from "react";

import { useCatalogueCache } from "@/lib/catalogue-queries";

import { createItemProperty } from "../api/items-api";
import { useItemPropertySearch } from "./useItemPropertySearch";

import type { ItemProperty } from "../types/item-types";

type UseItemPropertyPickerOptions = {
  campaignId: number;
  /** The item's type: the suggestions are its properties, and a new property takes it. */
  type: string;
  /** Read the cached property list only while the form shows (a closed dialog reads nothing). */
  enabled: boolean;
  initial: ItemProperty[];
};

/**
 * The item form's Properties: the chosen chips, the search over the cached `item-properties`
 * list (CAT-PERF-08), and a new property created on the spot, put into that list (BUG-149).
 */
export function useItemPropertyPicker({
  campaignId,
  type,
  enabled,
  initial,
}: UseItemPropertyPickerOptions) {
  const catalogueCache = useCatalogueCache();
  const [selected, setSelected] = useState<ItemProperty[]>(initial);
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { forType, matches } = useItemPropertySearch(campaignId, type, search, { enabled });

  // Fills in the descriptions of an edited item's properties; unchanged, it keeps the same list.
  useEffect(() => {
    setSelected((prev) => {
      const next = prev.map((property) => forType.find((p) => p.id === property.id) ?? property);
      return next.some((property, index) => property !== prev[index]) ? next : prev;
    });
  }, [forType]);

  // Another type has other properties: the search and the new property start over.
  useEffect(() => {
    setSearch("");
    setIsCreateOpen(false);
  }, [type]);

  const create = async () => {
    if (!newName.trim() || !type) {
      return;
    }
    setIsCreating(true);
    try {
      const property = await createItemProperty({
        name: newName.trim(),
        description: newDescription.trim(),
        type,
        campaign_id: campaignId,
      });
      catalogueCache.upsert("item-properties", campaignId, property);
      setSelected([...selected, property]);
      setNewName("");
      setNewDescription("");
      setSearch("");
    } catch (error) {
      console.error("Failed to create property:", error);
    } finally {
      setIsCreating(false);
    }
  };

  /** Back to `properties` chosen, with no search and the new-property form closed. */
  const load = useCallback((properties: ItemProperty[]) => {
    setSelected(properties);
    setSearch("");
    setIsCreateOpen(false);
    setNewName("");
    setNewDescription("");
  }, []);

  return {
    selected,
    /** The type's properties matching the search, the chosen ones left out. */
    suggestions: matches.filter(
      (property) => !selected.some((chosen) => chosen.id === property.id)
    ),
    hasMatches: matches.length > 0,
    search,
    setSearch,
    choose: (property: ItemProperty) => {
      if (!selected.find((p) => p.id === property.id)) {
        setSelected([...selected, property]);
        setSearch("");
      }
    },
    drop: (propertyId: number) => setSelected(selected.filter((p) => p.id !== propertyId)),
    isCreateOpen,
    toggleCreate: () => setIsCreateOpen(!isCreateOpen),
    newName,
    setNewName,
    newDescription,
    setNewDescription,
    isCreating,
    create,
    load,
  };
}

export type ItemPropertyPicker = ReturnType<typeof useItemPropertyPicker>;
