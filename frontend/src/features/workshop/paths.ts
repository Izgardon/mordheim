import type { MadeInWorkshop } from "./types/workshop-types";

/** The workshop's pages (outside the campaign shell): its warbands, its lists, My content. */
export const workshopPath = (workshopId: number, rest = "") =>
  `/workshop/${workshopId}${rest ? `/${rest}` : ""}`;

export const workshopWarbandPath = (workshopId: number, warbandId: number) =>
  workshopPath(workshopId, `warbands/${warbandId}`);

export const workshopListPath = (workshopId: number, templateId: number) =>
  workshopPath(workshopId, `lists/${templateId}`);

/** Where a warband or list just made or copied into the workshop opens. */
export const madePath = (made: MadeInWorkshop) =>
  made.kind === "warband"
    ? workshopWarbandPath(made.campaign_id, made.id)
    : workshopListPath(made.campaign_id, made.id);

/**
 * My content: the catalogue pages a workshop shows, each the campaign route of the same name
 * (Add new and Edit write the workshop's own entries). Races are made from a unit's race field.
 */
export const CONTENT_KINDS = [
  { path: "items", label: "Items" },
  { path: "skills", label: "Skills" },
  { path: "spells", label: "Spells" },
  { path: "boons-banes", label: "Specials" },
  { path: "bestiary", label: "Beasts" },
  { path: "hired-swords", label: "Hired swords" },
  { path: "dramatis-personae", label: "Dramatis personae" },
] as const;
