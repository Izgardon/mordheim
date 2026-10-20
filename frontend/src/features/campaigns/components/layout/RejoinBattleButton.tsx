import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

const DESKTOP_CLASS =
  "min-w-[9.5rem] border-[#b38b3c] bg-[#5d4719] text-[#f7e6b8] shadow-[0_0_18px_rgba(214,168,71,0.3)] hover:border-[#d6a847] hover:bg-[#7a5c1f] hover:text-[#fff3d4]";
const COMPACT_CLASS =
  "min-w-0 border-[#8b6a31] bg-[#3c2e14] text-[#e8d5a3] hover:border-[#aa8540] hover:bg-[#4a3918] hover:text-[#f2e3bd]";

/** The gold battle-button look (Rejoin, See Status, Start battle): full-size, or compact on phones. */
export const battleButtonClass = (compact: boolean) => (compact ? COMPACT_CLASS : DESKTOP_CLASS);

type RejoinBattleButtonProps = {
  compact?: boolean;
  disabled?: boolean;
  onClick: () => void;
  /** "Rejoin Battle", or "Rejoin" when compact. */
  children?: ReactNode;
};

/** Back to the battle in progress, from the top bar or the overview's battle panel. */
export default function RejoinBattleButton({
  compact = false,
  disabled,
  onClick,
  children,
}: RejoinBattleButtonProps) {
  return (
    <Button
      type="button"
      variant="toolbar"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={battleButtonClass(compact)}
    >
      {children ?? (compact ? "Rejoin" : "Rejoin Battle")}
    </Button>
  );
}
