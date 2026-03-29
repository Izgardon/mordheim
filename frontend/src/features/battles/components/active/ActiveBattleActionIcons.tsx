import killIcon from "@/assets/icons/kill.png";
import ooaIcon from "@/assets/icons/ooa.png";

type ActiveBattleActionIconProps = {
  className?: string;
};

export function OutOfActionIcon({ className }: ActiveBattleActionIconProps) {
  return <img src={ooaIcon} alt="" className={className} aria-hidden="true" />;
}

export function KillTrophyIcon({ className }: ActiveBattleActionIconProps) {
  return <img src={killIcon} alt="" className={className} aria-hidden="true" />;
}
