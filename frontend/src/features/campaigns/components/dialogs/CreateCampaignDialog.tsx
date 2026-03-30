import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { X } from "lucide-react";

// components
import { Button } from "@components/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogContent } from "@components/dialog";
import { Input } from "@components/input";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";
import RestrictionPicker from "@/features/warbands/components/shared/RestrictionPicker";
// types
import type { CampaignCreatePayload } from "../../types/campaign-types";
import type { Restriction } from "@/features/items/types/item-types";
import { listRestrictions } from "@/features/items/api/items-api";

const TYPE_OPTIONS = [
  { value: "standard", label: "Standard" },
];

const initialState: CampaignCreatePayload = {
  name: "",
  max_players: 6,
};

type CreateCampaignDialogProps = {
  onCreate: (payload: CampaignCreatePayload) => Promise<void>;
};

export default function CreateCampaignDialog({ onCreate }: CreateCampaignDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CampaignCreatePayload>(initialState);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [campaignType, setCampaignType] = useState(TYPE_OPTIONS[0].value);
  const [availableSettings, setAvailableSettings] = useState<Restriction[]>([]);
  const [selectedSettings, setSelectedSettings] = useState<Restriction[]>([]);
  const maxPlayersValue = useMemo(() => String(form.max_players ?? 2), [form.max_players]);
  const selectedSettingIds = useMemo(
    () => new Set(selectedSettings.map((restriction) => restriction.id)),
    [selectedSettings]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    listRestrictions({ type: "Setting" })
      .then(setAvailableSettings)
      .catch(() => setAvailableSettings([]));
  }, [open]);

  const handleToggleSetting = (restriction: Restriction) => {
    setSelectedSettings((prev) =>
      prev.some((entry) => entry.id === restriction.id)
        ? prev.filter((entry) => entry.id !== restriction.id)
        : [...prev, restriction]
    );
  };

  const handleRemoveSetting = (restrictionId: number) => {
    setSelectedSettings((prev) => prev.filter((entry) => entry.id !== restrictionId));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setForm(initialState);
      setSelectedSettings([]);
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
        max_players: Number(form.max_players),
        item_setting_ids: selectedSettings.map((restriction) => restriction.id),
      });
      setOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to start campaign");
      } else {
        setError("Unable to start campaign");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Create</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[750px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Start a new campaign
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Campaign name</Label>
            <Input
              id="campaign-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Shards of the Comet"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Campaign type</Label>
            <Select
              value={campaignType}
              onValueChange={setCampaignType}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-size">Seats in the campaign</Label>
            <NumberInput
              id="campaign-size"
              min={2}
              max={16}
              value={maxPlayersValue}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  max_players: Number(event.target.value),
                }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Item settings</Label>
            <p className="text-xs text-muted-foreground">
              Pick the setting restrictions that apply campaign-wide to item availability.
            </p>
            {selectedSettings.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedSettings.map((restriction) => (
                  <div
                    key={restriction.id}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/60 bg-primary/20 px-2.5 py-0.5 text-sm"
                  >
                    <span>{restriction.restriction}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSetting(restriction.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <RestrictionPicker
                restrictions={availableSettings}
                selected={selectedSettingIds}
                onToggle={handleToggleSetting}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Starting..." : "Start"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}




