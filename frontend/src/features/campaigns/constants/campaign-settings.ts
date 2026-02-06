import type { CampaignMember } from "../types/campaign-types";

export const permissionOptions = [
  {
    code: "add_custom",
    label: "Add custom",
    description: "Add new custom items, skills, spells, and features.",
  },
  {
    code: "manage_items",
    label: "Manage items",
    description: "Edit or remove existing wargear entries.",
  },
  {
    code: "manage_skills",
    label: "Manage skills",
    description: "Edit or remove skills in the campaign.",
  },
  {
    code: "manage_rules",
    label: "Manage house rules",
    description: "Draft and adjust campaign house rules.",
  },
  {
    code: "manage_warbands",
    label: "Manage warbands",
    description: "Oversee warband actions and rosters.",
  },
  {
    code: "manage_locations",
    label: "Manage locations",
    description: "Plan and manage campaign locations.",
  },
] as const;

export const roleTone: Record<CampaignMember["role"], string> = {
  owner: "bg-primary/15 text-primary border-primary/30",
  admin: "bg-accent/15 text-accent border-accent/30",
  player: "bg-secondary/40 text-foreground border-border/60",
};

export const roleLabel = (role: CampaignMember["role"]) =>
  `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
