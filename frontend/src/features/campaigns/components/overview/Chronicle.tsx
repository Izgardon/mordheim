import { useState } from "react";

import { Chip } from "@/components/ui/chip";
import { SectionTitle } from "@/components/ui/section-title";
import { SkeletonPage } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { useCampaignChronicle } from "../../api/campaign-queries";
import type { CampaignChronicleFilter, CampaignChronicleKind } from "../../types/campaign-types";
import { ChronicleBones } from "./OverviewSkeleton";

const FILTERS: { id: CampaignChronicleFilter | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "kill", label: "Kills" },
  { id: "death", label: "Deaths" },
  { id: "level", label: "Level-ups" },
  { id: "buy", label: "Purchases" },
  { id: "trade", label: "Trades" },
  { id: "bounty", label: "Bounties" },
];

const KIND: Record<CampaignChronicleKind, { label: string; text: string; bar: string }> = {
  kill: { label: "Kill", text: "text-accent-hi", bar: "bg-accent-line" },
  death: { label: "Death", text: "text-danger", bar: "bg-danger-line" },
  level: { label: "Level-up", text: "text-good", bar: "bg-good-line" },
  buy: { label: "Purchase", text: "text-text2", bar: "bg-strong" },
  trade: { label: "Trade", text: "text-text2", bar: "bg-strong" },
  bounty_posted: { label: "Bounty posted", text: "text-accent-hi", bar: "bg-accent-line" },
  bounty_claimed: { label: "Bounty claimed", text: "text-good", bar: "bg-good-line" },
};

/** On the web the entries scroll inside this height (about nine), under the fixed filters. */
const CHRONICLE_SCROLL = "max-h-[720px] overflow-y-auto overscroll-contain border-b border-line";

/**
 * The chronicle (design E): the campaign's latest kills, deaths, level-ups (heroes' and the lad's
 * got talent), purchases, trades and bounties (posted and claimed), filtered by kind on the
 * server. On the web its entries scroll in their own box, so the page stays short; on a phone
 * (its own tab) the page scrolls.
 */
export default function Chronicle({
  campaignId,
  isMobile,
  heading = true,
}: {
  campaignId: number;
  isMobile: boolean;
  /** The section's title (the phone's tab says it already). */
  heading?: boolean;
}) {
  const [filter, setFilter] = useState<CampaignChronicleFilter | "all">("all");
  const entries = useCampaignChronicle(campaignId, filter);
  const rows = entries.data ?? [];

  return (
    <section
      aria-labelledby={heading ? "chronicle-h" : undefined}
      aria-label={heading ? undefined : "Chronicle"}
      className="flex flex-col gap-2.5"
    >
      {heading ? <SectionTitle id="chronicle-h">Chronicle</SectionTitle> : null}
      <div
        role="group"
        aria-label="Show"
        className={cn("flex gap-1.5", isMobile ? "-mx-3 overflow-x-auto px-3 pb-0.5" : "flex-wrap")}
      >
        {FILTERS.map((entry) => (
          <Chip
            key={entry.id}
            pressed={filter === entry.id}
            className={cn("shrink-0 text-xs font-bold", isMobile ? "min-h-9" : "min-h-8 px-2.5")}
            onClick={() => setFilter(entry.id)}
          >
            {entry.label}
          </Chip>
        ))}
      </div>
      {entries.isPending ? (
        <SkeletonPage label="Loading the chronicle">
          <ChronicleBones isMobile={isMobile} />
        </SkeletonPage>
      ) : entries.error ? (
        <p className="m-0 text-sm text-danger">{getErrorMessage(entries.error)}</p>
      ) : rows.length === 0 ? (
        <p className="m-0 text-sm text-text2">Nothing to tell yet.</p>
      ) : (
        <ul
          // a new filter starts the box at its top
          key={filter}
          aria-label="Chronicle entries"
          // the box scrolls on the web: focusable, so the keyboard can scroll it too
          tabIndex={isMobile ? undefined : 0}
          className={cn(
            "m-0 flex list-none flex-col p-0",
            isMobile
              ? null
              : cn(
                  CHRONICLE_SCROLL,
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                )
          )}
        >
          {rows.map((entry, index) => {
            const kind = KIND[entry.kind];
            return (
              <li
                key={`${entry.at}-${index}`}
                className={cn("flex gap-3 border-t border-line", isMobile ? "py-2.5" : "py-3")}
              >
                <span aria-hidden="true" className={cn("w-1 shrink-0 self-stretch", kind.bar)} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={cn("text-[11px] font-bold uppercase tracking-[0.12em]", kind.text)}
                  >
                    {kind.label}
                  </span>
                  <span className="text-sm text-ink">{entry.text}</span>
                  {entry.meta ? (
                    <span className="text-xs text-muted-foreground">{entry.meta}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
