import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { LogOut, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { CampaignSummary } from "../../types/campaign-types";

type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
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
    <div className={cn("flex h-full flex-col gap-3 p-3 text-foreground", className)}>
      <div className="flex items-center justify-between border-b border-border/70 px-1 pb-3">
        <div className="min-w-0">
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
            Campaign
          </p>
          <p className="truncate text-sm font-semibold text-foreground">{campaign.name}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const target = item.path ? `${basePath}/${item.path}` : basePath;
          const Icon = item.icon;
          return (
            <NavLink key={item.label} to={target} end={item.path === ""}>
              {({ isActive }) => (
                <Button
                  variant="nav"
                  size="default"
                  data-active={isActive}
                  className="h-11 w-full justify-start gap-3 px-3"
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Button>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-border/70 pt-3">
        <NavLink to="/campaigns">
          <Button
            variant="nav"
            size="default"
            className="h-11 w-full justify-start gap-3 px-3"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Back To Campaigns</span>
          </Button>
        </NavLink>
        <NavLink to={`${basePath}/settings`}>
          {({ isActive }) => (
            <Button
              variant="nav"
              size="default"
              data-active={isActive}
              className="h-11 w-full justify-start gap-3 px-3"
            >
              <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Settings</span>
            </Button>
          )}
        </NavLink>
      </div>
    </div>
  );
}
