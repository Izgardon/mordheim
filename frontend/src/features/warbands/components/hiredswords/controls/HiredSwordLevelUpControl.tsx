import { cloneElement, useState, type MouseEvent, type ReactElement } from "react";

import HiredSwordLevelUpDialog from "../dialogs/HiredSwordLevelUpDialog";

import type { WarbandHiredSword } from "../../../types/warband-types";

type HiredSwordLevelUpControlProps = {
  hiredSword: WarbandHiredSword;
  warbandId: number;
  onLevelUpLogged?: (updated: WarbandHiredSword) => void;
  trigger: ReactElement<{
    onClick?: (event: MouseEvent<HTMLElement>) => void;
  }>;
};

export default function HiredSwordLevelUpControl({
  hiredSword,
  warbandId,
  onLevelUpLogged,
  trigger,
}: HiredSwordLevelUpControlProps) {
  const [isLevelUpOpen, setIsLevelUpOpen] = useState(false);

  if (!hiredSword.level_up) {
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
      <HiredSwordLevelUpDialog
        hiredSword={hiredSword}
        warbandId={warbandId}
        open={isLevelUpOpen}
        onOpenChange={setIsLevelUpOpen}
        onLevelUpLogged={onLevelUpLogged}
      />
    </>
  );
}
