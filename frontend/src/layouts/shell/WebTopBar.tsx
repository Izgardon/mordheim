import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutList, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { cn } from "@/lib/utils";

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
 * main content changes depending on page/urgency"), over the page's column beside the rail, in
 * Between battles' style whatever it holds: what the page puts in it, in the page's column; then
 * at its far right, the top right of the page, Campaigns, `links` and Log out, never changing
 * (William: "campaigns and logout should be far right of that main bar"). One height whatever it
 * holds (William: "keep some consistency on the top bar height"): what goes in it keeps to one
 * line. A phone keeps its own top bars.
 */
export default function WebTopBar({
  children,
  links,
  className,
}: {
  children?: ReactNode;
  /** Between Campaigns and Log out (Account, on the pages outside a campaign). */
  links?: ReactNode;
  className?: string;
}) {
  const { signOut } = useAuth();
  return (
    <header className={cn("flex h-14 border-b border-line bg-bar", className)}>
      <div className="flex min-w-0 flex-1 items-center py-2 pl-10 pr-6">
        <div className="mx-auto flex w-full min-w-0 max-w-[1520px] items-center">{children}</div>
      </div>
      <nav aria-label="Site" className="flex shrink-0 items-stretch gap-1 pr-6">
        <WebTopBarLink to="/campaigns" icon={<LayoutList aria-hidden="true" />}>
          Campaigns
        </WebTopBarLink>
        {links}
        <Button variant="ghost" size="sm" className="my-auto text-danger" onClick={signOut}>
          <LogOut aria-hidden="true" />
          Log out
        </Button>
      </nav>
    </header>
  );
}
