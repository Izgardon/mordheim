import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

// components
import ActiveBattlesTable from "./ActiveBattlesTable";

// hooks
import { useActiveBattlesSection } from "../../hooks/settings/useActiveBattlesSection";

/** Settings → Active Battles, for a battle manager (`manage_battles`, BATL-NEW-03). */
export default function ActiveBattlesSection({ campaignId }: { campaignId: number }) {
  const section = useActiveBattlesSection(campaignId);
  const ref = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const isLinked = searchParams.get("section") === "active-battles";
  // Review on the overview's stuck-battles banner lands here (CAMP-NEW-05).
  useEffect(() => {
    if (isLinked) ref.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [isLinked]);
  return (
    <div id="active-battles" ref={ref} className="scroll-mt-24">
      <ActiveBattlesTable
        isLoading={section.isLoading}
        error={section.error}
        battles={section.battles}
        onCancelBattle={section.onCancelBattle}
        onCloseBattle={section.onCloseBattle}
        onEndBattle={section.onEndBattle}
        onConfirmResults={section.onConfirmResults}
      />
    </div>
  );
}
