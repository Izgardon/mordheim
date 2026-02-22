import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

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

// types
import { useMediaQuery } from "@/lib/use-media-query";
import type { WarbandCreatePayload } from "../../../types/warband-types";

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
  const isMobile = useMediaQuery("(max-width: 960px)");
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const focusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open && focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
  }, [open]);

  const handleOpenAutoFocus = (event: Event) => {
    if (!isMobile) {
      return;
    }
    event.preventDefault();
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
    }
    focusTimerRef.current = window.setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.scrollIntoView({ block: "center" });
    }, 320);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      if (focusTimerRef.current !== null) {
        window.clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
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
      <DialogContent className="max-w-[750px]" onOpenAutoFocus={handleOpenAutoFocus}>
        <DialogHeader>
          <DialogTitle className="font-bold" style={{ color: '#a78f79' }}>RAISE YOUR WARBAND</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="warband-name">Warband name</Label>
            <Input
              id="warband-name"
              ref={nameInputRef}
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
