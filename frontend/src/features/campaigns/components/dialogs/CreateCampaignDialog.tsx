import type { FormEvent } from "react";
import { useMemo, useState } from "react";

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
// types
import type { CampaignCreatePayload } from "../../types/campaign-types";

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
  const maxPlayersValue = useMemo(() => String(form.max_players ?? 2), [form.max_players]);

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
        max_players: Number(form.max_players),
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
          <DialogTitle className="text-base font-semibold" style={{ color: "#a78f79" }}>
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




