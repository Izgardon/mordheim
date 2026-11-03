import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutList, LogOut, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

const PAGES = [
  { to: "/campaigns", label: "Campaigns", icon: LayoutList },
  { to: "/account", label: "Account", icon: UserRound },
] as const;

/**
 * The page column's width on the web, centred: the campaigns list wide, Account the Settings
 * page's 1120 px column (plus this frame's 40 px gutters).
 */
const WIDTH = { wide: "max-w-[1440px]", narrow: "max-w-[1200px]" } as const;

/**
 * The frame of the signed-in pages outside a campaign, the campaigns list and Account (design E):
 * a bar with the wordmark, the two pages, the light/dark switch and Log out, then the page. The
 * page scrolls inside it (the body never does). A phone gets the same bar with icons.
 */
export default function SitePage({
  children,
  width = "wide",
}: {
  children: ReactNode;
  width?: keyof typeof WIDTH;
}) {
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  const isMobile = useMediaQuery("(max-width: 960px)");

  return (
    <div className="fixed inset-0 flex flex-col bg-page">
      <header
        className={cn(
          "flex shrink-0 items-center justify-between gap-3 border-b border-line bg-rail",
          isMobile ? "pb-2 pl-4 pr-3 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]" : "h-16 px-10"
        )}
      >
        <Link to="/campaigns" className="flex flex-col gap-0.5 leading-none hover:text-head">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-text">
            Mordheim
          </span>
          <span className="font-display text-lg font-semibold leading-none text-head">
            Chronicler
          </span>
        </Link>
        <nav aria-label="Pages" className="flex items-center gap-1">
          {PAGES.map(({ to, label, icon: Icon }) => {
            const current = pathname === to;
            return isMobile ? (
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
            ) : (
              <Link
                key={to}
                to={to}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-16 items-center px-3 text-sm font-semibold transition-colors",
                  current
                    ? "text-head shadow-[inset_0_-2px_0_var(--color-accent)]"
                    : "text-text2 hover:text-head"
                )}
              >
                {label}
              </Link>
            );
          })}
          {isMobile ? (
            <IconButton look="plain" aria-label="Log out" onClick={signOut}>
              <LogOut aria-hidden="true" />
            </IconButton>
          ) : (
            <Button variant="ghost" size="sm" className="text-danger" onClick={signOut}>
              Log out
            </Button>
          )}
        </nav>
      </header>
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
