// components
import ActiveBattlesTable from "./ActiveBattlesTable";

// hooks
import { useActiveBattlesSection } from "../../hooks/settings/useActiveBattlesSection";

/** Settings → Active Battles, for a battle manager (`manage_battles`, BATL-NEW-03). */
export default function ActiveBattlesSection({ campaignId }: { campaignId: number }) {
  const section = useActiveBattlesSection(campaignId);
  return (
    <ActiveBattlesTable
      isLoading={section.isLoading}
      error={section.error}
      battles={section.battles}
      onCancelBattle={section.onCancelBattle}
      onCloseBattle={section.onCloseBattle}
      onEndBattle={section.onEndBattle}
      onConfirmResults={section.onConfirmResults}
    />
  );
}
