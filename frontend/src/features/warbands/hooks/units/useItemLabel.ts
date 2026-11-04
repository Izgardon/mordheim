import { useQuery } from "@tanstack/react-query";

import type { Item } from "@/features/items/types/item-types";

import { warbandSheetQuery } from "../../api/warband-queries";

/**
 * The list's own name for an item (the templates plan, question 12): a unit recruited from the
 * template whose lists name an item another way reads it so, "Jambiya (Dagger)". The names come
 * with the warband's sheet (`item_names`, from its template when read); this reads the sheet the
 * page already holds and never fetches it.
 */
export function useItemLabel(campaignId: number, warbandId: number) {
  const names = useQuery({
    ...warbandSheetQuery(campaignId, warbandId),
    enabled: false,
    select: (sheet) => sheet.item_names ?? {},
  }).data;
  return (unit: object, item: Pick<Item, "id" | "name">) => {
    const key = "fighter_key" in unit ? String(unit.fighter_key ?? "") : "";
    const shown = key ? names?.[key]?.[String(item.id)] : undefined;
    return shown ? `${shown} (${item.name})` : item.name;
  };
}
