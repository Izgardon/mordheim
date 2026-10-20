import type { CampaignMember } from "../types/campaign-types";

export const roleTone: Record<CampaignMember["role"], string> = {
  owner: "bg-primary/15 text-primary border-primary/30",
  admin: "bg-accent/15 text-accent border-accent/30",
  player: "bg-secondary/40 text-foreground border-border/60",
};

export const roleLabel = (role: CampaignMember["role"]) =>
  `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
