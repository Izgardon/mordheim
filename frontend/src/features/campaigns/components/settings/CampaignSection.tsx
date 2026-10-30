import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChipLabel } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Restriction } from "@/features/items/types/item-types";
import RestrictionPicker from "@/features/warbands/components/shared/RestrictionPicker";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

import { useSettingRestrictions } from "../../api/campaign-queries";
import { useUpdateCampaign } from "../../hooks/useCampaignQuery";
import type { CampaignSummary, CampaignUpdatePayload } from "../../types/campaign-types";
import CampaignRules from "./CampaignRules";
import { SettingRow, SettingsCard } from "./settings-ui";

/** One PATCH with its pending flag and error, for a setting saved on its own. */
export function useCampaignSave(campaignId: number, fallback: string) {
  const update = useUpdateCampaign(campaignId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (payload: CampaignUpdatePayload) => {
    setSaving(true);
    setError("");
    try {
      await update(payload);
      return true;
    } catch (failure) {
      setError(getErrorMessage(failure, fallback));
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, setError, save };
}

/** The campaign's name: the owner renames it (the campaigns list shows the new one too). */
function CampaignName({ campaign }: { campaign: CampaignSummary }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(campaign.name);
  const { saving, error, setError, save } = useCampaignSave(campaign.id, "Couldn't rename it.");
  useEffect(() => setName(campaign.name), [campaign.name]);
  const trimmed = name.trim();

  const rename = async () => {
    if (!trimmed) {
      setError("Give the campaign a name.");
      return;
    }
    if (await save({ name: trimmed })) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns() });
    }
  };

  return (
    <SettingRow label="Name" hint="What every member sees on the campaigns list." error={error}>
      <Input
        aria-label="Campaign name"
        value={name}
        maxLength={120}
        onChange={(event) => setName(event.target.value)}
        className="w-[280px] max-[960px]:min-w-0 max-[960px]:flex-1"
      />
      <Button
        variant="secondary"
        disabled={saving || !trimmed || trimmed === campaign.name}
        onClick={() => void rename()}
      >
        {saving ? "Saving…" : "Rename"}
      </Button>
    </SettingRow>
  );
}

/** The Encampments page and Locations, switched on or off for everyone; each saves as it flips. */
function CampaignFeatures({ campaign }: { campaign: CampaignSummary }) {
  const { saving, error, save } = useCampaignSave(campaign.id, "Couldn't save that.");
  const features = [
    {
      key: "enable_encampments" as const,
      label: "Encampments",
      hint: "The Encampment page: camps the players own, with no effect on the game.",
      on: Boolean(campaign.enable_encampments),
    },
    {
      key: "enable_locations" as const,
      label: "Locations",
      hint: "The warband page's Locations panel, where heroes visit places and roll on them.",
      on: Boolean(campaign.enable_locations),
    },
  ];
  return (
    <>
      {features.map((feature) => (
        <SettingRow key={feature.key} label={feature.label} hint={feature.hint}>
          <Switch
            checked={feature.on}
            aria-label={feature.label}
            disabled={saving}
            onCheckedChange={(next) => void save({ [feature.key]: next })}
          >
            {feature.on ? "On" : "Off"}
          </Switch>
        </SettingRow>
      ))}
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
    </>
  );
}

const sortedIds = (restrictions: Restriction[]) =>
  restrictions.map((restriction) => restriction.id).sort((a, b) => a - b);

/** The settings in play: setting restrictions every warband's item availability follows. */
function ItemSettings({ campaign }: { campaign: CampaignSummary }) {
  const available = useSettingRestrictions();
  const current = useMemo(() => campaign.item_settings ?? [], [campaign.item_settings]);
  const [selected, setSelected] = useState<Restriction[]>(current);
  const [editing, setEditing] = useState(false);
  const { saving, error, setError, save } = useCampaignSave(
    campaign.id,
    "Couldn't save the settings in play."
  );
  useEffect(() => setSelected(current), [current]);
  const selectedIds = useMemo(() => new Set(selected.map((entry) => entry.id)), [selected]);
  const changed = sortedIds(current).join() !== sortedIds(selected).join();

  const toggle = (restriction: Restriction) =>
    setSelected((list) =>
      list.some((entry) => entry.id === restriction.id)
        ? list.filter((entry) => entry.id !== restriction.id)
        : [...list, restriction]
    );
  const cancel = () => {
    setEditing(false);
    setSelected(current);
    setError("");
  };
  const submit = async () => {
    if (await save({ item_setting_ids: selected.map((entry) => entry.id) })) setEditing(false);
  };

  return (
    <SettingRow
      label="Settings in play"
      hint="Their items show for every warband in the store and on Wargear; anything else stays findable with Show all, with a warning."
      error={error}
      below={
        <>
          <div className="flex flex-wrap gap-1.5">
            {selected.length ? (
              selected.map((restriction) => (
                <ChipLabel key={restriction.id} className="min-h-[34px] gap-1 text-[13px] text-ink">
                  {restriction.restriction}
                  {editing ? (
                    <button
                      type="button"
                      aria-label={`Remove ${restriction.restriction}`}
                      className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-ink"
                      onClick={() => toggle(restriction)}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </ChipLabel>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">None: the core rules only.</span>
            )}
          </div>
          {editing ? (
            <div className="w-full border border-border bg-page p-3">
              <RestrictionPicker
                restrictions={available}
                selected={selectedIds}
                onToggle={toggle}
                showFilter={false}
              />
            </div>
          ) : null}
        </>
      }
    >
      {editing ? (
        <>
          <Button variant="secondary" onClick={cancel} disabled={saving}>
            Cancel
          </Button>
          <Button disabled={saving || !changed} onClick={() => void submit()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      ) : (
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </Button>
      )}
    </SettingRow>
  );
}

/**
 * Settings → Campaign (`edit_settings`, the owner): its name, the pages switched on, the settings
 * in play, then the warband rules (starting gold, limits, the death roll and the level-ups).
 */
export default function CampaignSection({ campaign }: { campaign: CampaignSummary }) {
  return (
    <>
      <SettingsCard title="Campaign" description="Its name, its pages and the settings in play.">
        <CampaignName campaign={campaign} />
        <CampaignFeatures campaign={campaign} />
        <ItemSettings campaign={campaign} />
      </SettingsCard>
      <CampaignRules campaign={campaign} />
    </>
  );
}
