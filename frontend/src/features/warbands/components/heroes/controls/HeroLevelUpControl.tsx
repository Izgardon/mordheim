import { cloneElement, useState, type ReactElement, type MouseEvent } from "react";

import HeroLevelUpDialog from "../../dialogs/heroes/HeroLevelUpDialog";

import type { WarbandHero } from "../../../types/warband-types";

type HeroLevelUpControlProps = {
  hero: WarbandHero;
  warbandId: number;
  onLevelUpLogged?: (updatedHero: WarbandHero) => void;
  trigger: ReactElement<{
    onClick?: (event: MouseEvent<HTMLElement>) => void;
  }>;
};

export default function HeroLevelUpControl({
  hero,
  warbandId,
  onLevelUpLogged,
  trigger,
}: HeroLevelUpControlProps) {
  const [isLevelUpOpen, setIsLevelUpOpen] = useState(false);

  if (!hero.level_up) {
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
      <HeroLevelUpDialog
        hero={hero}
        warbandId={warbandId}
        open={isLevelUpOpen}
        onOpenChange={setIsLevelUpOpen}
        onLevelUpLogged={onLevelUpLogged}
      />
    </>
  );
}

