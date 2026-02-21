import { NavLink } from "react-router-dom";

// components
import { Button } from "@/components/ui/button";
import { CardBackground } from "@/components/ui/card-background";
import CampaignDiceRollerMenu from "@/features/realtime/components/CampaignDiceRollerMenu";
import NotificationsMenu from "@/features/realtime/components/NotificationsMenu";

// utils
import { cn } from "@/lib/utils";

// assets
import gearIcon from "@/assets/components/gear.webp";
import backIcon from "@/assets/components/back.webp";
import ratio1Short from "@/assets/card_background/1_short.webp";

// types
import type { CampaignSummary } from "../../types/campaign-types";
import type { TradeNotification } from "@/features/warbands/types/trade-request-types";
import type { BattleInviteNotification } from "@/features/battles/types/battle-types";

type NavItem = {
  label: string;
  path: string;
};

type CampaignSidebarProps = {
  campaign: CampaignSummary;
  campaignId: string;
  navItems: NavItem[];
  tradeRequestNotifications: TradeNotification[];
  battleInviteNotifications: BattleInviteNotification[];
  onAcceptTradeNotification: (notification: TradeNotification) => void;
  onDeclineTradeNotification: (notification: TradeNotification) => void;
  onAcceptBattleInviteNotification: (notification: BattleInviteNotification) => void;
  onDismissBattleInviteNotification: (notification: BattleInviteNotification) => void;
  onClearNotifications?: () => void;
  className?: string;
};

export default function CampaignSidebar({
  campaign,
  campaignId,
  navItems,
  tradeRequestNotifications,
  battleInviteNotifications,
  onAcceptTradeNotification,
  onDeclineTradeNotification,
  onAcceptBattleInviteNotification,
  onDismissBattleInviteNotification,
  onClearNotifications,
  className,
}: CampaignSidebarProps) {
  const basePath = `/campaigns/${campaignId}`;

  return (
    <div
      className={cn("flex h-full flex-col gap-4 py-4 text-foreground", className)}
    >
      {/* Campaign Info Section */}
      <CardBackground
        className="relative px-6 py-6 text-left"
        ratioSets={[
          { images: [{ minWidth: 0, src: ratio1Short }], isDefault: true },
        ]}
      >
        <div className="absolute right-4 top-4 flex items-center gap-1">
          <CampaignDiceRollerMenu className="h-10 w-10" />
          <NotificationsMenu
            tradeRequestNotifications={tradeRequestNotifications}
            battleInviteNotifications={battleInviteNotifications}
            onAcceptTrade={onAcceptTradeNotification}
            onDeclineTrade={onDeclineTradeNotification}
            onAcceptBattleInvite={onAcceptBattleInviteNotification}
            onDismissBattleInvite={onDismissBattleInviteNotification}
            onClear={onClearNotifications}
            className="h-10 w-10"
          />
        </div>
        <div className="pr-24">
          <p className="text-[0.6rem] uppercase tracking-[0.35em] text-muted-foreground">
            Campaign
          </p>
          <h2 className="mt-2 font-display text-lg text-foreground md:text-xl">
            {campaign.name}
          </h2>
          <div className="mt-3 flex flex-col items-start gap-1 text-xs text-muted-foreground">
            <span className="uppercase tracking-[0.25em]">Join Code</span>
            <span className="text-sm font-semibold text-foreground">{campaign.join_code}</span>
          </div>
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
