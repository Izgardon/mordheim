import { apiRequest } from "@/lib/api-client";
import type { WarbandTemplateSummary } from "@/features/warband-templates/types/template-types";

import type {
  ImportedList,
  ImportedWarband,
  MadeWorkshop,
  MakeListBody,
  MakeWarbandBody,
  SharedPreview,
  WorkshopRows,
} from "../types/workshop-types";

/** `GET workshop/`: my custom warbands and warband lists, newest first. */
export function listWorkshops(signal?: AbortSignal) {
  return apiRequest<WorkshopRows>("/workshop/", { signal });
}

export function makeWarbandWorkshop(body: MakeWarbandBody) {
  return apiRequest<MadeWorkshop>("/workshop/warbands/", { method: "POST", body });
}

export function makeListWorkshop(body: MakeListBody) {
  return apiRequest<MadeWorkshop>("/workshop/lists/", { method: "POST", body });
}

/** A shared warband or list copied into a new workshop of my own. */
export function importIntoWorkshop(code: string) {
  return apiRequest<MadeWorkshop>("/workshop/import/", { method: "POST", body: { code } });
}

/** Soft deletes my workshop: its code stops working, copies made from it stay. */
export function deleteWorkshop(workshopId: number) {
  return apiRequest<void>(`/workshop/${workshopId}/`, { method: "DELETE" });
}

/** What a code shares (404 `code_not_found` in the server's words). */
export function previewSharedCode(code: string, signal?: AbortSignal) {
  return apiRequest<SharedPreview>(`/workshop/shared/${encodeURIComponent(code)}/`, { signal });
}

/** A shared warband imported as mine into a campaign where I have none, paying its cost. */
export function importWarbandIntoCampaign(campaignId: number, code: string) {
  return apiRequest<ImportedWarband>(`/campaigns/${campaignId}/warbands/import/`, {
    method: "POST",
    body: { code },
  });
}

/** A shared list imported as the campaign's own template (`edit_catalogue`). */
export function importListIntoCampaign(campaignId: number, code: string) {
  return apiRequest<ImportedList>(`/campaigns/${campaignId}/warband-templates/import/`, {
    method: "POST",
    body: { code },
  });
}

/** `GET warband-templates/` with no campaign: the book's templates and the types each serves. */
export function listBookTemplates(signal?: AbortSignal) {
  return apiRequest<WarbandTemplateSummary[]>("/warband-templates/", { signal });
}
