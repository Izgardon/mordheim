import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

import {
  createCampaignLocation,
  deleteCampaignLocation,
  updateCampaignLocation,
} from "../../api/campaigns-api";
import { updateCachedList, useCampaignLocations } from "../../api/campaign-queries";
import type { CampaignLocation, CampaignLocationPayload } from "../../types/campaign-types";
import { Field, FormError, SettingsCard, Tag, TEXTAREA } from "./settings-ui";

const ROLLS = ["d6_1", "d6_2", "d6_3", "d6_4", "d6_5", "d6_6"] as const;
const EMPTY: Required<CampaignLocationPayload> = {
  name: "",
  area: "",
  content: "",
  d6_1: "",
  d6_2: "",
  d6_3: "",
  d6_4: "",
  d6_5: "",
  d6_6: "",
};

const hasRolls = (location: Partial<CampaignLocation>) =>
  ROLLS.some((roll) => Boolean(location[roll]?.trim()));
const byName = (a: CampaignLocation, b: CampaignLocation) => a.name.localeCompare(b.name);

type FormState = { editing: CampaignLocation | null; values: Required<CampaignLocationPayload> };

/** Add or edit a location: its name, area, text and (with Use D6 results) its six results. */
function LocationForm({
  campaignId,
  state,
  areas,
  onClose,
}: {
  campaignId: number;
  state: FormState | null;
  areas: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(state?.values ?? EMPTY);
  const [withRolls, setWithRolls] = useState(hasRolls(state?.values ?? EMPTY));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const editing = state?.editing ?? null;
  const set = (field: keyof CampaignLocationPayload, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  const save = async () => {
    const name = values.name.trim();
    if (!name) {
      setError("Name the location.");
      return;
    }
    const payload: CampaignLocationPayload = {
      ...values,
      name,
      area: values.area.trim(),
      // Switched off, the results are cleared: the location has no roll.
      ...(withRolls ? {} : Object.fromEntries(ROLLS.map((roll) => [roll, ""]))),
    };
    setSaving(true);
    setError("");
    const key = queryKeys.campaign.locations(campaignId);
    try {
      if (editing) {
        const saved = await updateCampaignLocation(campaignId, editing.id, payload);
        updateCachedList<CampaignLocation>(queryClient, key, (list) =>
          list.map((entry) => (entry.id === saved.id ? saved : entry))
        );
      } else {
        const saved = await createCampaignLocation(campaignId, payload);
        updateCachedList<CampaignLocation>(queryClient, key, (list) =>
          [...list, saved].sort(byName)
        );
      }
      onClose();
    } catch (failure) {
      setError(getErrorMessage(failure, "Couldn't save the location."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      open={Boolean(state)}
      onOpenChange={(open) => !open && onClose()}
      kicker="Locations"
      title={editing ? `Edit ${editing.name}` : "Add a location"}
      className="max-w-[640px]"
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="min-h-12" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add location"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 min-[961px]:grid-cols-2">
        <Field label="Name" htmlFor="location-name">
          <Input
            id="location-name"
            value={values.name}
            placeholder="The Docks"
            onChange={(event) => set("name", event.target.value)}
          />
        </Field>
        <Field label="Area" htmlFor="location-area" hint="Optional; the panel filters by area.">
          <Input
            id="location-area"
            list="location-areas"
            value={values.area}
            maxLength={80}
            placeholder="Merchant Quarter"
            onChange={(event) => set("area", event.target.value)}
          />
          <datalist id="location-areas">
            {areas.map((area) => (
              <option key={area} value={area} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field
        label="What is there"
        htmlFor="location-content"
        hint="Plain text, or simple HTML for bold, lists and paragraphs."
      >
        <textarea
          id="location-content"
          className={TEXTAREA}
          value={values.content}
          onChange={(event) => set("content", event.target.value)}
        />
      </Field>
      <Switch checked={withRolls} onCheckedChange={setWithRolls} className="self-start">
        Use D6 results
      </Switch>
      {withRolls ? (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {ROLLS.map((roll, index) => (
            <li key={roll} className="flex items-start gap-3">
              <span className="w-6 pt-2 text-center font-mono text-sm font-bold text-accent-hi">
                {index + 1}
              </span>
              <textarea
                aria-label={`Result for a roll of ${index + 1}`}
                className={`${TEXTAREA} min-h-[60px]`}
                value={values[roll]}
                placeholder={`What a ${index + 1} brings`}
                onChange={(event) => set(roll, event.target.value)}
              />
            </li>
          ))}
        </ol>
      ) : null}
      <FormError message={error} />
    </ModalSheet>
  );
}

/**
 * Settings → Locations (`manage_locations`, with them switched on): every location with the same
 * flags as the warband page's Locations panel (its area, D6 roll), and Add, Edit and Remove (a
 * soft delete: it leaves the list for everyone).
 */
export default function LocationsSection({ campaignId }: { campaignId: number }) {
  const queryClient = useQueryClient();
  const locations = useCampaignLocations(campaignId);
  const [form, setForm] = useState<FormState | null>(null);
  const [removing, setRemoving] = useState<CampaignLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const all = locations.data ?? [];
  const areas = [...new Set(all.map((entry) => entry.area?.trim()).filter(Boolean))].sort();

  const edit = (location: CampaignLocation | null) =>
    setForm({
      editing: location,
      values: location
        ? {
            name: location.name,
            area: location.area ?? "",
            content: location.content ?? "",
            ...Object.fromEntries(ROLLS.map((roll) => [roll, location[roll] ?? ""])),
          }
        : EMPTY,
    } as FormState);
  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setRemoveError("");
    try {
      await deleteCampaignLocation(campaignId, removing.id);
      updateCachedList<CampaignLocation>(
        queryClient,
        queryKeys.campaign.locations(campaignId),
        (list) => list.filter((entry) => entry.id !== removing.id)
      );
      setRemoving(null);
    } catch (failure) {
      setRemoveError(getErrorMessage(failure, "Couldn't remove the location."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard
      title="Locations"
      description="The places heroes visit from the warband page's Locations panel."
      action={<Button onClick={() => edit(null)}>Add location</Button>}
    >
      {locations.isPending ? (
        <p className="m-0 text-sm text-muted-foreground">Finding the locations…</p>
      ) : locations.error ? (
        <FormError message={getErrorMessage(locations.error, "Couldn't load the locations.")} />
      ) : all.length === 0 ? (
        <p className="m-0 text-sm text-text2">No locations yet. Add the first one.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {all.map((location) => (
            <li
              key={location.id}
              className="flex flex-wrap items-start gap-3 border border-border bg-surface px-3.5 py-3"
            >
              <div className="flex min-w-[200px] flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="font-display text-[17px] font-semibold text-head">
                    {location.name}
                  </span>
                  {location.area?.trim() ? (
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent-text">
                      {location.area}
                    </span>
                  ) : null}
                </span>
                {location.content ? (
                  <span className="line-clamp-2 text-[13px] text-text2">{location.content}</span>
                ) : null}
                {hasRolls(location) ? (
                  <span>
                    <Tag>D6 roll</Tag>
                  </span>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => edit(location)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setRemoveError("");
                    setRemoving(location);
                  }}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {form ? (
        <LocationForm
          key={form.editing?.id ?? "new"}
          campaignId={campaignId}
          state={form}
          areas={areas}
          onClose={() => setForm(null)}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove the location"
        description={
          <p className="m-0 text-ink">{`Remove ${removing?.name ?? "this location"}? It leaves the Locations panel for everyone in the campaign.`}</p>
        }
        error={removeError}
        confirmText={busy ? "Removing…" : "Remove"}
        isConfirming={busy}
        onConfirm={() => void remove()}
      />
    </SettingsCard>
  );
}
