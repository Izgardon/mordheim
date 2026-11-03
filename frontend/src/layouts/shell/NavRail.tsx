import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Settings, UserRound } from "lucide-react";

import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { cn } from "@/lib/utils";

import {
  BATTLES_ICON,
  isAftermathPath,
  OVERVIEW_LINK,
  REFERENCE_LINKS,
  SEARCH_LINK,
  warbandLinks,
  type NavLink,
} from "./campaign-nav";

const ROW = "flex min-h-9 items-center gap-2.5 px-2.5 py-2 text-sm transition-colors";
const IDLE = "text-text2 hover:bg-raised hover:text-head";
const CURRENT = "bg-raised text-head shadow-[inset_2px_0_0_var(--color-accent)]";

function RailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="px-2.5 pb-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
        {title}
      </h2>
      {children}
    </div>
  );
}

function RailLink({
  to,
  label,
  icon: Icon,
  current,
  indent = false,
}: {
  to: string;
  label: string;
  icon?: LucideIcon;
  current: boolean;
  indent?: boolean;
}) {
  return (
    <Link
      to={to}
      aria-current={current ? "page" : undefined}
      className={cn(ROW, current ? CURRENT : IDLE, indent && "pl-9")}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      {label}
    </Link>
  );
}

type NavRailProps = {
  campaign: CampaignSummary;
  userName: string;
  /** The dice, chat and notifications buttons (`CampaignTools`). */
  tools: ReactNode;
  /** A battle you can go back to: Rejoin beside Battles goes there. */
  onRejoinBattle?: () => void;
};

/**
 * The web shell's left rail (232 px, design E), under the web bar: campaign, tools, sections,
 * you.
 */
export default function NavRail({ campaign, userName, tools, onRejoinBattle }: NavRailProps) {
  const { pathname } = useLocation();
  const base = `/campaigns/${campaign.id}`;
  const to = (link: NavLink) => (link.path ? `${base}/${link.path}` : base);
  const isCurrent = (path: string) =>
    path
      ? pathname === `${base}/${path}` || pathname.startsWith(`${base}/${path}/`)
      : pathname === base;
  // The Aftermath belongs to your warband (its post-game), not to the battle.
  const onAftermath = isAftermathPath(pathname);
  const onBattles = !onAftermath && isCurrent("battles");

  return (
    <nav aria-label="Campaign" className="flex min-h-full flex-col gap-[22px] px-3.5 py-[22px]">
      <div className="flex flex-col gap-1 px-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-text">
          Mordheim
        </span>
        {/* plain: the web bar's Campaigns leads back to the list */}
        <span className="font-display text-[19px] font-semibold leading-tight text-head">
          {campaign.name}
        </span>
        <span className="text-xs text-faint">
          {campaign.player_count} {campaign.player_count === 1 ? "player" : "players"}
        </span>
      </div>

      <div role="group" aria-label="Table tools" className="grid grid-cols-3 gap-1.5 px-2.5">
        {tools}
      </div>

      <RailSection title="Campaign">
        <RailLink
          to={base}
          label={OVERVIEW_LINK.label}
          icon={OVERVIEW_LINK.icon}
          current={isCurrent("")}
        />
        <div className="relative flex flex-col">
          <RailLink
            to={`${base}/battles`}
            label="Battles"
            icon={BATTLES_ICON}
            current={onBattles}
          />
          {onRejoinBattle ? (
            <button
              type="button"
              onClick={onRejoinBattle}
              className="absolute inset-y-0 right-0 px-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-accent-text hover:text-accent-hi"
            >
              Rejoin
            </button>
          ) : null}
        </div>
      </RailSection>

      <RailSection title="My warband">
        {warbandLinks(campaign).map((link) => (
          <RailLink
            key={link.path}
            to={to(link)}
            label={link.label}
            icon={link.icon}
            current={isCurrent(link.path) || (onAftermath && link.path === "warband")}
          />
        ))}
      </RailSection>

      <RailSection title="Reference">
        <RailLink
          to={to(SEARCH_LINK)}
          label={SEARCH_LINK.label}
          icon={SEARCH_LINK.icon}
          current={isCurrent(SEARCH_LINK.path)}
        />
        {REFERENCE_LINKS.map((link) => (
          <RailLink
            key={link.path}
            to={to(link)}
            label={link.label}
            current={isCurrent(link.path)}
            indent
          />
        ))}
      </RailSection>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-3.5">
        <RailLink
          to={`${base}/account`}
          label={userName || "Account"}
          icon={UserRound}
          current={isCurrent("account")}
        />
        <RailLink
          to={`${base}/settings`}
          label="Settings"
          icon={Settings}
          current={isCurrent("settings")}
        />
      </div>
    </nav>
  );
}
