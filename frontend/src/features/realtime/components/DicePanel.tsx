import type { ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";

import { SidePanel } from "@/components/ui/side-panel";

import { useDiceRoller } from "../hooks/useDiceRoller";
import DiceRoller from "./DiceRoller";

type DicePanelProps = {
  campaignId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opens it, if this placement has one (the shell owns the open state). */
  trigger?: ReactNode;
};

/** The table's dice roller in a panel (the rail's, the top bar's and the battle menu's Dice). */
export default function DicePanel({ campaignId, open, onOpenChange, trigger }: DicePanelProps) {
  const roller = useDiceRoller(campaignId, open);
  return (
    <>
      {trigger ? <Slot onClick={() => onOpenChange(true)}>{trigger}</Slot> : null}
      <SidePanel open={open} onOpenChange={onOpenChange} kicker="Table" title="Dice">
        <DiceRoller roller={roller} />
      </SidePanel>
    </>
  );
}
