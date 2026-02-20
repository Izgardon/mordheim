import { NavLink } from "react-router-dom";

// components
import { Button } from "@/components/ui/button";
import { CardBackground } from "@/components/ui/card-background";
import TradeNotificationsMenu from "@/features/realtime/components/TradeNotificationsMenu";

// utils
import { cn } from "@/lib/utils";

// assets
import gearIcon from "@/assets/components/gear.webp";
import backIcon from "@/assets/components/back.webp";
import ratio1Short from "@/assets/card_background/1_short.webp";

// types
import type { CampaignSummary } from "../../types/campaign-types";
import type { TradeNotification } from "@/features/warbands/types/trade-request-types";

type NavItem = {
  label: string;
  path: string;
};

type CampaignSidebarProps = {
  campaign: CampaignSummary;
  campaignId: string;
  navItems: NavItem[];
  notifications: TradeNotification[];
  onAcceptNotification: (notification: TradeNotification) => void;
  onDeclineNotification: (notification: TradeNotification) => void;
  className?: string;
};

export default function CampaignSidebar({
  campaign,
  campaignId,
  navItems,
  notifications,
  onAcceptNotification,
  onDeclineNotification,
  className,
}: CampaignSidebarProps) {
  const basePath = `/campaigns/${campaignId}`;

  return (
    <div
      className={cn("flex h-full flex-col gap-4 py-4 text-foreground", className)}
    >
      {/* Campaign Info Section */}
      <CardBackground
        className="px-6 py-6 text-center"
        ratioSets={[
          { images: [{ minWidth: 0, src: ratio1Short }], isDefault: true },
        ]}
      >
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
      </CardBackground>

      {/* Nav Section */}
      <CardBackground className="flex flex-1 flex-col px-6 py-6">
        <nav className="flex flex-col gap-3">
          {navItems.map((item) => {
            const target = item.path ? `${basePath}/${item.path}` : basePath;
            return (
              <NavLink
                key={item.label}
                to={target}
                end={item.path === ""}
              >
                {({ isActive }) => (
                  <Button
                    variant="primaryHover"
                    size="lg"
                    className={cn("w-full text-[0.7rem]", isActive && "button-active")}
                  >
                    {item.label}
                  </Button>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-4 pt-4">
          <div className="flex items-center justify-between rounded-xl border border-[#2b2117]/80 bg-[#0f0c09] px-4 py-3">
            <div className="flex flex-col gap-1">
              <span className="text-[0.55rem] uppercase tracking-[0.3em] text-muted-foreground">
                Notifications
              </span>
              <span className="text-xs text-foreground">
                {notifications.length} pending
              </span>
            </div>
            <TradeNotificationsMenu
              notifications={notifications}
              onAccept={onAcceptNotification}
              onDecline={onDeclineNotification}
              className="h-10 w-10"
            />
          </div>
          <div className="flex justify-between">
          <NavLink
            to="/campaigns"
            className="settings-gear-btn"
            title="Back to Campaigns"
          >
            <img src={backIcon} alt="Back to Campaigns" className="!h-8 !w-8" />
          </NavLink>
          <NavLink
            to={`${basePath}/settings`}
            className="settings-gear-btn"
            title="Settings"
          >
            <img src={gearIcon} alt="Settings" className="!h-8 !w-8" />
          </NavLink>
          </div>
        </div>
      </CardBackground>
    </div>
  );
}
