// routing
import { Link, NavLink } from "react-router-dom";

// types
import type { CampaignSummary } from "../types/campaign-types";

type CampaignNavItem = {
  label: string;
  path: string;
};

type CampaignSidebarProps = {
  campaign: CampaignSummary;
  campaignId: string;
  isOwner: boolean;
  onSignOut: () => void;
  navItems: CampaignNavItem[];
  className?: string;
  onNavigate?: () => void;
};

export default function CampaignSidebar({
  campaign,
  campaignId,
  isOwner,
  onSignOut,
  navItems,
  className,
  onNavigate,
}: CampaignSidebarProps) {
  return (
    <aside
      className={[
        "flex h-[calc(100vh-5rem)] w-full max-w-[260px] flex-col space-y-6 overflow-y-auto rounded-2xl border-2 border-border/70 bg-card/80 p-4 shadow-[6px_6px_0_rgba(23,16,8,0.2)] lg:sticky lg:top-10 lg:self-stretch",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div>
        <p className="mt-2 text-lg font-semibold text-foreground">{campaign.name}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {campaign.campaign_type}
        </p>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-6">
        <div className="space-y-4">
          <Link
            to="/campaigns"
            onClick={onNavigate}
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground transition hover:text-foreground"
          >
            <span aria-hidden="true" className="text-base leading-none">‹</span>
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
                  onClick={onNavigate}
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
        </div>
        <button
          type="button"
          onClick={() => {
            onSignOut();
            if (onNavigate) {
              onNavigate();
            }
          }}
          className="flex items-center justify-between rounded-md border-2 border-destructive/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-destructive transition hover:border-destructive hover:bg-destructive/10"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}




