import type { Warband } from "../../types/warband-types";

type WarbandRestrictionsCardProps = {
  warband: Warband;
  canEdit: boolean;
  onWarbandUpdated: (warband: Warband) => void;
};

export default function WarbandRestrictionsCard({
  warband,
  canEdit,
  onWarbandUpdated,
}: WarbandRestrictionsCardProps) {
  void warband;
  void canEdit;
  void onWarbandUpdated;
  return null;
}
