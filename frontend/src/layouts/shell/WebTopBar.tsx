import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutList, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { cn } from "@/lib/utils";

/** The main part's ground: plain, a band (Between battles) or the accent (something waits). */
const TONE = { plain: "", band: "bg-bar", accent: "bg-accent-soft" } as const;
export type WebTopBarTone = keyof typeof TONE;

/** The bar's links: the campaigns list's and Account's, current on their own page. */
export function WebTopBarLink({
  to,
  icon,
  children,
}: {
  to: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const current = useLocation().pathname === to;
  return (
    <Link
      to={to}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex h-full items-center gap-2 px-2.5 text-sm font-semibold transition-colors [&_svg]:size-4",
        current
          ? "text-head shadow-[inset_0_-2px_0_var(--color-accent)]"
          : "text-text2 hover:text-head"
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

/**
 * The web's bar across the top of every signed-in page, the campaigns list, Account and every
 * campaign page with the battle screens (William: "the top bar on web should be permanent, its
 * main content changes depending on page/urgency but its top left slots remain Log out and
 * Campaigns"): Campaigns and Log out on the left, over the rail's width, never changing; then what
 * the page puts in it, in the page's column; then `end`. A phone keeps its own top bars.
 */
export default function WebTopBar({
  children,
  tone = "plain",
  end,
  className,
}: {
  children?: ReactNode;
  tone?: WebTopBarTone;
  end?: ReactNode;
  className?: string;
}) {
  const { signOut } = useAuth();
  return (
    <header className={cn("flex min-h-14 border-b border-line bg-rail", className)}>
      <nav
        aria-label="Site"
        className="flex w-[232px] shrink-0 items-stretch gap-1 border-r border-line px-3.5"
      >
        <WebTopBarLink to="/campaigns" icon={<LayoutList aria-hidden="true" />}>
          Campaigns
        </WebTopBarLink>
        <Button variant="ghost" size="sm" className="my-auto text-danger" onClick={signOut}>
          <LogOut aria-hidden="true" />
          Log out
        </Button>
      </nav>
      <div className={cn("flex min-w-0 flex-1 items-center px-10 py-2", TONE[tone])}>
        <div className="mx-auto flex w-full min-w-0 max-w-[1520px] items-center">{children}</div>
      </div>
      {end ? <div className="flex shrink-0 items-stretch pr-6">{end}</div> : null}
    </header>
  );
}
