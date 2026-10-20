import ActiveCriticalHitDialog from "@/features/battles/components/active/ActiveCriticalHitDialog";
import ActiveMeleeDialog, {
  type ActiveMeleeUnitOption,
} from "@/features/battles/components/active/ActiveMeleeDialog";
import ActiveRangedDialog, {
  type ActiveRangedUnitOption,
} from "@/features/battles/components/active/ActiveRangedDialog";
import type { ActiveHelper } from "@/features/battles/hooks/useActivePage";

/** The melee, ranged and critical hit helpers; `open` names the one showing. */
export default function ActiveHelperDialogs({
  open,
  onOpenChange,
  meleeOptions,
  rangedOptions,
}: {
  open: ActiveHelper | null;
  onOpenChange: (helper: ActiveHelper | null) => void;
  meleeOptions: { yours: ActiveMeleeUnitOption[]; others: ActiveMeleeUnitOption[] };
  rangedOptions: ActiveRangedUnitOption[];
}) {
  const changeFor = (helper: ActiveHelper) => (isOpen: boolean) =>
    onOpenChange(isOpen ? helper : null);
  return (
    <>
      <ActiveMeleeDialog
        open={open === "melee"}
        onOpenChange={changeFor("melee")}
        yourUnitOptions={meleeOptions.yours}
        enemyUnitOptions={meleeOptions.others}
      />
      <ActiveRangedDialog
        open={open === "ranged"}
        onOpenChange={changeFor("ranged")}
        yourUnitOptions={rangedOptions}
      />
      <ActiveCriticalHitDialog open={open === "critical"} onOpenChange={changeFor("critical")} />
    </>
  );
}
