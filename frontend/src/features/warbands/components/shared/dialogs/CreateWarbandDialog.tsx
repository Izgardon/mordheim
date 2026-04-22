import type { FormEvent } from "react";
import { useState } from "react";

// components
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
import { Label } from "@components/label";
import { NumberInput } from "@components/number-input";
import type { WarbandCreatePayload } from "../../../types/warband-types";

const initialState: WarbandCreatePayload = {
  name: "",
  faction: "",
  max_units: 15,
};

type CreateWarbandDialogProps = {
  campaignId: number;
  onCreate: (payload: WarbandCreatePayload) => Promise<void>;
};

export default function CreateWarbandDialog({ onCreate }: CreateWarbandDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<WarbandCreatePayload>(initialState);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setForm(initialState);
      setError("");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await onCreate({
        name: form.name.trim(),
        faction: form.faction.trim(),
        max_units: form.max_units,
      });
      setOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to create warband");
      } else {
        setError("Unable to create warband");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Raise warband</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[750px]">
        <DialogHeader>
          <DialogTitle className="font-bold">RAISE YOUR WARBAND</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="warband-name">Warband name</Label>
            <Input
              id="warband-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Ashen Crows"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="warband-faction">Faction</Label>
            <Input
              id="warband-faction"
              value={form.faction}
              onChange={(event) => setForm((prev) => ({ ...prev, faction: event.target.value }))}
              placeholder="Reiklanders"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="warband-max-units">Max units</Label>
            <NumberInput
              id="warband-max-units"
              min={1}
              value={String(form.max_units ?? 15)}
              onChange={(event) => {
                const next = Number(event.target.value);
                setForm((prev) => ({ ...prev, max_units: Number.isFinite(next) && next >= 1 ? next : 1 }));
              }}
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Raise warband"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
