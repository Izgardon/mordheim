import type { FormEvent } from "react";
import { useState } from "react";

// components
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

// types
import type { WarbandCreatePayload } from "../types/warband-types";

const factionOptions = [
  "Reiklanders",
  "Middenheimers",
  "Marienburgers",
  "Witch Hunters",
  "Sisters of Sigmar",
  "Undead",
  "Skaven",
  "Possessed",
  "Dwarfs",
  "Orcs & Goblins",
];

const initialState: WarbandCreatePayload = {
  name: "",
  faction: factionOptions[0],
};

type CreateWarbandDialogProps = {
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise your warband</DialogTitle>
          <DialogDescription>Name your warband and swear a faction.</DialogDescription>
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
              list="warband-factions"
              value={form.faction}
              onChange={(event) => setForm((prev) => ({ ...prev, faction: event.target.value }))}
              placeholder="Select or type a faction"
              required
            />
            <datalist id="warband-factions">
              {factionOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Raise warband"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}




