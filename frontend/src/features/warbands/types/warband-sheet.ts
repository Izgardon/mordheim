import type {
  HenchmenGroup,
  Warband,
  WarbandHero,
  WarbandHiredSword,
  WarbandUnitsSummary,
} from "./warband-types";

/** What the viewer may do with a warband (design 0.29 §3.5). The server decides; the UI reads. */
export const WARBAND_CAPABILITIES = [
  "edit",
  "level_up",
  "manage_items",
  "edit_backstory",
  "delete",
  "add_custom",
] as const;

export type WarbandCapability = (typeof WARBAND_CAPABILITIES)[number];
export type WarbandCapabilities = Readonly<Record<WarbandCapability, boolean>>;

/** Missing payloads and unknown keys read as false: the UI fails closed. */
export function readCapabilities(raw: unknown): WarbandCapabilities {
  const source = (raw ?? {}) as Partial<Record<string, unknown>>;
  return Object.fromEntries(
    WARBAND_CAPABILITIES.map((key) => [key, source[key] === true])
  ) as WarbandCapabilities;
}

/**
 * `GET /warbands/<id>/sheet/` (PERF-24): the whole warband page in one request. `warband` and
 * `summary` are the detail and summary bodies, and the unit lists are in the detail shape.
 */
export type WarbandSheet = {
  warband: Warband;
  summary: WarbandUnitsSummary;
  capabilities: WarbandCapabilities;
  heroes: WarbandHero[];
  henchmen_groups: HenchmenGroup[];
  hired_swords: WarbandHiredSword[];
};
