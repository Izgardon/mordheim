import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/dialog";
import { Button } from "@components/button";
import { Checkbox } from "@components/checkbox";
import { Label } from "@components/label";
import { NumberInput } from "@components/number-input";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import { useBackToItem } from "../../../hooks/units/useBackToItem";

import type { HenchmenGroup } from "../../../types/warband-types";

type Mode = "count" | "members";

const MODES: { mode: Mode; label: string }[] = [
  { mode: "count", label: "A number of them" },
  { mode: "members", label: "Choose members" },
];

const memberLabel = (name: string, kills: number, index: number) => {
  const label = name.trim() || `Member ${index + 1}`;
  return kills > 0 ? `${label} (${kills} ${kills === 1 ? "kill" : "kills"})` : label;
};

type BackToItemDialogProps = {
  group: HenchmenGroup;
  warbandId: number;
  onClose: () => void;
};

/**
 * A creature group's members back to its item, in the stash: a number of them (the newest go
 * first) or the ones ticked. Their kills stay on record; the last ones take the group with them.
 */
export default function BackToItemDialog({ group, warbandId, onClose }: BackToItemDialogProps) {
  const members = group.henchmen ?? [];
  const [mode, setMode] = useState<Mode>("count");
  const [count, setCount] = useState("1");
  const [ticked, setTicked] = useState<number[]>([]);
  const send = useBackToItem(warbandId, group.id);
  const howMany = Math.max(1, Math.min(Number(count) || 1, members.length));
  const leaving = mode === "count" ? howMany : ticked.length;
  const name = group.name || group.unit_type || "the group";

  const toggle = (id: number) =>
    setTicked((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );

  const handleSend = async () => {
    const body =
      mode === "count"
        ? { count: howMany }
        : { member_ids: members.filter((m) => ticked.includes(m.id)).map((m) => m.id) };
    try {
      await send.mutateAsync(body);
      onClose();
    } catch {
      // The refusal shows in the dialog (send.error).
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Back to item: {name}</DialogTitle>
          <DialogDescription>
            Their copies go to the stash at the group's price, and their kills stay on record.
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Which members" className="flex gap-2">
          {MODES.map((option) => (
            <button
              key={option.mode}
              type="button"
              role="radio"
              aria-checked={mode === option.mode}
              onClick={() => setMode(option.mode)}
              className={cn(
                "flex-1 rounded-md border px-3 py-1.5 text-sm",
                mode === option.mode
                  ? "border-orange-300/70 bg-orange-300/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {mode === "count" ? (
          <div className="space-y-1">
            <Label>How many</Label>
            <NumberInput
              aria-label="How many"
              min={1}
              max={members.length}
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {members.map((member, index) => (
              <label key={member.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={ticked.includes(member.id)} onChange={() => toggle(member.id)} />
                {memberLabel(member.name ?? "", member.kills ?? 0, index)}
              </label>
            ))}
          </div>
        )}
        {leaving >= members.length ? (
          <p className="text-sm text-amber-300">
            The group is disbanded; what it carries goes to the stash.
          </p>
        ) : null}
        {send.error ? (
          <p role="alert" className="text-sm text-red-400">
            {getErrorMessage(send.error)}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={send.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSend()}
            disabled={send.isPending || leaving === 0 || members.length === 0}
          >
            {send.isPending ? "Sending..." : "Back to item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
