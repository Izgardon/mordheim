import { NavLink } from "react-router-dom";

import type { CampaignSummary } from "../types/campaign-types";

type CampaignNavItem = {
  label: string;
  path: string;
};

type CampaignSidebarProps = {
  campaign: CampaignSummary;
  campaignId: string;
  isOwner: boolean;
  navItems: CampaignNavItem[];
};

export default function CampaignSidebar({
  campaign,
  campaignId,
  isOwner,
  navItems,
}: CampaignSidebarProps) {
  return (
    <aside className="h-full w-full max-w-[260px] space-y-6 rounded-2xl border-2 border-border/70 bg-card/80 p-4 shadow-[6px_6px_0_rgba(23,16,8,0.2)] lg:sticky lg:top-10 lg:self-stretch">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Campaign
        </p>
        <p className="mt-2 text-lg font-semibold text-foreground">{campaign.name}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {campaign.campaign_type}
        </p>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={`/campaigns/${campaignId}/${item.path}`.replace(/\/$/, "")}
            end={item.path === ""}
            className={({ isActive }) =>
              [
                "flex items-center justify-between rounded-md border-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
                isActive
                  ? "border-foreground/70 bg-foreground text-background shadow-[2px_2px_0_rgba(23,16,8,0.3)]"
                  : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-accent/20 hover:text-foreground",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
        {isOwner ? (
          <div className="mt-4 border-t border-border/70 pt-4">
            <NavLink
              to={`/campaigns/${campaignId}/settings`}
              className={({ isActive }) =>
                [
                  "flex items-center justify-between rounded-md border-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
                  isActive
                    ? "border-foreground/70 bg-foreground text-background shadow-[2px_2px_0_rgba(23,16,8,0.3)]"
                    : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-accent/20 hover:text-foreground",
                ].join(" ")
              }
            >
              Settings
            </NavLink>
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
