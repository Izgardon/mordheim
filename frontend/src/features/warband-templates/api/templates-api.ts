import { apiRequest } from "@/lib/api-client";

import type { WarbandTemplate, WarbandTemplateSummary } from "../types/template-types";

/**
 * `GET warband-templates/?campaign_id=`: the campaign's templates and the types each serves, in
 * play or not; `view` "search" adds what each holds by name (`contents`, Search everything).
 */
export function listWarbandTemplates(campaignId: number, signal?: AbortSignal, view?: "search") {
  const query = view ? `&view=${view}` : "";
  return apiRequest<WarbandTemplateSummary[]>(
    `/warband-templates/?campaign_id=${campaignId}${query}`,
    { signal }
  );
}

/** `GET warband-templates/:id/`: one whole template. */
export function getWarbandTemplate(templateId: number, signal?: AbortSignal) {
  return apiRequest<WarbandTemplate>(`/warband-templates/${templateId}/`, { signal });
}
