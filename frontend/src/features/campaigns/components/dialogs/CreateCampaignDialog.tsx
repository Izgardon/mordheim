import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { X } from "lucide-react";

// components
import { Button } from "@components/button";
import { Chip, ChipLabel } from "@components/chip";
import { Input } from "@components/input";
import { ModalSheet } from "@components/modal-sheet";
import { NumberInput } from "@components/number-input";
import RestrictionPicker from "@/features/warbands/components/shared/RestrictionPicker";
import { Field, FormError } from "../settings/settings-ui";
// types
import type { CampaignCreatePayload, CampaignCreateType } from "../../types/campaign-types";
import type { Restriction } from "@/features/items/types/item-types";
import { listRestrictions } from "@/features/items/api/items-api";
import { getErrorMessage } from "@/lib/get-error-message";

const TYPE_OPTIONS: { value: CampaignCreateType; label: string; hint: string }[] = [
  { value: "standard", label: "Standard", hint: "The rulebook campaign." },
  { value: "marienburg", label: "Marienburg", hint: "Adds locations and encampments." },
];

const DEFAULT_SEATS = 6;

type CreateCampaignDialogProps = {
  onCreate: (payload: CampaignCreatePayload) => Promise<void>;
  /** The trigger's classes (full width on a phone). */
  className?: string;
};

/**
 * Start a campaign (design E): its name, type, seats and the setting restrictions on item
 * availability; a modal on the web, a sheet on a phone.
 */
export default function CreateCampaignDialog({ onCreate, className }: CreateCampaignDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [seats, setSeats] = useState(DEFAULT_SEATS);
  const [campaignType, setCampaignType] = useState<CampaignCreateType>("standard");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableSettings, setAvailableSettings] = useState<Restriction[]>([]);
  const [selectedSettings, setSelectedSettings] = useState<Restriction[]>([]);
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

  const toggleSetting = (restriction: Restriction) => {
    setSelectedSettings((prev) =>
      prev.some((entry) => entry.id === restriction.id)
        ? prev.filter((entry) => entry.id !== restriction.id)
        : [...prev, restriction]
    );
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setName("");
      setSeats(DEFAULT_SEATS);
      setCampaignType("standard");
      setSelectedSettings([]);
      setError("");
    }
  };

  const submit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await onCreate({
        name: name.trim(),
        campaign_type: campaignType,
        max_players: seats,
        item_setting_ids: selectedSettings.map((restriction) => restriction.id),
      });
      handleOpenChange(false);
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to start campaign"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button className={className} onClick={() => handleOpenChange(true)}>
        Create a campaign
      </Button>
      <ModalSheet
        open={open}
        onOpenChange={handleOpenChange}
        kicker="Campaigns"
        title="Start a new campaign"
        description="Name it, pick its rules and limits, then share its join code with your players."
        className="max-w-[640px]"
        footer={
          <div className="grid w-full grid-cols-[1fr_2fr] gap-2">
            <Button
              variant="secondary"
              className="min-h-12"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="min-h-12"
              disabled={isSubmitting || !name.trim()}
              onClick={() => void submit()}
            >
              {isSubmitting ? "Starting..." : "Start campaign"}
            </Button>
          </div>
        }
      >
        <form className="flex flex-col gap-5" onSubmit={(event) => void submit(event)}>
          <Field label="Campaign name" htmlFor="campaign-name">
            <Input
              id="campaign-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Shards of the Comet"
              maxLength={120}
              required
              className="h-11 text-base md:h-11"
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span id="campaign-type-label" className={CAPTION_CLASS}>
              Campaign type
            </span>
            <div
              role="group"
              aria-labelledby="campaign-type-label"
              className="grid grid-cols-2 gap-2"
            >
              {TYPE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  pressed={campaignType === option.value}
                  onClick={() => setCampaignType(option.value)}
                  className="flex min-h-[60px] flex-col items-start justify-center gap-0.5 px-3 py-2 text-left"
                >
                  <span className="text-sm font-bold">{option.label}</span>
                  <span className="text-xs font-medium text-text2">{option.hint}</span>
                </Chip>
              ))}
            </div>
          </div>
          <Field label="Seats" htmlFor="campaign-size" hint="Players who can join, 2 to 16.">
            <NumberInput
              id="campaign-size"
              min={2}
              max={16}
              value={String(seats)}
              onChange={(event) => setSeats(Number(event.target.value))}
              containerClassName="max-w-[180px]"
              required
            />
          </Field>
          <div className="flex flex-col gap-2">
            <span className={CAPTION_CLASS}>Item settings</span>
            <p className="m-0 text-[13px] text-text2">
              The setting restrictions that apply to item availability across the campaign.
            </p>
            {selectedSettings.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedSettings.map((restriction) => (
                  <ChipLabel key={restriction.id} tone="accent" className="gap-1 pr-1 text-[13px]">
                    {restriction.restriction}
                    <button
                      type="button"
                      aria-label={`Remove ${restriction.restriction}`}
                      onClick={() => toggleSetting(restriction)}
                      className="flex h-6 w-6 items-center justify-center hover:text-head"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </ChipLabel>
                ))}
              </div>
            ) : null}
            <div className="border border-line bg-page p-3">
              <RestrictionPicker
                restrictions={availableSettings}
                selected={selectedSettingIds}
                onToggle={toggleSetting}
              />
            </div>
          </div>
          <FormError message={error} />
        </form>
      </ModalSheet>
    </>
  );
}

const CAPTION_CLASS = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
