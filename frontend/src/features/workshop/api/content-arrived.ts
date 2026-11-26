import type { QueryClient } from "@tanstack/react-query";

import type { WorkshopWarning } from "../types/workshop-types";

const CONTENT = new Set(["custom_content_added", "custom_content_archived"]);

/**
 * A copy brought custom content (items, races, skills, spells, specials, beasts) into a campaign
 * or my workshop: that campaign's catalogue lists read again, every kind, since one copy may
 * bring any of them. Nothing else changes, and nothing at all when the server said none came.
 */
export function contentArrived(
  queryClient: QueryClient,
  campaignId: number,
  warnings: WorkshopWarning[] = []
) {
  if (!warnings.some((warning) => CONTENT.has(warning.code))) return;
  void queryClient.invalidateQueries({ queryKey: ["campaign", campaignId, "catalogue"] });
}
