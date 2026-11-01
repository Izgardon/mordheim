import BattleSkeleton from "@/features/battles/components/battle/BattleSkeleton";
import BattleScreen from "@/features/battles/components/battle/BattleScreen";
import { useBattleEntranceReady } from "@/features/battles/hooks/useBattleEntrance";
import { useBattleScreen } from "@/features/battles/hooks/useBattleScreen";
import { allRostersSettled } from "@/features/battles/utils/battle-rosters";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * `battles/:battleId/active`: the battle screen, once every warband's roster is in.
 * `BattleLayout` sends a player who has finished his fight on to his Aftermath, and holds the
 * entrance's swords over this page until it is drawn.
 */
export default function BattleActive() {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const screen = useBattleScreen();
  const { battleState, rosters, rosterLoading, rosterErrors } = screen.battle;
  const settled = allRostersSettled(battleState.participants, rosters, rosterLoading, rosterErrors);
  useBattleEntranceReady(settled);
  if (!settled) {
    return <BattleSkeleton phase="active" />;
  }
  return <BattleScreen screen={screen} isMobile={isMobile} />;
}
