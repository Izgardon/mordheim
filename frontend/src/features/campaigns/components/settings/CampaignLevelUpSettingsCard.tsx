import { CardBackground } from "@components/card-background";

import { useWarbandRulesForm } from "../../hooks/settings/useWarbandRulesForm";
import LevelUpThresholdsSection from "./LevelUpThresholdsSection";
import StartingGoldField from "./StartingGoldField";
import { HeroDeathRollField, WarbandLimitsField } from "./WarbandRulesFields";

import type { CampaignSummary } from "../../types/campaign-types";

/**
 * The Warband card (`edit_settings`, the owner): starting gold, warband limits, the hero death
 * roll table and the level-up thresholds, each saved on its own.
 */
export default function CampaignLevelUpSettingsCard({ campaign }: { campaign: CampaignSummary }) {
  const form = useWarbandRulesForm(campaign);

  return (
    <CardBackground className="space-y-2 p-3 bg-[rgba(12,9,6,0.92)] sm:space-y-2.5 sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">Warband</h3>
      <StartingGoldField campaign={campaign} />
      <WarbandLimitsField limits={form.limits} />
      <HeroDeathRollField deathRoll={form.deathRoll} />
      <LevelUpThresholdsSection levelUps={form.levelUps} />
    </CardBackground>
  );
}
