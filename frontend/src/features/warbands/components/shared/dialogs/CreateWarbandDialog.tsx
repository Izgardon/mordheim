import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { X } from "lucide-react";

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
import RestrictionPicker from "../RestrictionPicker";

// api
import { listRestrictions } from "../../../../items/api/items-api";

// types
import type { Restriction } from "../../../../items/types/item-types";
import type { WarbandCreatePayload } from "../../../types/warband-types";

const EXCLUDED_TYPES = new Set(["Artifact"]);

const initialState: WarbandCreatePayload = {
  name: "",
  faction: "",
};

type CreateWarbandDialogProps = {
  onCreate: (payload: WarbandCreatePayload) => Promise<void>;
};

export default function CreateWarbandDialog({ onCreate }: CreateWarbandDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<WarbandCreatePayload>(initialState);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [allRestrictions, setAllRestrictions] = useState<Restriction[]>([]);
  const [selectedRestrictions, setSelectedRestrictions] = useState<Restriction[]>([]);

  useEffect(() => {
    if (open) {
      listRestrictions()
        .then((data) => setAllRestrictions(data.filter((r) => !EXCLUDED_TYPES.has(r.type))))
        .catch(() => setAllRestrictions([]));
    }
  }, [open]);

  const selectedIds = useMemo(
    () => new Set(selectedRestrictions.map((r) => r.id)),
    [selectedRestrictions]
  );

  const handleToggleRestriction = (restriction: Restriction) => {
    setSelectedRestrictions((prev) =>
      prev.some((r) => r.id === restriction.id)
        ? prev.filter((r) => r.id !== restriction.id)
        : [...prev, restriction]
    );
  };

  const handleRemoveRestriction = (restrictionId: number) => {
    setSelectedRestrictions((prev) => prev.filter((r) => r.id !== restrictionId));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setForm(initialState);
      setSelectedRestrictions([]);
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
        restriction_ids: selectedRestrictions.map((r) => r.id),
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
          <DialogTitle className="font-bold" style={{ color: '#a78f79' }}>RAISE YOUR WARBAND</DialogTitle>
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
            <Label>Restrictions</Label>
            <p className="text-xs text-muted-foreground">
              Select the restrictions your warband satisfies for item availability. These can also be set later in the warband settings.
            </p>
            {selectedRestrictions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedRestrictions.map((r) => (
                  <div
                    key={r.id}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/60 bg-primary/20 px-2.5 py-0.5 text-sm"
                  >
                    <span>{r.restriction}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRestriction(r.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <RestrictionPicker
                restrictions={allRestrictions}
                selected={selectedIds}
                onToggle={handleToggleRestriction}
              />
            </div>
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
