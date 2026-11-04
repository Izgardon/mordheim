import { apiRequest } from "@/lib/api-client";

import type { WarbandTemplate, WarbandTemplateSummary } from "../types/template-types";

/** `GET warband-templates/?campaign_id=`: the campaign's templates and the types each serves, in play or not. */
export function listWarbandTemplates(campaignId: number, signal?: AbortSignal) {
  return apiRequest<WarbandTemplateSummary[]>(`/warband-templates/?campaign_id=${campaignId}`, {
    signal,
  });
}

/** `GET warband-templates/:id/`: one whole template. */
export function getWarbandTemplate(templateId: number, signal?: AbortSignal) {
  return apiRequest<WarbandTemplate>(`/warband-templates/${templateId}/`, { signal });
}
