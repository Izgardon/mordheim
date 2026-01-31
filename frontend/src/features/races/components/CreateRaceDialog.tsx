import { useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@components/dialog";
import { Input } from "@components/input";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";

import { createRace } from "../api/races-api";

import type { Race } from "../types/race-types";

type CreateRaceDialogProps = {
  campaignId: number;
  onCreated: (race: Race) => void;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type RaceFormState = {
  name: string;
  movement: string;
  weapon_skill: string;
  ballistic_skill: string;
  strength: string;
  toughness: string;
  wounds: string;
  initiative: string;
  attacks: string;
  leadership: string;
};

const initialState: RaceFormState = {
  name: "",
  movement: "0",
  weapon_skill: "0",
  ballistic_skill: "0",
  strength: "0",
  toughness: "0",
  wounds: "0",
  initiative: "0",
  attacks: "0",
  leadership: "0",
};

const statFields: Array<keyof RaceFormState> = [
  "movement",
  "weapon_skill",
  "ballistic_skill",
  "strength",
  "toughness",
  "wounds",
  "initiative",
  "attacks",
  "leadership",
];

const statLabels: Record<string, string> = {
  movement: "M",
  weapon_skill: "WS",
  ballistic_skill: "BS",
  strength: "S",
  toughness: "T",
  wounds: "W",
  initiative: "I",
  attacks: "A",
  leadership: "Ld",
};

export default function CreateRaceDialog({
  campaignId,
  onCreated,
  trigger,
  open: openProp,
  onOpenChange,
}: CreateRaceDialogProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<RaceFormState>(initialState);

  const resetForm = () => {
    setForm(initialState);
    setFormError("");
  };

  const resolvedOpen = openProp ?? open;
  const setResolvedOpen = (nextOpen: boolean) => {
    if (openProp === undefined) {
      setOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setResolvedOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  };

  const parseStat = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    if (parsed < 0 || parsed > 10) {
      return null;
    }
    return parsed;
  };

  const handleCreate = async () => {
    if (Number.isNaN(campaignId)) {
      setFormError("Unable to create race.");
      return;
    }

    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }

    const stats: Record<string, number> = {};
    for (const field of statFields) {
      const parsed = parseStat(form[field]);
      if (parsed === null) {
        setFormError("All stats must be between 0 and 10.");
        return;
      }
      stats[field] = parsed;
    }

    setIsCreating(true);
    setFormError("");

    try {
      const newRace = await createRace({
        name: form.name.trim(),
        movement: stats.movement,
        weapon_skill: stats.weapon_skill,
        ballistic_skill: stats.ballistic_skill,
        strength: stats.strength,
        toughness: stats.toughness,
        wounds: stats.wounds,
        initiative: stats.initiative,
        attacks: stats.attacks,
        leadership: stats.leadership,
        campaign_id: campaignId,
      });
      onCreated(newRace);
      setResolvedOpen(false);
      resetForm();
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || "Unable to create race");
      } else {
        setFormError("Unable to create race");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const triggerNode = trigger === undefined ? <Button>Add race</Button> : trigger;

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      {triggerNode !== null ? <DialogTrigger asChild>{triggerNode}</DialogTrigger> : null}
      <DialogContent className="max-w-[750px]">
        <DialogHeader>
          <DialogTitle className="font-bold" style={{ color: '#a78f79' }}>ADD RACE</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="race-name">Name</Label>
            <Input
              id="race-name"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder="Human"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Max Characteristics
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {statFields.map((field) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`race-${field}`} className="text-sm font-semibold text-foreground">
                    {statLabels[field]}
                  </Label>
                    <NumberInput
                      id={`race-${field}`}
                      min={0}
                      max={10}
                      value={form[field]}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        [field]: event.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Saving..." : "Add race"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

