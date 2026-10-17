import { cloneElement, useState, type MouseEvent, type ReactElement } from "react";

import UnitLevelUpDialog from "./UnitLevelUpDialog";

import type { Unit, UnitKindKey } from "../../types/units";
import type { UnitKindConfig } from "../../units/unit-kind-types";

type UnitLevelUpControlProps<K extends UnitKindKey> = {
  kind: UnitKindConfig<K>;
  unit: Unit<K>;
  warbandId: number;
  onLevelUpLogged?: (updated: Unit<K>) => void;
  /** Henchmen only: Lad's Got Talent promoted the group's last member. */
  onGroupRemoved?: (groupId: number) => void;
  trigger: ReactElement<{
    onClick?: (event: MouseEvent<HTMLElement>) => void;
  }>;
};

/** The "Level Up!" trigger, shown while the unit has a level-up to spend, and its dialog. */
export default function UnitLevelUpControl<K extends UnitKindKey>({
  kind,
  unit,
  warbandId,
  onLevelUpLogged,
  onGroupRemoved,
  trigger,
}: UnitLevelUpControlProps<K>) {
  const [isLevelUpOpen, setIsLevelUpOpen] = useState(false);

  if (!kind.canLevelUp(unit)) {
    return null;
  }

  const handleTriggerClick = (event: MouseEvent<HTMLElement>) => {
    if (trigger.props.onClick) {
      trigger.props.onClick(event);
    }
    setIsLevelUpOpen(true);
  };

  return (
    <>
      {cloneElement(trigger, { onClick: handleTriggerClick })}
      <UnitLevelUpDialog
        kind={kind}
        unit={unit}
        warbandId={warbandId}
        open={isLevelUpOpen}
        onOpenChange={setIsLevelUpOpen}
        onLevelUpLogged={onLevelUpLogged}
        onGroupRemoved={onGroupRemoved}
      />
    </>
  );
}
