import BattleSkeleton from "@/features/battles/components/battle/BattleSkeleton";
import BattleScreen from "@/features/battles/components/battle/BattleScreen";
import { useBattleScreen } from "@/features/battles/hooks/useBattleScreen";
import { allRostersSettled } from "@/features/battles/utils/battle-rosters";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * `battles/:battleId/active`: the battle screen, once every warband's roster is in.
 * `BattleLayout` sends a player who has finished his fight on to his Aftermath.
 */
export default function BattleActive() {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const screen = useBattleScreen();
  const { battleState, rosters, rosterLoading, rosterErrors } = screen.battle;
  if (!allRostersSettled(battleState.participants, rosters, rosterLoading, rosterErrors)) {
    return <BattleSkeleton phase="active" />;
  }
  return <BattleScreen screen={screen} isMobile={isMobile} />;
}
