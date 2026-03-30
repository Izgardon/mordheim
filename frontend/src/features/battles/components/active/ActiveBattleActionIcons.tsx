import { Skull } from "lucide-react";
import { GiDrippingSword } from "react-icons/gi";

type ActiveBattleActionIconProps = {
  className?: string;
};

export function OutOfActionIcon({ className }: ActiveBattleActionIconProps) {
  return <Skull className={className} aria-hidden="true" strokeWidth={1.8} />;
}

export function KillTrophyIcon({ className }: ActiveBattleActionIconProps) {
  return <GiDrippingSword className={className} aria-hidden="true" />;
}
