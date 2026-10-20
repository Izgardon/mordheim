import { useParams } from "react-router-dom";

import { useCampaignQuery } from "./useCampaignQuery";

/**
 * Whether the campaign of the page has started (decision 3: starting enables battles and XP), read
 * from the cached campaign the layout loads. A start writes its answer there (BUG-14), so every
 * reader, the XP bar included, follows it with no copy to keep in step.
 */
export function useCampaignStarted() {
  const { id } = useParams();
  return useCampaignQuery(Number(id)).data?.in_progress ?? false;
}
