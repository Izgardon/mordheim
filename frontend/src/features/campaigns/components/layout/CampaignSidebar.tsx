import { NavLink } from "react-router-dom";

// components
import { Button } from "@/components/ui/button";

// utils
import { cn } from "@/lib/utils";

// assets
import gearIcon from "@/assets/components/gear.png";
import gearIconHover from "@/assets/components/gear_hover.png";

// types
import type { CampaignSummary } from "../../types/campaign-types";

type NavItem = {
  label: string;
  path: string;
};

type CampaignSidebarProps = {
  campaign: CampaignSummary;
  campaignId: string;
  navItems: NavItem[];
  className?: string;
};

export default function CampaignSidebar({
  campaign,
  campaignId,
  navItems,
  className,
}: CampaignSidebarProps) {
  const basePath = `/campaigns/${campaignId}`;

  return (
    <div
      className={cn("flex h-full flex-col gap-2 px-6 py-8 text-foreground", className)}
    >
      <div className="px-2 py-4 text-center">
        <p className="text-[0.6rem] uppercase tracking-[0.35em] text-muted-foreground">
          Campaign
        </p>
        <h2 className="mt-2 font-display text-lg text-foreground md:text-xl">
          {campaign.name}
        </h2>
        <div className="mt-3 flex flex-col items-center gap-1 text-xs text-muted-foreground">
          <span className="uppercase tracking-[0.25em]">Join Code</span>
          <span className="text-sm font-semibold text-foreground">{campaign.join_code}</span>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-[0.65rem] uppercase tracking-[0.25em] text-muted-foreground">
          <span>Players</span>
          <span className="text-foreground">
            {campaign.player_count}/{campaign.max_players}
          </span>
        </div>
      </div>

      <nav className="flex flex-col gap-3 px-2 py-2">
        {navItems.map((item) => {
          const target = item.path ? `${basePath}/${item.path}` : basePath;
          return (
            <Button key={item.label} asChild size="lg" className="text-[0.7rem]">
              <NavLink
                to={target}
                end={item.path === ""}
                className={({ isActive }) => isActive ? "button-active" : ""}
              >
                {item.label}
              </NavLink>
            </Button>
          );
        })}
      </nav>

      <div className="mt-auto flex justify-center px-2 py-4">
        <NavLink
          to={`${basePath}/settings`}
          className="settings-gear-btn"
          title="Settings"
        >
          <img src={gearIcon} alt="Settings" className="gear-icon" />
          <img src={gearIconHover} alt="" className="gear-icon-hover" />
        </NavLink>
      </div>
    </div>
  );
}
