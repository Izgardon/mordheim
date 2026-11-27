import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { NumberInput } from "@/components/ui/number-input";
import { Field, FormError } from "@/features/campaigns/components/settings/settings-ui";
import { updateWarband, type WarbandUpdateAnswer } from "@/features/warbands/api/warbands-core";
import WarbandTypePicker from "@/features/warbands/components/type-picker/WarbandTypePicker";
import type {
  Warband,
  WarbandTypeBrief,
  WarbandUpdatePayload,
} from "@/features/warbands/types/warband-types";
import { getRefusalMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warband: Warband;
};

/** A box's whole number at or above `least`, else null. */
const whole = (typed: string, least: number) => {
  const value = Number(typed);
  return typed.trim() && Number.isInteger(value) && value >= least ? value : null;
};

/**
 * A workshop warband's settings: its name, type and most warriors (it has a running cost and no
 * budget). A new type keeps a no-list warband without a list; the server swaps a listed one's
 * rules and says so. Mounted while open, so each opening starts from the warband as it is.
 */
export default function WarbandSettingsDialog({ open, onOpenChange, warband }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(warband.name);
  const [type, setType] = useState<WarbandTypeBrief | null>(warband.warband_type ?? null);
  const [most, setMost] = useState(String(warband.max_units ?? 15));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const mostWarriors = whole(most, 1);
  const ready = Boolean(name.trim()) && mostWarriors !== null && !saving;

  const changes = (): Partial<WarbandUpdatePayload> => ({
    ...(name.trim() !== warband.name ? { name: name.trim() } : {}),
    ...(type && type.id !== warband.warband_type?.id ? { warband_type_id: type.id } : {}),
    ...(mostWarriors !== null && mostWarriors !== warband.max_units
      ? { max_units: mostWarriors }
      : {}),
  });
  const saved = (answer: WarbandUpdateAnswer) => {
    const { campaign_id: campaignId, id } = warband;
    for (const key of [
      queryKeys.campaign.warbandSheet(campaignId, id),
      queryKeys.campaign.warbandHireTemplate(campaignId, id),
      queryKeys.campaign.warbandWhoCan(campaignId, id),
      queryKeys.workshop(),
    ]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
    const [first, ...rest] = answer.rules_changed?.words ?? [];
    if (first) toast(first, rest.length ? { description: rest.join(" ") } : undefined);
  };
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!ready) return;
    const payload = changes();
    if (!Object.keys(payload).length) return onOpenChange(false);
    setSaving(true);
    setError("");
    try {
      saved(await updateWarband(warband.id, payload));
      onOpenChange(false);
    } catch (refused) {
      setError(getRefusalMessage(refused, "Couldn't save the warband."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker={warband.name}
      title="Warband settings"
      className="max-w-[520px]"
      footer={
        <div className="grid w-full grid-cols-[1fr_2fr] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="min-h-12" disabled={!ready} onClick={() => void submit()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        <Field label="Name" htmlFor="workshop-settings-name">
          <Input
            id="workshop-settings-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            className="h-11 text-base md:h-11"
          />
        </Field>
        <Field label="Warband type" htmlFor="workshop-settings-type">
          <WarbandTypePicker
            id="workshop-settings-type"
            campaignId={warband.campaign_id}
            value={type}
            onPick={setType}
            canAdd={false}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Most warriors" htmlFor="workshop-settings-most">
            <NumberInput
              id="workshop-settings-most"
              min={1}
              allowEmpty
              value={most}
              onChange={(event) => setMost(event.target.value)}
              className="font-mono"
            />
          </Field>
        </div>
        <FormError message={error} />
      </form>
    </ModalSheet>
  );
}
