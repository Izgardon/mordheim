import type {
  HenchmenGroup,
  Warband,
  WarbandHero,
  WarbandHireling,
  WarbandPlot,
  WarbandRule,
  WarbandUnitsSummary,
} from "./warband-types";

/** What the viewer may do with a warband (design 0.29 §3.5). The server decides; the UI reads. */
export const WARBAND_CAPABILITIES = [
  "edit",
  "level_up",
  "manage_items",
  "edit_backstory",
  "delete",
  // Creating catalogue entries from the unit forms (the campaign's edit_catalogue code).
  "edit_catalogue",
  // Decision 10: only the warband's owner trades for it (campaign owners and admins don't).
  "trade",
  // A workshop's warband (apps/workshop): its roster, backstory and cost; no treasury, log,
  // resources, campaign points, battles, trades, encampments, visits or bounties.
  "workshop",
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
/** One encampment a warband holds, as its sheet lists it. */
export type HeldEncampment = { id: number; name: string; fortified: boolean };

export type WarbandSheet = {
  warband: Warband;
  summary: WarbandUnitsSummary;
  capabilities: WarbandCapabilities;
  /** The warband's own rules, in the order they were added. */
  rules: WarbandRule[];
  /** The plot it follows, with its ladder's points for the track (apps/plots); null: none. */
  plot?: WarbandPlot | null;
  /** The list's own name for an item, by fighter key and item id, from its template ("Jambiya"). */
  item_names?: Record<string, Record<string, string>>;
  /** The encampments it holds while the campaign has Encampments on; [] while they are off. */
  encampments?: HeldEncampment[];
  /**
   * A workshop's warband: its cost, budget and share code, and whether it was made with no list
   * (its budget then its own); null in a campaign.
   */
  workshop?: { cost: number; budget: number; share_code: string; no_list: boolean } | null;
  heroes: WarbandHero[];
  henchmen_groups: HenchmenGroup[];
  hirelings: WarbandHireling[];
};
