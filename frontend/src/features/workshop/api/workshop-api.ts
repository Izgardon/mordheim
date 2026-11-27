import { apiRequest } from "@/lib/api-client";
import type { WarbandTemplateSummary } from "@/features/warband-templates/types/template-types";

import type {
  ImportedList,
  ImportedWarband,
  ListImportBody,
  MadeInWorkshop,
  MakeListBody,
  MakeWarbandBody,
  SharedPreview,
  WarbandImportBody,
  Workshop,
} from "../types/workshop-types";

/** `GET workshop/`: my workshop's id (null before my first use), my warbands and lists. */
export function getWorkshop(signal?: AbortSignal) {
  return apiRequest<Workshop>("/workshop/", { signal });
}

/** `POST workshop/`: my workshop, made now if I have none (for My content before anything else). */
export function openWorkshop() {
  return apiRequest<Workshop>("/workshop/", { method: "POST" });
}

export function makeWorkshopWarband(body: MakeWarbandBody) {
  return apiRequest<MadeInWorkshop>("/workshop/warbands/", { method: "POST", body });
}

export function makeWorkshopList(body: MakeListBody) {
  return apiRequest<MadeInWorkshop>("/workshop/lists/", { method: "POST", body });
}

/** A shared warband or list copied into my workshop, with the custom content it uses. */
export function importIntoWorkshop(code: string) {
  return apiRequest<MadeInWorkshop>("/workshop/import/", { method: "POST", body: { code } });
}

/** My warband in a campaign, copied into my workshop. */
export function warbandToWorkshop(warbandId: number) {
  return apiRequest<MadeInWorkshop>(`/warbands/${warbandId}/to-workshop/`, { method: "POST" });
}

/** A campaign's own list (or its house version of the book's), copied into my lists. */
export function listToWorkshop(templateId: number) {
  return apiRequest<MadeInWorkshop>(`/warband-templates/${templateId}/to-workshop/`, {
    method: "POST",
  });
}

/** What a code shares (404 `code_not_found` in the server's words). */
export function previewSharedCode(code: string, signal?: AbortSignal) {
  return apiRequest<SharedPreview>(`/workshop/shared/${encodeURIComponent(code)}/`, { signal });
}

/** A shared warband, or one of my workshop's, imported as mine into a campaign where I have none, paying its cost. */
export function importWarbandIntoCampaign(campaignId: number, body: WarbandImportBody) {
  return apiRequest<ImportedWarband>(`/campaigns/${campaignId}/warbands/import/`, {
    method: "POST",
    body,
  });
}

/** A shared list, or one of my workshop's, imported as the campaign's own template (`edit_catalogue`). */
export function importListIntoCampaign(campaignId: number, body: ListImportBody) {
  return apiRequest<ImportedList>(`/campaigns/${campaignId}/warband-templates/import/`, {
    method: "POST",
    body,
  });
}

/** `GET warband-templates/` with no campaign: the book's templates and the types each serves. */
export function listBookTemplates(signal?: AbortSignal) {
  return apiRequest<WarbandTemplateSummary[]>("/warband-templates/", { signal });
}
