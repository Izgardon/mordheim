import { Crown } from "lucide-react";

import { Tooltip } from "@/components/ui/tooltip";
import { WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME } from "../../../shared/unit_details/warband-tooltip-styles";

/** The leader's crown beside a hero's name, with a "Leader" tooltip. */
export default function LeaderCrown() {
  return (
    <Tooltip
      trigger={
        <span className="flex items-center rounded-sm border border-amber-500/40 bg-amber-500/10 p-1 text-amber-400">
          <Crown className="h-2.5 w-2.5" aria-hidden="true" />
        </span>
      }
      content="Leader"
      contentClassName={WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME}
    />
  );
}
