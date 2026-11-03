import { Link } from "react-router-dom";
import { Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PHASE_ACTION, type YourOpenBattle } from "@/features/battles/utils/open-battles";
import { cn } from "@/lib/utils";

/**
 * Start battle, or the way to your battle while you have one (William: "start battle button on
 * campaigns page should say rejoin"): the rejoin banner's battle and label (Rejoin, Back to
 * pre-battle, Answer the invitation, To the Aftermath). The overview's header and the Battles
 * page's.
 */
export default function BattleButton({
  battle,
  onStartBattle,
  icon = true,
  className,
}: {
  /** The battle that needs you most (`yourOpenBattles`), or null. */
  battle: YourOpenBattle | null;
  onStartBattle: () => void;
  icon?: boolean;
  className?: string;
}) {
  const swords = icon ? <Swords aria-hidden="true" /> : null;
  // a long label ("Answer the invitation") wraps rather than spilling out of a phone's half
  const look = cn("max-[960px]:whitespace-normal max-[960px]:leading-tight", className);
  if (battle) {
    return (
      <Button asChild size="lg" className={look}>
        <Link to={battle.href}>
          {swords}
          {PHASE_ACTION[battle.phase]}
        </Link>
      </Button>
    );
  }
  return (
    <Button size="lg" className={look} onClick={onStartBattle}>
      {swords}
      Start battle
    </Button>
  );
}
