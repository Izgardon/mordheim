import { CardBackground } from "@components/card-background";

import WarbandDetailsSection from "./WarbandDetailsSection";
import WarbandLinkSection from "./WarbandLinkSection";

import type { Warband } from "@/features/warbands/types/warband-types";

type WarbandSettingsCardProps = {
  warband: Warband;
  canEdit: boolean;
  onWarbandUpdated: (warband: Warband) => void;
};

/** Settings → Personal's warband card: its details and its link, each edited on its own. */
export default function WarbandSettingsCard(props: WarbandSettingsCardProps) {
  return (
    <CardBackground className="space-y-2 p-3 bg-[rgba(12,9,6,0.92)] sm:space-y-2.5 sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">Warband Settings</h3>
      <WarbandDetailsSection {...props} />
      <WarbandLinkSection {...props} />
    </CardBackground>
  );
}
