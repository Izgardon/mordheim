import { cloneElement, useState, type MouseEvent, type ReactElement } from "react";

import HenchmenLevelUpDialog from "../dialogs/HenchmenLevelUpDialog";

import type { HenchmenGroup } from "../../../types/warband-types";

type HenchmenLevelUpControlProps = {
  group: HenchmenGroup;
  warbandId: number;
  onLevelUpLogged?: (updatedGroup: HenchmenGroup) => void;
  trigger: ReactElement<{
    onClick?: (event: MouseEvent<HTMLElement>) => void;
  }>;
};

export default function HenchmenLevelUpControl({
  group,
  warbandId,
  onLevelUpLogged,
  trigger,
}: HenchmenLevelUpControlProps) {
  const [isLevelUpOpen, setIsLevelUpOpen] = useState(false);

  if (!group.level_up) {
    return null;
  }

  const handleTriggerClick = (event: MouseEvent<HTMLElement>) => {
    if (trigger.props.onClick) {
      trigger.props.onClick(event);
    }
    setIsLevelUpOpen(true);
  };

  const triggerElement = cloneElement(trigger, {
    onClick: handleTriggerClick,
  });

  return (
    <>
      {triggerElement}
      <HenchmenLevelUpDialog
        group={group}
        warbandId={warbandId}
        open={isLevelUpOpen}
        onOpenChange={setIsLevelUpOpen}
        onLevelUpLogged={onLevelUpLogged}
      />
    </>
  );
}
