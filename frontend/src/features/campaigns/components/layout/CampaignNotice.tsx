import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** In the page's flow (a phone, and the web's overview) or in the web bar's main part. */
export type NoticeLook = "page" | "bar";

/**
 * A campaign's notice (your battle, no warband yet, archived): what it is and its way on. It can't
 * be dismissed. In the page it is a banner heading it, an icon and a sentence; in the web bar it
 * fills the bar's main part in Between battles' style (William: "the in battle top bar should be
 * the same style as the between battles one"), its kicker over its heading, then `aside`, its
 * action at the end.
 */
export default function CampaignNotice({
  look,
  label,
  icon: Icon,
  kicker,
  aside,
  action,
  className,
  children,
}: {
  look: NoticeLook;
  /** Its accessible name (`role="status"`). */
  label?: string;
  /** The page's banner's icon. */
  icon: LucideIcon;
  /** The bar's small line over its heading. */
  kicker: string;
  /** In the bar, beside the heading (a battle's "+N more"). */
  aside?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** The page's sentence; the bar's heading. */
  children: ReactNode;
}) {
  if (look === "bar") {
    return (
      <div
        role="status"
        aria-label={label}
        className={cn(
          "flex min-w-0 flex-1 flex-wrap items-center gap-x-8 gap-y-2 py-1.5",
          className
        )}
      >
        <div className="flex min-w-0 flex-col gap-px">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-text">
            {kicker}
          </span>
          <span className="truncate font-display text-xl font-semibold text-head">{children}</span>
        </div>
        {aside}
        {action ? <div className="ml-auto flex shrink-0 items-center">{action}</div> : null}
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "campaign-banner mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border border-accent-line bg-accent-soft px-4 py-2 text-sm text-ink max-[960px]:mt-3",
        className
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
      <span className="min-w-0 grow basis-48">{children}</span>
      {action}
    </div>
  );
}
