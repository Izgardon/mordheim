import { Skull, Sword } from "lucide-react";

type ActiveBattleActionIconProps = {
  className?: string;
};

export function OutOfActionIcon({ className }: ActiveBattleActionIconProps) {
  return <Skull className={className} aria-hidden="true" strokeWidth={1.8} />;
}

export function KillTrophyIcon({ className }: ActiveBattleActionIconProps) {
  return <Sword className={className} aria-hidden="true" strokeWidth={1.8} />;
}
