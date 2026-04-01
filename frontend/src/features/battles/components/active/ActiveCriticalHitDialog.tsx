import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HELPER_DIALOG_CONTENT_CLASS,
  HELPER_RADIX_SELECT_CONTENT_CLASS,
  HELPER_RADIX_SELECT_ITEM_CLASS,
  HELPER_RADIX_SELECT_TRIGGER_CLASS,
} from "./helper-dialog-styles";

type CriticalHitDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type CriticalHitEntry = {
  roll: string;
  result: string;
};

type CriticalHitTable = {
  id: string;
  label: string;
  entries: CriticalHitEntry[];
};

const CRITICAL_HIT_TABLES: CriticalHitTable[] = [
  {
    id: "missile",
    label: "Missile Weapons",
    entries: [
      {
        roll: "1-2",
        result: "Hits a Weak Spot. The missile penetrates its target's armour. Ignore all armour saves.",
      },
      {
        roll: "3-4",
        result:
          'Ricochet. If there are any other models within 6", the closest enemy model is also hit. Roll to wound and take any saves as normal for both targets.',
      },
      {
        roll: "5-6",
        result:
          "Master Shot. The missile hits an eye, the throat, or some other vulnerable part. The target suffers 2 wounds instead of 1. There is no armour save.",
      },
    ],
  },
  {
    id: "bludgeoning",
    label: "Bludgeoning Weapons",
    entries: [
      {
        roll: "1-2",
        result:
          "Hammered. The target is knocked off balance. Your opponent may not fight this turn if he hasn't already fought.",
      },
      {
        roll: "3-4",
        result: "Clubbed. The hit ignores armour saves and saves from helmets.",
      },
      {
        roll: "5",
        result:
          "Wild Sweep. Your opponent's weapon is knocked from his hand. If he is carrying two weapons, roll to see which one he loses. He must fight with whatever back-up weapon he has in his equipment for the rest of this combat (or fight unarmed if he has no other weapons). Roll to wound and take armour saves as normal.",
      },
      {
        roll: "6",
        result:
          "Bludgeoned. The victim automatically goes out of action if he fails his armour save. Even if he has several wounds remaining, he will be taken out of action by this attack.",
      },
    ],
  },
  {
    id: "bladed",
    label: "Bladed Weapons",
    entries: [
      {
        roll: "1-2",
        result: "Flesh Wound. This attack hits an unprotected area, so there is no armour save.",
      },
      {
        roll: "3-4",
        result:
          "Bladestorm. The warrior unleashes a virtual hail of blows. The attack causes 2 wounds instead of 1. Take armour saves separately for each wound. Remember that, as with other critical hits, if an attack causes multiple wounds for other reasons as well, you choose the highest number of wounds.",
      },
      {
        roll: "5-6",
        result:
          "Sliced! The strike ignores armour saves, causes 2 wounds, and your warrior gains +2 to any Injury rolls.",
      },
    ],
  },
  {
    id: "unarmed",
    label: "Unarmed Combat",
    entries: [
      {
        roll: "1-2",
        result:
          "Body Blow. Your opponent staggers, allowing you to seize the initiative and make an additional attack. Immediately roll to hit and to wound. Any saves are taken as normal.",
      },
      {
        roll: "3-4",
        result:
          "Crushing Blow. The blow lands with tremendous force. You gain +1 to the Injury roll if your opponent fails his save.",
      },
      {
        roll: "5-6",
        result:
          "Mighty Blow. With a mighty punch or flying kick, you send your opponent sprawling to the ground. The attack ignores armour saves and you gain +2 to any Injury rolls.",
      },
    ],
  },
  {
    id: "thrusting",
    label: "Thrusting Weapons",
    entries: [
      {
        roll: "1-2",
        result:
          "Stab. With a quick strike, you penetrate your opponent's defences. You gain +1 to any Injury rolls. Armour saves are taken as normal.",
      },
      {
        roll: "3-4",
        result:
          "Thrust. The thrust lands with great force and the target is knocked down. Take armour saves as normal and see whether the model suffers a wound.",
      },
      {
        roll: "5-6",
        result:
          'Kebab! The thrust knocks the target back with titanic force, ripping apart armour and puncturing flesh. The attack ignores armour saves and you gain +2 to any Injury rolls. The victim is knocked backwards D6" and the attacker follows, staying in base contact. Any other models involved in the combat are separated and only the model which struck the blow and his target are still considered to be in combat. If the target collides with another model, the other model is hit once at S3.',
      },
    ],
  },
];

export default function ActiveCriticalHitDialog({
  open,
  onOpenChange,
}: CriticalHitDialogProps) {
  const [selectedTableId, setSelectedTableId] = useState(CRITICAL_HIT_TABLES[0].id);

  useEffect(() => {
    if (open) {
      setSelectedTableId(CRITICAL_HIT_TABLES[0].id);
    }
  }, [open]);

  const selectedTable =
    CRITICAL_HIT_TABLES.find((table) => table.id === selectedTableId) ?? CRITICAL_HIT_TABLES[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-3xl ${HELPER_DIALOG_CONTENT_CLASS}`}>
        <DialogHeader>
          <DialogTitle>Critical Hits</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="max-w-sm">
            <Select value={selectedTable.id} onValueChange={setSelectedTableId}>
              <SelectTrigger className={HELPER_RADIX_SELECT_TRIGGER_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={HELPER_RADIX_SELECT_CONTENT_CLASS}>
                {CRITICAL_HIT_TABLES.map((table) => (
                  <SelectItem
                    key={table.id}
                    value={table.id}
                    className={HELPER_RADIX_SELECT_ITEM_CLASS}
                  >
                    {table.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="battle-inline-panel overflow-hidden rounded-xl">
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-left text-sm text-foreground">
                <thead className="bg-black/20">
                  <tr className="border-b border-border/50">
                    <th className="w-16 px-3 py-3 text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
                      Roll
                    </th>
                    <th className="px-4 py-3 text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
                      Result
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTable.entries.map((entry) => (
                    <tr
                      key={`${selectedTable.id}-${entry.roll}`}
                      className="border-t border-border/40 align-top"
                    >
                      <td className="px-3 py-3 font-semibold text-foreground">{entry.roll}</td>
                      <td className="px-4 py-3 text-muted-foreground">{entry.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
