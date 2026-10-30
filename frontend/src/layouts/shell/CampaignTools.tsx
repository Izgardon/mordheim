import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Bell, Dices, MessageSquare } from "lucide-react";

import CampaignChatMenu from "@/features/realtime/components/CampaignChatMenu";
import CampaignDiceRollerMenu from "@/features/realtime/components/CampaignDiceRollerMenu";
import NotificationsMenu from "@/features/realtime/components/NotificationsMenu";
import { useNotifications } from "@/features/realtime/hooks/useNotifications";
import { cn } from "@/lib/utils";

export type CampaignTool = "dice" | "chat" | "bell";

type ToolButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  look: "rail" | "bar";
  icon: ReactNode;
  /** Shows the accent dot. */
  marked?: boolean;
};

/** One of the three table tools: a 44 px box on the rail's surface, or outlined in a bar. */
const ToolButton = forwardRef<HTMLButtonElement, ToolButtonProps>(
  ({ look, icon, marked = false, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "relative flex min-h-11 items-center justify-center border border-border text-text2 transition-colors hover:bg-raised hover:text-head focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-[18px]",
        look === "rail" ? "bg-surface" : "w-11 bg-transparent",
        className
      )}
      {...props}
    >
      {icon}
      {marked ? (
        <span aria-hidden="true" className="absolute right-2.5 top-2 h-[7px] w-[7px] bg-primary" />
      ) : null}
    </button>
  )
);
ToolButton.displayName = "ToolButton";

type CampaignToolsProps = {
  campaignId: number;
  open: CampaignTool | null;
  onOpenChange: (tool: CampaignTool | null) => void;
  /** Where the buttons sit; "none" renders only the dialogs (the battle bar opens them). */
  look: "rail" | "bar" | "none";
};

/**
 * The dice roller, the campaign chat and the notifications. The shell renders them once and owns
 * which is open, so the rail, the top bar and the battle menu all open the same dialogs.
 */
export default function CampaignTools({
  campaignId,
  open,
  onOpenChange,
  look,
}: CampaignToolsProps) {
  const notifications = useNotifications();
  const change = (tool: CampaignTool) => (isOpen: boolean) => onOpenChange(isOpen ? tool : null);
  const button = (label: string, icon: ReactNode, marked = false) =>
    look === "none" ? undefined : (
      <ToolButton look={look} icon={icon} marked={marked} aria-label={label} />
    );

  return (
    <>
      <CampaignDiceRollerMenu
        open={open === "dice"}
        onOpenChange={change("dice")}
        trigger={button("Dice roller", <Dices aria-hidden="true" />)}
      />
      <CampaignChatMenu
        campaignId={campaignId}
        open={open === "chat"}
        onOpenChange={change("chat")}
        trigger={
          look === "none"
            ? undefined
            : (unread) =>
                button(
                  unread > 0 ? `Chat, ${unread} unread` : "Chat",
                  <MessageSquare aria-hidden="true" />,
                  unread > 0
                )
        }
      />
      <NotificationsMenu
        tradeRequestNotifications={notifications.tradeRequestNotifications}
        battleInviteNotifications={notifications.battleInviteNotifications}
        battleResultRequestNotifications={notifications.battleResultRequestNotifications}
        onAcceptTrade={notifications.acceptTradeNotification}
        onDeclineTrade={notifications.declineTradeNotification}
        onAcceptBattleInvite={notifications.acceptBattleInviteNotification}
        onDeclineBattleInvite={notifications.declineBattleInviteNotification}
        onAcceptBattleResultRequest={notifications.acceptBattleResultRequestNotification}
        onDeclineBattleResultRequest={notifications.declineBattleResultRequestNotification}
        battleNudgeNotifications={notifications.battleNudgeNotifications}
        onGoToNudge={notifications.goToBattleNudge}
        onDismissNudge={notifications.dismissBattleNudge}
        onClear={notifications.clearNotifications}
        open={open === "bell"}
        onOpenChange={change("bell")}
        trigger={
          look === "none"
            ? undefined
            : (count) =>
                button(
                  count > 0 ? `Notifications, ${count} new` : "Notifications",
                  <Bell aria-hidden="true" />,
                  count > 0
                )
        }
      />
    </>
  );
}
