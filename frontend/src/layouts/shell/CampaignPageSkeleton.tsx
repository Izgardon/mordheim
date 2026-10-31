import AftermathSkeleton from "@/features/battles/components/aftermath/AftermathSkeleton";
import BattleSkeleton from "@/features/battles/components/battle/BattleSkeleton";
import BattlesSkeleton from "@/features/campaigns/components/overview/BattlesSkeleton";
import OverviewSkeleton from "@/features/campaigns/components/overview/OverviewSkeleton";
import SettingsSkeleton from "@/features/campaigns/components/settings/SettingsSkeleton";
import ReferenceSkeleton from "@/features/reference/ReferenceSkeleton";
import WarbandSkeleton from "@/features/warbands/components/page/WarbandSkeleton";

/**
 * The skeleton of the campaign page at `pathname` (`/campaigns/:id/...`): what the shell shows
 * while that page's code loads, or while the campaign itself does. The reference pages, Search
 * everything and the Encampment share the reference page's list layout.
 */
export default function CampaignPageSkeleton({ pathname }: { pathname: string }) {
  const [, , , section, battleId, stage] = pathname.split("/");
  if (!section) return <OverviewSkeleton />;
  if (section === "battles") {
    if (!battleId) return <BattlesSkeleton />;
    if (stage === "postbattle") return <AftermathSkeleton />;
    return <BattleSkeleton phase={stage === "prebattle" ? "prebattle" : "active"} />;
  }
  if (section === "warband" || section === "warbands") return <WarbandSkeleton />;
  if (section === "settings") return <SettingsSkeleton />;
  return <ReferenceSkeleton />;
}
