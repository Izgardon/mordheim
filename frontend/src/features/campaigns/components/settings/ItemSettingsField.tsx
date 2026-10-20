import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@components/button";
import { Label } from "@components/label";
import RestrictionPicker from "@/features/warbands/components/shared/RestrictionPicker";
import { getErrorMessage } from "@/lib/get-error-message";

import { useSettingRestrictions } from "../../api/campaign-queries";
import { useUpdateCampaign } from "../../hooks/useCampaignQuery";

import type { Restriction } from "@/features/items/types/item-types";
import type { CampaignSummary } from "../../types/campaign-types";

const sortedIds = (restrictions: Restriction[]) =>
  restrictions.map((restriction) => restriction.id).sort((a, b) => a - b);

/** Campaign-wide setting restrictions on item availability (owner only). */
export default function ItemSettingsField({ campaign }: { campaign: CampaignSummary }) {
  const updateCampaign = useUpdateCampaign(campaign.id);
  const availableSettings = useSettingRestrictions();
  const [selected, setSelected] = useState<Restriction[]>(campaign.item_settings ?? []);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Any change to the card's settings resets the draft, as when the card held them all.
  useEffect(() => {
    setSelected(campaign.item_settings ?? []);
  }, [campaign.enable_encampments, campaign.enable_locations, campaign.item_settings]);

  const selectedIds = useMemo(() => new Set(selected.map((entry) => entry.id)), [selected]);
  const hasChanged = useMemo(() => {
    const current = sortedIds(campaign.item_settings ?? []);
    const next = sortedIds(selected);
    return current.length !== next.length || current.some((id, index) => id !== next[index]);
  }, [campaign.item_settings, selected]);

  const toggle = (restriction: Restriction) =>
    setSelected((prev) =>
      prev.some((entry) => entry.id === restriction.id)
        ? prev.filter((entry) => entry.id !== restriction.id)
        : [...prev, restriction]
    );

  const cancel = () => {
    setIsEditing(false);
    setSelected(campaign.item_settings ?? []);
    setError("");
  };

  const save = async () => {
    setError("");
    setIsSaving(true);
    try {
      await updateCampaign({ item_setting_ids: selected.map((restriction) => restriction.id) });
      setIsEditing(false);
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to save item settings."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Label className="text-sm font-semibold text-foreground">Item settings</Label>
          <p className="text-sm text-muted-foreground">
            Campaign-wide setting restrictions applied to every warband for item availability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button type="button" variant="secondary" onClick={cancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={save}
                disabled={isSaving || !hasChanged}
              >
                {isSaving ? "Saving" : "Save"}
              </Button>
            </>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      </div>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((restriction) => (
            <div
              key={restriction.id}
              className="inline-flex items-center gap-1 rounded-full border border-primary/60 bg-primary/20 px-2.5 py-0.5 text-sm"
            >
              <span>{restriction.restriction}</span>
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => toggle(restriction)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No item settings selected.</p>
      )}
      {isEditing ? (
        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
          <RestrictionPicker
            restrictions={availableSettings}
            selected={selectedIds}
            onToggle={toggle}
            showFilter={false}
          />
        </div>
      ) : null}
      <p className="min-h-[1.25rem] text-sm text-red-600">{error}</p>
    </div>
  );
}
