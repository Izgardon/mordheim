import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** In the page's flow (a phone, and the web's overview) or in the web bar's main part. */
export type NoticeLook = "page" | "bar";

const LOOK: Record<NoticeLook, string> = {
  page: "campaign-banner mb-4 border border-accent-line bg-accent-soft px-4 py-2 max-[960px]:mt-3",
  bar: "min-w-0 flex-1",
};

/**
 * A campaign's notice (your battle, no warband yet, archived): an icon, what it is and its way
 * on. It can't be dismissed. In the page it is a banner heading it; in the web bar it fills the
 * bar's main part, whose ground carries the accent.
 */
export default function CampaignNotice({
  look,
  label,
  icon: Icon,
  action,
  className,
  children,
}: {
  look: NoticeLook;
  /** Its accessible name (`role="status"`). */
  label?: string;
  icon: LucideIcon;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink",
        LOOK[look],
        className
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
      <span className="min-w-0 grow basis-48">{children}</span>
      {action}
    </div>
  );
}
