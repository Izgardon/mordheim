import type { CampaignCapability } from "@/features/campaigns/capabilities";
import type {
  CampaignEncampment,
  CampaignPermission,
  CampaignRole,
  CampaignSummary,
} from "@/features/campaigns/types/campaign-types";

export const CAMPAIGN_ID = 1;

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

/** `GET permissions/`: the server's seven codes with labels and descriptions, in its order. */
export const PERMISSION_CATALOGUE: CampaignPermission[] = [
  [
    "edit_catalogue",
    "Edit catalogue",
    "Add and edit the campaign's custom items, skills, spells, specials, races, bestiary entries and hired swords, and add item properties.",
  ],
  [
    "delete_catalogue",
    "Delete catalogue",
    "Delete the campaign's custom catalogue entries that nothing uses.",
  ],
  ["manage_rules", "Manage rules", "Add, edit and delete the campaign's house rules."],
  ["manage_warbands", "Manage warbands", "Edit every warband in the campaign, not just their own."],
  [
    "manage_encampments",
    "Manage encampments",
    "Edit, reassign and remove every encampment, not just their own.",
  ],
  ["manage_locations", "Manage locations", "Add and edit the campaign's locations."],
  [
    "manage_battles",
    "Manage battles",
    "See Settings > Active Battles, end, close or cancel stuck battles and edit past battle records.",
  ],
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
    "role" | "permissions" | "enable_encampments" | "enable_locations" | "archived_at"
  >
): Record<CampaignCapability, boolean> {
  const isOwner = campaign.role === "owner";
  const isStaff = isOwner || campaign.role === "admin";
  const holds = (code: string) => isStaff || (campaign.permissions ?? []).includes(code);
  const flags: Record<CampaignCapability, boolean> = {
    edit_settings: isOwner,
    start: isStaff,
    delete: false,
    regenerate_join_code: isStaff,
    view_members: isStaff,
    grant_permissions: isStaff,
    change_roles: isOwner,
    remove_members: isStaff,
    hand_over: isOwner,
    archive: isOwner,
    restore: false,
    remove_posts: isStaff,
    leave: !isOwner,
    edit_catalogue: holds("edit_catalogue"),
    delete_catalogue: holds("delete_catalogue"),
    manage_rules: holds("manage_rules"),
    manage_warbands: holds("manage_warbands"),
    manage_encampments: Boolean(campaign.enable_encampments) && holds("manage_encampments"),
    manage_locations: Boolean(campaign.enable_locations) && holds("manage_locations"),
    manage_battles: holds("manage_battles"),
  };
  if (!campaign.archived_at) {
    return flags;
  }
  // Archived: read-only for everyone; the owner may restore it or delete it for good.
  const archived = Object.fromEntries(Object.keys(flags).map((key) => [key, false])) as Record<
    CampaignCapability,
    boolean
  >;
  return { ...archived, view_members: isStaff, restore: isOwner, delete: isOwner };
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
 * granted (joining grants `edit_catalogue`).
 */
export function campaignFor(role: CampaignRole, overrides: Partial<CampaignSummary> = {}) {
  const permissions = role === "player" ? ["edit_catalogue"] : ALL_PERMISSION_CODES;
  return campaignSummary({ role, permissions, ...overrides });
}

export const encampment = (overrides: Partial<CampaignEncampment> = {}): CampaignEncampment => ({
  id: 4,
  campaign_id: CAMPAIGN_ID,
  name: "Sailmakers' Row",
  owner_id: PLAYER.id,
  owner_name: PLAYER.name,
  owner_left: false,
  description: "Rope, canvas and a dry place to sleep.",
  capabilities: { edit: true },
  ...overrides,
});
