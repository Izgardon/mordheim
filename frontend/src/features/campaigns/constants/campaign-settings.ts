import type { CampaignMember } from "../types/campaign-types";

export const permissionOptions = [
  {
    code: "manage_skills",
    label: "Manage skills",
    description: "Create and curate skills for the campaign.",
  },
  {
    code: "manage_items",
    label: "Manage items",
    description: "Add and maintain wargear entries.",
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
] as const;

export const roleTone: Record<CampaignMember["role"], string> = {
  owner: "bg-primary/15 text-primary border-primary/30",
  admin: "bg-accent/15 text-accent border-accent/30",
  player: "bg-secondary/40 text-foreground border-border/60",
};

export const roleLabel = (role: CampaignMember["role"]) =>
  `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
