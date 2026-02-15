import type { WarbandHiredSword } from "../../../types/warband-types";
import { getHenchmenLevelInfo } from "../../henchmen/utils/henchmen-level";

type HiredSwordCardHeaderProps = {
  hiredSword: WarbandHiredSword;
};

export default function HiredSwordCardHeader({ hiredSword }: HiredSwordCardHeaderProps) {
  const { level } = getHenchmenLevelInfo(hiredSword.xp);

  return (
    <div className="flex items-start justify-between gap-3 py-1 pl-4">
      <div>
        <p className="text-xl font-bold">{hiredSword.name || "Untitled hired sword"}</p>
        <p className="text-sm text-muted-foreground">
          Level {level} {hiredSword.unit_type || "Hired Sword"}
        </p>
      </div>
    </div>
  );
}
