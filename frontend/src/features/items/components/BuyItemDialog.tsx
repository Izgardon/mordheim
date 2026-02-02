import { useState } from "react";
import type { ReactNode } from "react";

// components
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@components/dialog";
import { Tooltip } from "@components/tooltip";
import DiceRoller from "@/components/dice/DiceRoller";

// assets
import buyIcon from "@/assets/components/buy.png";

// stores
import { useAppStore } from "@/stores/app-store";

// types
import type { Item } from "../types/item-types";

type BuyItemDialogProps = {
  item: Item;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function BuyItemDialog({
  trigger,
  open: openProp,
  onOpenChange,
}: BuyItemDialogProps) {
  const [open, setOpen] = useState(false);
  const { diceColor } = useAppStore();

  const resolvedOpen = openProp ?? open;
  const setResolvedOpen = (nextOpen: boolean) => {
    if (openProp === undefined) {
      setOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const triggerNode =
    trigger === undefined ? (
      <Tooltip
        trigger={
          <button type="button" aria-label="Buy item" className="h-8 w-8 shrink-0 transition-[filter] hover:brightness-125">
            <img src={buyIcon} alt="" className="h-full w-full object-contain" />
          </button>
        }
        content="Buy Item"
      />
    ) : (
      trigger
    );

  return (
    <Dialog open={resolvedOpen} onOpenChange={setResolvedOpen}>
      {triggerNode !== null ? <DialogTrigger asChild>{triggerNode}</DialogTrigger> : null}
      <DialogContent className="max-w-[750px]">
        <DialogHeader>
          <DialogTitle className="font-bold" style={{ color: '#a78f79' }}>BUY WARGEAR</DialogTitle>
        </DialogHeader>
        <div className="space-y-8">
          <section className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Fixed 2d6</h3>
              <p className="text-sm text-muted-foreground">Quick roll for standard purchases.</p>
            </div>
            <DiceRoller mode="fixed" fixedNotation="2d6" fullScreen themeColor={diceColor} />
          </section>
          <section className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Custom roll</h3>
              <p className="text-sm text-muted-foreground">Choose the dice mix you need.</p>
            </div>
            <DiceRoller mode="custom" fullScreen themeColor={diceColor} />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
