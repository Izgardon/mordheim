import { NavLink } from "react-router-dom";

// utils
import { cn } from "@/lib/utils";

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
  canManageSettings: boolean;
  onSignOut: () => void;
  onNavigate?: () => void;
  className?: string;
};

export default function CampaignSidebar({
  campaign,
  campaignId,
  navItems,
  canManageSettings,
  onSignOut,
  onNavigate,
  className,
}: CampaignSidebarProps) {
  const basePath = `/campaigns/${campaignId}`;
  const handleNavigate = () => {
    onNavigate?.();
  };

  const handleSignOut = () => {
    onSignOut();
    onNavigate?.();
  };

  return (
    <aside
      className={cn(
        "rpg-sidebar flex h-full flex-col gap-6 px-5 py-6 text-foreground",
        className
      )}
    >
      <div className="rpg-card rpg-card--frame rounded-none px-4 py-5 text-center">
        <p className="text-[0.6rem] uppercase tracking-[0.35em] text-muted-foreground">
          Campaign
        </p>
        <h2 className="mt-2 font-mordheim text-lg text-foreground md:text-xl">
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

      <div className="rpg-card rpg-card--frame rounded-none px-4 py-4">
        <p className="text-[0.6rem] uppercase tracking-[0.35em] text-muted-foreground">
          Navigation
        </p>
        <nav className="mt-3 flex flex-col gap-2">
          {navItems.map((item) => {
            const target = item.path ? `${basePath}/${item.path}` : basePath;
            return (
              <NavLink
                key={item.label}
                to={target}
                onClick={handleNavigate}
                className={({ isActive }) =>
                  cn(
                    "rpg-nav-item flex items-center justify-center px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em]",
                    isActive ? "rpg-nav-item--active text-foreground" : "rpg-nav-item--inactive text-muted-foreground"
                  )
                }
                end={item.path === ""}
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {canManageSettings ? (
        <div className="rpg-card rpg-card--frame rounded-none px-4 py-4">
          <p className="text-[0.6rem] uppercase tracking-[0.35em] text-muted-foreground">
            Management
          </p>
          <div className="mt-3">
            <NavLink
              to={`${basePath}/settings`}
              onClick={handleNavigate}
              className={({ isActive }) =>
                cn(
                  "rpg-nav-item flex items-center justify-center px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em]",
                  isActive ? "rpg-nav-item--active text-foreground" : "rpg-nav-item--inactive text-muted-foreground"
                )
              }
            >
              Settings
            </NavLink>
          </div>
        </div>
      ) : null}

      <div className="mt-auto rpg-card rpg-card--frame rounded-none px-4 py-4">
        <p className="text-[0.6rem] uppercase tracking-[0.35em] text-muted-foreground">
          Session
        </p>
        <div className="mt-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="rpg-nav-item rpg-nav-item--inactive flex w-full items-center justify-center px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-muted-foreground transition hover:text-foreground"
          >
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
