import { useEffect, useState } from "react";

/** The Battle Notes dialog, open only while your own warband is shown (prebattle, active). */
export function useBattleNotesDialog(isOwnSelected: boolean) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOwnSelected && isOpen) {
      setIsOpen(false);
    }
  }, [isOpen, isOwnSelected]);

  return [isOpen, setIsOpen] as const;
}
