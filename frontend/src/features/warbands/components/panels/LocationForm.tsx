import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  createCampaignLocation,
  updateCampaignLocation,
} from "@/features/campaigns/api/campaigns-api";
import { updateCachedList } from "@/features/campaigns/api/campaign-queries";
import { Field, FormError, TEXTAREA } from "@/features/campaigns/components/settings/settings-ui";
import type {
  CampaignLocation,
  CampaignLocationPayload,
} from "@/features/campaigns/types/campaign-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

const LOCATION_ROLLS = ["d6_1", "d6_2", "d6_3", "d6_4", "d6_5", "d6_6"] as const;

type LocationValues = Required<CampaignLocationPayload>;

const hasRolls = (location: Partial<CampaignLocation>) =>
  LOCATION_ROLLS.some((roll) => Boolean(location[roll]?.trim()));
const byName = (a: CampaignLocation, b: CampaignLocation) => a.name.localeCompare(b.name);

/** The form's values for a location being edited, or empty ones for a new one. */
function valuesOf(location: CampaignLocation | null): LocationValues {
  return {
    name: location?.name ?? "",
    area: location?.area ?? "",
    content: location?.content ?? "",
    ...(Object.fromEntries(LOCATION_ROLLS.map((roll) => [roll, location?.[roll] ?? ""])) as Record<
      (typeof LOCATION_ROLLS)[number],
      string
    >),
  };
}

/**
 * Add or edit a location, in the Locations panel (`manage_locations`): its name, area (the areas
 * in use suggested), what is there and, with Use D6 results, its six results. Switched off, the
 * results are cleared. The answer goes into the campaign's cached list.
 */
export default function LocationForm({
  campaignId,
  editing,
  areas,
  onClose,
}: {
  campaignId: number;
  /** The location being edited; null adds one. */
  editing: CampaignLocation | null;
  areas: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(() => valuesOf(editing));
  const [withRolls, setWithRolls] = useState(() => hasRolls(values));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const idOf = (field: string) => `location-${editing?.id ?? "new"}-${field}`;
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
      ...(withRolls ? {} : Object.fromEntries(LOCATION_ROLLS.map((roll) => [roll, ""]))),
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
    <form
      aria-label={editing ? `Edit ${editing.name}` : "Add a location"}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Field label="Name" htmlFor={idOf("name")}>
        <Input
          id={idOf("name")}
          value={values.name}
          placeholder="Location name"
          maxLength={120}
          onChange={(event) => set("name", event.target.value)}
        />
      </Field>
      <Field label="Area" htmlFor={idOf("area")}>
        <Input
          id={idOf("area")}
          list={idOf("areas")}
          value={values.area}
          maxLength={80}
          onChange={(event) => set("area", event.target.value)}
        />
        <datalist id={idOf("areas")}>
          {areas.map((area) => (
            <option key={area} value={area} />
          ))}
        </datalist>
      </Field>
      <Field label="What is there" htmlFor={idOf("content")}>
        <textarea
          id={idOf("content")}
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
          {LOCATION_ROLLS.map((roll, index) => (
            <li key={roll} className="flex items-start gap-3">
              <span className="w-6 pt-2 text-center font-mono text-sm font-bold text-accent-hi">
                {index + 1}
              </span>
              <textarea
                aria-label={`Result for a roll of ${index + 1}`}
                className={`${TEXTAREA} min-h-[60px]`}
                value={values[roll]}
                onChange={(event) => set(roll, event.target.value)}
              />
            </li>
          ))}
        </ol>
      ) : null}
      <FormError message={error} />
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <Button variant="secondary" className="min-h-11" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" className="min-h-11" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add location"}
        </Button>
      </div>
    </form>
  );
}
