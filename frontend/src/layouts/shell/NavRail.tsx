import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Moon, Sun } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

import {
  BATTLES_ICON,
  OVERVIEW_LINK,
  REFERENCE_LINKS,
  SEARCH_ICON,
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
  /** A battle you can go back to: Battles goes there instead of the overview. */
  onRejoinBattle?: () => void;
};

/** The web shell's left rail (232 px, design E): campaign, tools, sections, you. */
export default function NavRail({ campaign, userName, tools, onRejoinBattle }: NavRailProps) {
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useTheme();
  const base = `/campaigns/${campaign.id}`;
  const to = (link: NavLink) => (link.path ? `${base}/${link.path}` : base);
  const isCurrent = (path: string) =>
    path
      ? pathname === `${base}/${path}` || pathname.startsWith(`${base}/${path}/`)
      : pathname === base;
  const onBattle = pathname.startsWith(`${base}/battles/`);

  return (
    <nav aria-label="Campaign" className="flex min-h-full flex-col gap-[22px] px-3.5 py-[22px]">
      <div className="flex flex-col gap-1 px-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-text">
          Mordheim
        </span>
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
        {onRejoinBattle ? (
          <button type="button" onClick={onRejoinBattle} className={cn(ROW, IDLE, "text-left")}>
            <BATTLES_ICON className="h-4 w-4 shrink-0" aria-hidden="true" />
            Battles
            <span className="ml-auto text-[11px] font-bold uppercase tracking-[0.12em] text-accent-text">
              Rejoin
            </span>
          </button>
        ) : (
          <RailLink to={base} label="Battles" icon={BATTLES_ICON} current={onBattle} />
        )}
      </RailSection>

      <RailSection title="My warband">
        {warbandLinks(campaign).map((link) => (
          <RailLink
            key={link.path}
            to={to(link)}
            label={link.label}
            icon={link.icon}
            current={isCurrent(link.path)}
          />
        ))}
      </RailSection>

      <RailSection title="Reference">
        <span aria-disabled="true" className={cn(ROW, "cursor-not-allowed text-faint")}>
          <SEARCH_ICON className="h-4 w-4 shrink-0" aria-hidden="true" />
          Search everything
        </span>
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

      <div className="mt-auto flex flex-col gap-2 border-t border-line px-2.5 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/account"
            className="flex min-w-0 items-center gap-2.5 text-[13px] text-text2 hover:text-head"
          >
            <span
              aria-hidden="true"
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center bg-raised text-xs font-bold text-accent-text"
            >
              {userName.charAt(0).toUpperCase() || "?"}
            </span>
            <span className="truncate">{userName}</span>
          </Link>
          <IconButton
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            onClick={toggleTheme}
            className="h-9 w-9"
          >
            {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
          </IconButton>
        </div>
        <div className="flex items-center justify-between text-xs">
          <Link to={`${base}/settings`} className="py-1.5 text-faint hover:text-head">
            Settings
          </Link>
          <Link to="/campaigns" className="py-1.5 text-faint hover:text-head">
            All campaigns
          </Link>
        </div>
      </div>
    </nav>
  );
}
