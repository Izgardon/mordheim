import { Link, useMatch, useResolvedPath } from "react-router-dom";
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

type SidebarLinkProps = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Active only on this exact path (the overview), not on the pages below it. */
  end?: boolean;
  /** Whether the link shows as active when its page is open. */
  showsActive?: boolean;
};

/** A real link styled as a nav button (CAMP-UX-07): no button inside a link. */
function SidebarLink({ to, label, icon: Icon, end = false, showsActive = true }: SidebarLinkProps) {
  const { pathname } = useResolvedPath(to);
  const isActive = Boolean(useMatch({ path: pathname, end })) && showsActive;
  return (
    <Button
      asChild
      variant="nav"
      size="default"
      data-active={isActive}
      className="h-11 w-full justify-start gap-3 px-3"
    >
      <Link to={to} aria-current={isActive ? "page" : undefined}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </Link>
    </Button>
  );
}

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
        {navItems.map((item) => (
          <SidebarLink
            key={item.label}
            to={item.path ? `${basePath}/${item.path}` : basePath}
            label={item.label}
            icon={item.icon}
            end={item.path === ""}
          />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-border/70 pt-3">
        <SidebarLink to="/campaigns" label="Back To Campaigns" icon={LogOut} showsActive={false} />
        <SidebarLink to={`${basePath}/settings`} label="Settings" icon={Settings} />
      </div>
    </div>
  );
}
