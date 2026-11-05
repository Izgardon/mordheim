import { apiRequest } from "@/lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";
import type { WhoCan } from "@/features/items/types/item-types";

import type {
  BasicsInput,
  EditorAnswer,
  FighterInput,
  ListInput,
  MakeTemplateInput,
  RuleRowInput,
  UpgradeInput,
} from "../types/editor-types";

/*
 * The template editor's routes (the templates plan, phase 4). Each save names the campaign (a
 * book template is written for one: its first save makes the campaign's house version) and
 * answers what the editor reads, whose `template.id` the editor follows from then on.
 */

const at = (templateId: number, path = "") => `/warband-templates/${templateId}/${path}`;

const write = (path: string, method: string, campaignId: number, body: object = {}) =>
  apiRequest<EditorAnswer>(path, {
    method,
    headers: socketIdHeaders(),
    body: { campaign_id: campaignId, ...body },
  });

/** `GET warband-templates/:id/editor/`: the template, its facts and its warnings. */
export function getTemplateEditor(templateId: number, campaignId: number, signal?: AbortSignal) {
  return apiRequest<EditorAnswer>(`${at(templateId, "editor/")}?campaign_id=${campaignId}`, {
    signal,
  });
}

/** `GET warband-templates/:id/who-can/`: what the types it serves can usually buy, and why not. */
export function getTemplateWhoCan(templateId: number, campaignId: number, signal?: AbortSignal) {
  return apiRequest<Pick<WhoCan, "items">>(
    `${at(templateId, "who-can/")}?campaign_id=${campaignId}`,
    { signal }
  );
}

/** `POST warband-templates/:id/revert/`: a house version goes; the answer is the book template. */
export function revertTemplate(templateId: number, campaignId: number) {
  return apiRequest<{ id: number }>(at(templateId, "revert/"), {
    method: "POST",
    headers: socketIdHeaders(),
    body: { campaign_id: campaignId },
  });
}

/**
 * `DELETE warband-templates/:id/`: the campaign's own is deleted (archived while a warband uses
 * it); a book template is removed for the campaign.
 */
export function deleteTemplate(
  template: { id: number; campaign_id: number | null },
  campaignId: number
) {
  const query = template.campaign_id == null ? `?campaign_id=${campaignId}` : "";
  return apiRequest<unknown>(`${at(template.id)}${query}`, {
    method: "DELETE",
    headers: socketIdHeaders(),
  });
}

/** `POST warband-templates/`: one of the campaign's own, blank or a copy. */
export const makeTemplate = (campaignId: number, body: MakeTemplateInput) =>
  write("/warband-templates/", "POST", campaignId, body);

/** One section's save on a template: the request each section sends. */
export type EditorSave = (templateId: number, campaignId: number) => Promise<EditorAnswer>;

export const saveBasics =
  (body: BasicsInput): EditorSave =>
  (templateId, campaignId) =>
    write(at(templateId, "basics/"), "PUT", campaignId, body);

export const addFighter =
  (body: FighterInput): EditorSave =>
  (templateId, campaignId) =>
    write(at(templateId, "fighters/"), "POST", campaignId, body);

export const saveFighter =
  (key: string, body: FighterInput): EditorSave =>
  (templateId, campaignId) =>
    write(at(templateId, `fighters/${key}/`), "PUT", campaignId, body);

export const removeFighter =
  (key: string): EditorSave =>
  (templateId, campaignId) =>
    write(at(templateId, `fighters/${key}/`), "DELETE", campaignId);

export const addList =
  (body: ListInput): EditorSave =>
  (templateId, campaignId) =>
    write(at(templateId, "lists/"), "POST", campaignId, body);

export const saveList =
  (key: string, body: ListInput): EditorSave =>
  (templateId, campaignId) =>
    write(at(templateId, `lists/${key}/`), "PUT", campaignId, body);

export const removeList =
  (key: string): EditorSave =>
  (templateId, campaignId) =>
    write(at(templateId, `lists/${key}/`), "DELETE", campaignId);

export const saveRules =
  (rules: RuleRowInput[]): EditorSave =>
  (templateId, campaignId) =>
    write(at(templateId, "rules/"), "PUT", campaignId, { rules });

export const saveUpgrades =
  (upgrades: UpgradeInput[]): EditorSave =>
  (templateId, campaignId) =>
    write(at(templateId, "upgrades/"), "PUT", campaignId, { upgrades });
