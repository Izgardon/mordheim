import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const ITEM =
  "flex min-h-[52px] flex-col items-center justify-center gap-[3px] text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&_svg]:size-5";

const itemClass = (current: boolean) =>
  cn(
    ITEM,
    current
      ? "font-bold text-accent-hi shadow-[inset_0_2px_0_var(--color-accent)]"
      : "font-semibold text-muted-foreground"
  );

/** The phone's flat five-item bar (design E): the bottom nav and the battle tools share it. */
export function BottomBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="grid grid-cols-5 border-t border-line bg-rail px-1.5 pb-2 pt-1"
    >
      {children}
    </nav>
  );
}

type ItemProps = { label: string; icon: LucideIcon; current?: boolean };

/** An item that goes to a page. */
export function BottomBarLink({
  label,
  icon: Icon,
  current = false,
  to,
}: ItemProps & { to: string }) {
  return (
    <Link to={to} aria-current={current ? "page" : undefined} className={itemClass(current)}>
      <Icon aria-hidden="true" />
      {label}
    </Link>
  );
}

/** An item that opens something (a sheet, the dice) or acts. */
export function BottomBarButton({
  label,
  icon: Icon,
  current = false,
  className,
  ...props
}: ItemProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-current={current ? "page" : undefined}
      className={cn(itemClass(current), "disabled:opacity-40", className)}
      {...props}
    >
      <Icon aria-hidden="true" />
      {label}
    </button>
  );
}
