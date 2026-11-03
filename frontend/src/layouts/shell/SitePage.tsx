import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutList, LogOut, UserRound } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import WebTopBar, { WebTopBarLink } from "./WebTopBar";

const PAGES = [
  { to: "/campaigns", label: "Campaigns", icon: LayoutList },
  { to: "/account", label: "Account", icon: UserRound },
] as const;

/**
 * The page column's width on the web, centred: the campaigns list wide, Account the Settings
 * page's 1120 px column (plus this frame's 40 px gutters).
 */
const WIDTH = { wide: "max-w-[1440px]", narrow: "max-w-[1200px]" } as const;

/** The wordmark: the web bar's main part on these pages. */
function Wordmark() {
  return (
    <span className="flex flex-col gap-0.5 leading-none">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-text">
        Mordheim
      </span>
      <span className="font-display text-lg font-semibold leading-none text-head">Chronicler</span>
    </span>
  );
}

/** The phone's bar: the wordmark, the two pages and Log out as icons. */
function PhoneBar() {
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-rail pb-2 pl-4 pr-3 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
      <Link to="/campaigns" className="hover:text-head">
        <Wordmark />
      </Link>
      <nav aria-label="Pages" className="flex items-center gap-1">
        {PAGES.map(({ to, label, icon: Icon }) => {
          const current = pathname === to;
          return (
            <IconButton
              key={to}
              asChild
              look="plain"
              aria-label={label}
              className={cn(current && "text-accent-text")}
            >
              <Link to={to} aria-current={current ? "page" : undefined}>
                <Icon aria-hidden="true" />
              </Link>
            </IconButton>
          );
        })}
        <IconButton look="plain" aria-label="Log out" onClick={signOut}>
          <LogOut aria-hidden="true" />
        </IconButton>
      </nav>
    </header>
  );
}

/**
 * The frame of the signed-in pages outside a campaign, the campaigns list and Account (design E),
 * then the page, which scrolls inside it (the body never does). On the web the bar is the
 * permanent web bar (Campaigns and Log out on its left, the wordmark, Account at its right end);
 * a phone keeps its own bar, with the wordmark, the two pages and Log out as icons.
 */
export default function SitePage({
  children,
  width = "wide",
}: {
  children: ReactNode;
  width?: keyof typeof WIDTH;
}) {
  const isMobile = useMediaQuery("(max-width: 960px)");

  return (
    <div className="fixed inset-0 flex flex-col bg-page">
      {isMobile ? (
        <PhoneBar />
      ) : (
        <WebTopBar
          className="shrink-0"
          end={
            <nav aria-label="Pages" className="flex items-stretch">
              <WebTopBarLink to="/account" icon={<UserRound aria-hidden="true" />}>
                Account
              </WebTopBarLink>
            </nav>
          }
        >
          <Wordmark />
        </WebTopBar>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div
          className={cn(
            "mx-auto flex w-full flex-col",
            isMobile ? "gap-5 px-4 pb-10 pt-5" : cn(WIDTH[width], "gap-8 px-10 pb-16 pt-9")
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
