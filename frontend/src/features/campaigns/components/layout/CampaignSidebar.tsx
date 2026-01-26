// routing
import { Link, NavLink } from "react-router-dom";

// types
import type { CampaignSummary } from "../../types/campaign-types";

type CampaignNavItem = {
  label: string;
  path: string;
};

type CampaignSidebarProps = {
  campaign: CampaignSummary;
  campaignId: string;
  canManageSettings: boolean;
  onSignOut: () => void;
  navItems: CampaignNavItem[];
  className?: string;
  onNavigate?: () => void;
};

export default function CampaignSidebar({
  campaign,
  campaignId,
  canManageSettings,
  onSignOut,
  navItems,
  className,
  onNavigate,
}: CampaignSidebarProps) {
  return (
    <aside
      className={[
        "flex h-full w-64 flex-col space-y-6 overflow-y-auto border-r border-border/70 bg-card/90 p-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div>
        <p className="mt-2 text-lg font-semibold text-foreground">{campaign.name}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {campaign.campaign_type_name}
        </p>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-6">
        <div className="space-y-4">
          <Link
            to="/campaigns"
            onClick={onNavigate}
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase leading-none tracking-[0.25em] text-muted-foreground transition hover:text-foreground"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-4 w-4 items-center justify-center text-[11px] leading-none"
            >
              ‹
            </span>
            Back to Campaigns
          </Link>
          <div className="border-t border-border/70" />
          <nav className="space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={`/campaigns/${campaignId}/${item.path}`.replace(/\/$/, "")}
                end={item.path === ""}
                onClick={onNavigate}
                className={({ isActive }) =>
                  [
                    "flex items-center justify-between rounded-xl border border-border/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
                    isActive
                      ? "border-primary/60 bg-primary text-primary-foreground shadow-[0_10px_25px_rgba(5,20,24,0.4)]"
                      : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/40 hover:text-foreground",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-4 border-t border-border/70 pt-4">
              <NavLink
                to={`/campaigns/${campaignId}/rules`}
                onClick={onNavigate}
                className={({ isActive }) =>
                  [
                    "flex items-center justify-between rounded-xl border border-border/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
                    isActive
                      ? "border-primary/60 bg-primary text-primary-foreground shadow-[0_10px_25px_rgba(5,20,24,0.4)]"
                      : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/40 hover:text-foreground",
                  ].join(" ")
                }
              >
                Rules
              </NavLink>
            </div>
            {canManageSettings ? (
              <div className="mt-4 border-t border-border/70 pt-4">
                <NavLink
                  to={`/campaigns/${campaignId}/settings`}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    [
                      "flex items-center justify-between rounded-xl border border-border/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
                      isActive
                        ? "border-primary/60 bg-primary text-primary-foreground shadow-[0_10px_25px_rgba(5,20,24,0.4)]"
                        : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/40 hover:text-foreground",
                    ].join(" ")
                  }
                >
                  Settings
                </NavLink>
              </div>
            ) : null}
          </nav>
        </div>
        <button
          type="button"
          onClick={() => {
            onSignOut();
            if (onNavigate) {
              onNavigate();
            }
          }}
          className="flex items-center justify-between rounded-xl border border-destructive/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-destructive transition hover:border-destructive hover:bg-destructive/15"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}


