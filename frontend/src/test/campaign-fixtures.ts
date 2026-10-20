/**
 * A campaign for the campaign screens' tests, in the API's shapes: campaign 1, "Shards of the
 * Comet", owned by Aldric (user 7, Iron Vultures), with Brunhilde (8, admin, Grey Wardens), Mira
 * (9, player, Night Razors) and a member who registered without a name (12, no warband yet).
 * The server names that member "Player 12" wherever a name goes, never by email (SEC-13).
 */
import type { PendingReportedResult } from "@/features/battles/types/battle-types";
import type { CampaignCapability } from "@/features/campaigns/capabilities";
import type {
  CampaignBattleHistoryEntry,
  CampaignEncampment,
  CampaignMember,
  CampaignMessage,
  CampaignPermission,
  CampaignPivotalMoment,
  CampaignPlayer,
  CampaignRole,
  CampaignSummary,
} from "@/features/campaigns/types/campaign-types";
import { fakeApi } from "./fake-api";

export const CAMPAIGN_ID = 1;

/** `"/campaigns/1/<suffix>"`, as the api modules build their paths. */
export const campaignApi = (suffix = "") => `/campaigns/${CAMPAIGN_ID}/${suffix}`;

type Person = {
  id: number;
  name: string;
  email: string;
  role: CampaignRole;
  warband: { id: number; name: string; faction: string } | null;
};

export const OWNER: Person = {
  id: 7,
  name: "Aldric",
  email: "aldric@example.com",
  role: "owner",
  warband: { id: 101, name: "Iron Vultures", faction: "Reiklanders" },
};
export const ADMIN: Person = {
  id: 8,
  name: "Brunhilde",
  email: "brunhilde@example.com",
  role: "admin",
  warband: { id: 103, name: "Grey Wardens", faction: "Sisters of Sigmar" },
};
export const PLAYER: Person = {
  id: 9,
  name: "Mira",
  email: "mira@example.com",
  role: "player",
  warband: { id: 102, name: "Night Razors", faction: "Skaven" },
};
/** Registered without a name: the server's `display_name` is "Player {id}" (SEC-13). */
export const NAMELESS: Person = {
  id: 12,
  name: "Player 12",
  email: "nameless@example.com",
  role: "player",
  warband: null,
};

const PEOPLE = [OWNER, ADMIN, PLAYER, NAMELESS];

/** `GET permissions/`: the server's eleven codes with labels and descriptions, in its order. */
export const PERMISSION_CATALOGUE: CampaignPermission[] = [
  ["add_custom", "Add custom", "Add custom items, skills, spells and specials to the campaign."],
  ["manage_items", "Manage items", "Edit and delete the campaign's custom items."],
  ["manage_skills", "Manage skills", "Edit and delete the campaign's custom skills."],
  ["manage_spells", "Manage spells", "Edit and delete the campaign's custom spells."],
  ["manage_specials", "Manage specials", "Edit and delete the campaign's custom specials."],
  ["manage_rules", "Manage rules", "Add, edit and delete the campaign's house rules."],
  ["manage_warbands", "Manage warbands", "Edit every warband in the campaign, not just their own."],
  ["manage_encampments", "Manage encampments", "Add and edit the campaign's encampments."],
  ["manage_locations", "Manage locations", "Add and edit the campaign's locations."],
  ["manage_bestiary", "Manage bestiary", "Add, edit and delete the campaign's bestiary entries."],
  ["manage_battles", "Manage battles", "See Settings > Active Battles and end stuck battles."],
].map(([code, label, description]) => ({ code, label, description }));

/** Every code an owner's or an admin's campaign payload carries. */
export const ALL_PERMISSION_CODES = PERMISSION_CATALOGUE.map((entry) => entry.code);

/**
 * The detail's `capabilities` as the server's rules give them (`apps/campaigns/access.py`):
 * role flags for owners and admins, one flag per code held, and the encampment and location codes
 * only while their page is switched on.
 */
export function capabilitiesFor(
  campaign: Pick<
    CampaignSummary,
    "role" | "permissions" | "enable_encampments" | "enable_locations"
  >
): Record<CampaignCapability, boolean> {
  const isOwner = campaign.role === "owner";
  const isStaff = isOwner || campaign.role === "admin";
  const holds = (code: string) => isStaff || (campaign.permissions ?? []).includes(code);
  return {
    edit_settings: isOwner,
    start: isStaff,
    delete: isOwner,
    regenerate_join_code: isStaff,
    view_members: isStaff,
    grant_permissions: isStaff,
    change_roles: isOwner,
    remove_members: isStaff,
    add_custom: holds("add_custom"),
    manage_items: holds("manage_items"),
    manage_skills: holds("manage_skills"),
    manage_spells: holds("manage_spells"),
    manage_specials: holds("manage_specials"),
    manage_rules: holds("manage_rules"),
    manage_warbands: holds("manage_warbands"),
    manage_encampments: Boolean(campaign.enable_encampments) && holds("manage_encampments"),
    manage_locations: Boolean(campaign.enable_locations) && holds("manage_locations"),
    manage_bestiary: holds("manage_bestiary"),
    manage_battles: holds("manage_battles"),
  };
}

/** `GET campaigns/1/` as the owner reads it; a started Standard campaign by default. */
export function campaignSummary(overrides: Partial<CampaignSummary> = {}): CampaignSummary {
  const campaign: CampaignSummary = {
    id: CAMPAIGN_ID,
    name: "Shards of the Comet",
    join_code: "WYR123",
    max_players: 8,
    max_heroes: 6,
    max_hired_swords: 3,
    max_games: 10,
    starting_gold: 500,
    hero_death_roll: "d66",
    hero_level_thresholds: [2, 4, 6, 8, 11, 14],
    henchmen_level_thresholds: [2, 5, 9, 14],
    hired_sword_level_thresholds: [2, 4, 6, 8, 11, 14],
    locations: false,
    enable_encampments: false,
    enable_locations: false,
    item_settings: [],
    player_count: PEOPLE.length,
    role: "owner",
    permissions: ALL_PERMISSION_CODES,
    in_progress: true,
    created_at: "2026-09-01T18:00:00Z",
    updated_at: "2026-10-18T18:00:00Z",
    ...overrides,
  };
  return { ...campaign, capabilities: overrides.capabilities ?? capabilitiesFor(campaign) };
}

/**
 * The campaign as each role reads it: owners and admins carry every code, a player only the codes
 * granted (joining grants `add_custom`).
 */
export function campaignFor(role: CampaignRole, overrides: Partial<CampaignSummary> = {}) {
  const permissions = role === "player" ? ["add_custom"] : ALL_PERMISSION_CODES;
  return campaignSummary({ role, permissions, ...overrides });
}

/** `GET players/`: one row per member, named as the server labels them. */
export const campaignPlayers = (): CampaignPlayer[] =>
  PEOPLE.map((person) => ({
    id: person.id,
    name: person.name,
    battle_busy: false,
    battle_busy_status: null,
    warband: person.warband ? { ...person.warband, wins: 2, losses: 1, rating: 120 } : null,
  }));

/** `GET members/`: owner and admin listed with every code; Mira holds `add_custom`. */
export const campaignMembers = (): CampaignMember[] =>
  PEOPLE.map((person) => ({
    id: person.id,
    name: person.name,
    email: person.email,
    role: person.role,
    permissions: person.role === "player" ? (person === PLAYER ? ["add_custom"] : []) : [],
    warband_id: person.warband?.id ?? null,
    warband_name: person.warband?.name ?? null,
  }));

export const battleHistoryEntry = (): CampaignBattleHistoryEntry => ({
  id: 40,
  scenario: "Skirmish at the Market Square",
  winners: [OWNER.warband!.name],
  date: "2026-10-12",
  participants: [
    {
      warband_id: OWNER.warband!.id,
      warband_name: OWNER.warband!.name,
      kills: 3,
      ooas: 1,
      deaths: [],
      xp_gain: 4,
      exploration: [3, 5],
    },
    {
      warband_id: PLAYER.warband!.id,
      warband_name: PLAYER.warband!.name,
      kills: 1,
      ooas: 2,
      deaths: ["Black Fang"],
      xp_gain: 2,
      exploration: [2],
    },
  ],
});

export const pivotalMoment = (): CampaignPivotalMoment => ({
  id: 3,
  kind: "hero_death",
  headline: "Black Fang falls in the market",
  detail: "Cut down by Captain Wolf.",
  unit_key: "hero:2",
  unit_name: "Black Fang",
  warband_id: PLAYER.warband!.id,
  warband_name: PLAYER.warband!.name,
  battle_id: 40,
  battle_scenario: "Skirmish at the Market Square",
  source_event_id: 12,
  battle_ended_at: "2026-10-12T22:00:00Z",
  date: "2026-10-12",
});

/** A reported result waiting for your answer, as `pending-results/` lists it. */
export const pendingResultRow = (
  overrides: Partial<PendingReportedResult> = {}
): PendingReportedResult => ({
  battle_id: 41,
  campaign_id: CAMPAIGN_ID,
  status: "reported_result_pending",
  scenario: "Ambush at the Bridge",
  battle_date: "2026-10-17",
  winner_warband_ids: [PLAYER.warband!.id],
  winner_warband_names: [PLAYER.warband!.name],
  created_by_user_id: PLAYER.id,
  created_by_user_label: PLAYER.name,
  created_at: "2026-10-17T20:00:00Z",
  participants: [
    {
      user_id: OWNER.id,
      user_label: OWNER.name,
      warband_id: OWNER.warband!.id,
      warband_name: OWNER.warband!.name,
      status: "reported_result_pending",
    },
    {
      user_id: PLAYER.id,
      user_label: PLAYER.name,
      warband_id: PLAYER.warband!.id,
      warband_name: PLAYER.warband!.name,
      status: "reported_result_approved",
    },
  ],
  awaiting_my_answer: true,
  can_withdraw: false,
  ...overrides,
});

export const encampment = (overrides: Partial<CampaignEncampment> = {}): CampaignEncampment => ({
  id: 4,
  campaign_id: CAMPAIGN_ID,
  name: "Sailmakers' Row",
  owner_id: PLAYER.id,
  owner_name: PLAYER.name,
  description: "Rope, canvas and a dry place to sleep.",
  ...overrides,
});

/** A chat message as `messages/` returns it and `chat.message` carries it. */
export const chatMessage = (
  id: number,
  author: Person,
  body: string,
  overrides: Partial<CampaignMessage> = {}
): CampaignMessage => ({
  id,
  campaign_id: CAMPAIGN_ID,
  user_id: author.id,
  username: author.name,
  body,
  created_at: "2026-10-18T20:00:00Z",
  ...overrides,
});

export const CHAT_CHANNEL = `private-campaign-${CAMPAIGN_ID}-chat`;

/** Your warband's sheet as the layout's store reads it (only the warband and its summary). */
const sheetOf = (person: Person) => ({
  warband: {
    id: person.warband!.id,
    campaign_id: CAMPAIGN_ID,
    user_id: person.id,
    name: person.warband!.name,
    faction: person.warband!.faction,
  },
  summary: { gold: 120, rating: 120, resources: [] },
  capabilities: {},
  heroes: [],
  henchmen_groups: [],
  hired_swords: [],
});

/**
 * Answers what the campaign shell reads: the campaign, your open battles, your warband and its
 * sheet, and the bell's notifications (RealtimeProvider). `viewer` owns the warband.
 */
export function routeCampaignShell({
  campaign = campaignSummary(),
  viewer = OWNER,
}: { campaign?: CampaignSummary; viewer?: Person } = {}) {
  fakeApi.on(`GET ${campaignApi()}`, campaign);
  fakeApi.on(`GET ${campaignApi("battles/?open=1")}`, []);
  fakeApi.on(
    `GET /warbands/?campaign_id=${CAMPAIGN_ID}`,
    viewer.warband ? [sheetOf(viewer).warband] : []
  );
  if (viewer.warband) {
    fakeApi.on(`GET /warbands/${viewer.warband.id}/sheet/`, sheetOf(viewer));
  }
  fakeApi.on("GET /notifications/", []);
}

/** Answers the overview's lists: players, completed trades, battle history, moments, results. */
export function routeOverviewLists() {
  fakeApi.on(`GET ${campaignApi("players/")}`, campaignPlayers());
  fakeApi.on(`GET ${campaignApi("trade-requests/?status=completed")}`, []);
  fakeApi.on(`GET ${campaignApi("battle-history/")}`, [battleHistoryEntry()]);
  fakeApi.on(`GET ${campaignApi("pivotal-moments/")}`, [pivotalMoment()]);
  fakeApi.on(`GET ${campaignApi("battles/pending-results/")}`, []);
}

/** The PATCH answer: the campaign with the change, without the caller's permissions or flags. */
export function patchedCampaign(campaign: CampaignSummary, body: unknown): CampaignSummary {
  const { permissions: _permissions, capabilities: _capabilities, ...rest } = campaign;
  return { ...rest, ...(body as Partial<CampaignSummary>) };
}
