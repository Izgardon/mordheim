import {
  GiBattleGear,
  GiCrownCoin,
  GiDramaMasks,
  GiPawPrint,
  GiRuneStone,
  GiSpellBook,
  GiYinYang,
} from "react-icons/gi";

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
 * (Add new and Edit write the workshop's own entries), with the Reference nav's icon for that page.
 * Races are made from a unit's race field.
 */
export const CONTENT_KINDS = [
  { path: "items", label: "Items", icon: GiBattleGear },
  { path: "skills", label: "Skills", icon: GiRuneStone },
  { path: "spells", label: "Spells", icon: GiSpellBook },
  { path: "boons-banes", label: "Specials", icon: GiYinYang },
  { path: "bestiary", label: "Beasts", icon: GiPawPrint },
  { path: "hired-swords", label: "Hired swords", icon: GiCrownCoin },
  { path: "dramatis-personae", label: "Dramatis personae", icon: GiDramaMasks },
] as const;
