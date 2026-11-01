import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";

import { aftermathDone } from "./camp-state";
import type { OpenCamp } from "./camp-types";
import CampRows from "./CampRows";
import ReadyDialog from "./ReadyDialog";
import SellDialog from "./SellDialog";
import VeteransDialog from "./VeteransDialog";

/**
 * Camp (design E): on the web the sidebar beside the roster, all rows at once with Ready up at the
 * bottom; on a phone the post-game card (the battle, the Aftermath row, the camp block, Ready up).
 * Sell, Recruit and Ready open their modals (sheets on a phone).
 */
export default function CampAside({ camp }: { camp: OpenCamp }) {
  const [modal, setModal] = useState<"sell" | "recruit" | null>(null);
  const readyOpen = camp.focus === "ready";
  const done = aftermathDone(camp);
  const rows = (
    <CampRows camp={camp} onSell={() => setModal("sell")} onRecruit={() => setModal("recruit")} />
  );
  const ready = (
    <Button className="min-h-12 text-[15px]" onClick={() => camp.setCamp("ready")}>
      Ready up
    </Button>
  );
  const modals = (
    <>
      <SellDialog camp={camp} open={modal === "sell"} onClose={() => setModal(null)} />
      <VeteransDialog camp={camp} open={modal === "recruit"} onClose={() => setModal(null)} />
      <ReadyDialog camp={camp} open={readyOpen} onClose={() => camp.setCamp(null)} />
    </>
  );

  if (camp.isMobile) {
    return (
      <section
        aria-label="After the battle"
        className="flex flex-col gap-2.5 border border-accent-line bg-panel p-3"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-text">
            After the battle
          </span>
          <span className="truncate text-xs text-muted-foreground">{camp.subtitle}</span>
        </div>
        <Link
          to={camp.aftermathPath}
          className="flex min-h-11 items-center gap-2 border border-border px-2.5 text-[13px] font-semibold text-text2"
        >
          {done.injuries && done.xp && done.explore ? (
            <Check className="h-3.5 w-3.5 text-good" strokeWidth={2.5} aria-label="Done" />
          ) : null}
          <span className="flex-1">Aftermath · Injuries, XP, Explore</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <div className="flex flex-col border border-border bg-surface">
          <span className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-faint">
            Camp
          </span>
          {rows}
        </div>
        {ready}
        {modals}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="camp-heading"
      className="flex flex-col gap-1 border border-accent-line bg-panel p-[18px]"
    >
      <div className="flex flex-col gap-0.5 pb-2.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-text">
          After the battle
        </span>
        <SectionTitle id="camp-heading">Camp</SectionTitle>
      </div>
      {rows}
      <div className="mt-2.5 flex flex-col">{ready}</div>
      {modals}
    </section>
  );
}
