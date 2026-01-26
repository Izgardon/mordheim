import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

// components
import { Button } from "@components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@components/dialog";
import { Input } from "@components/input";
import { Label } from "@components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";

// api
import { listCampaignTypes } from "../../api/campaigns-api";

// types
import type { CampaignCreatePayload } from "../../types/campaign-types";

const initialState: CampaignCreatePayload = {
  name: "",
  campaign_type: "",
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
  const [typeOptions, setTypeOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);

  const maxPlayersValue = useMemo(() => String(form.max_players ?? 2), [form.max_players]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setForm(initialState);
      setError("");
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    let isMounted = true;
    const loadTypes = async () => {
      setIsLoadingTypes(true);
      try {
        const types = await listCampaignTypes();
        const options = types.map((type) => ({
          value: type.code,
          label: type.name,
        }));
        if (!isMounted) {
          return;
        }
        setTypeOptions(options);
        setForm((prev) => ({
          ...prev,
          campaign_type: options[0]?.value ?? "",
        }));
      } catch (errorResponse) {
        if (!isMounted) {
          return;
        }
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load campaign types");
        } else {
          setError("Unable to load campaign types");
        }
      } finally {
        if (isMounted) {
          setIsLoadingTypes(false);
        }
      }
    };

    loadTypes();
    return () => {
      isMounted = false;
    };
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (!form.campaign_type) {
        setError("Select a campaign type");
        setIsSubmitting(false);
        return;
      }
      await onCreate({
        name: form.name.trim(),
        campaign_type: form.campaign_type,
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
        <Button>Create campaign</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a new campaign</DialogTitle>
          <DialogDescription>Set the terms for your next warband raid.</DialogDescription>
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
              value={form.campaign_type}
              onValueChange={(value) => setForm((prev) => ({ ...prev, campaign_type: value }))}
              disabled={isLoadingTypes || typeOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-size">Seats in the campaign</Label>
            <Input
              id="campaign-size"
              type="number"
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Start campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}




