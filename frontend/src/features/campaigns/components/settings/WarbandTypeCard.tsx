import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChipLabel } from "@/components/ui/chip";
import { updateWarband } from "@/features/warbands/api/warbands-core";
import WarbandTypePicker from "@/features/warbands/components/type-picker/WarbandTypePicker";
import {
  linkAfterPick,
  typeMeta,
} from "@/features/warbands/components/type-picker/warband-type-picker";
import type { Warband, WarbandTypeRow } from "@/features/warbands/types/warband-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

import { CAPTION, FormError, SettingsCard } from "./settings-ui";

type WarbandTypeCardProps = {
  warband: Warband;
  canEdit: boolean;
  onSaved: (patch: Partial<Warband>) => void;
};

/**
 * What your warband is (grading phase 1): its warband type, changed with the same picker as
 * raising one (the warband link follows when it still held the old type's link), and the types it
 * counts as, for custom warbands and house rules. Each change saves at once.
 */
export default function WarbandTypeCard({ warband, canEdit, onSaved }: WarbandTypeCardProps) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const countsAs = warband.counts_as ?? [];

  const save = async (payload: Parameters<typeof updateWarband>[1]) => {
    setSaving(true);
    setError("");
    try {
      const updated = await updateWarband(warband.id, payload);
      onSaved({
        warband_type: updated.warband_type,
        counts_as: updated.counts_as,
        warband_link: updated.warband_link,
      });
      // what it can usually buy, hire and learn follows its types (the items rebuild)
      void queryClient.invalidateQueries({
        queryKey: queryKeys.campaign.warbandWhoCan(warband.campaign_id, warband.id),
      });
      return true;
    } catch (failure) {
      setError(getErrorMessage(failure, "Couldn't save that."));
      return false;
    } finally {
      setSaving(false);
    }
  };
  const changeType = (picked: WarbandTypeRow) => {
    if (picked.id === warband.warband_type?.id) return;
    const link = linkAfterPick(warband.warband_link ?? "", warband.warband_type, picked);
    void save({ warband_type_id: picked.id, warband_link: link.trim() || null });
  };
  const setCountsAs = async (ids: number[]) => {
    if (await save({ counts_as_ids: ids })) setAdding(false);
  };

  return (
    <SettingsCard title="Warband type">
      <div className="flex flex-col gap-1.5">
        <span className={CAPTION}>Type</span>
        {canEdit ? (
          <WarbandTypePicker
            id="settings-warband-type"
            campaignId={warband.campaign_id}
            value={warband.warband_type}
            onPick={changeType}
          />
        ) : (
          <p className="m-0 text-[15px] text-ink">
            {warband.warband_type
              ? `${warband.warband_type.name} · ${typeMeta(warband.warband_type)}`
              : "None"}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5 border-t border-line pt-4">
        <span className={CAPTION}>Counts as</span>
        <div className="flex flex-wrap gap-1.5">
          {countsAs.length ? (
            countsAs.map((type) => (
              <ChipLabel key={type.id} className="min-h-[34px] gap-1 text-[13px] text-ink">
                {type.name}
                {canEdit ? (
                  <button
                    type="button"
                    aria-label={`Stop counting as ${type.name}`}
                    disabled={saving}
                    className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-ink"
                    onClick={() =>
                      void setCountsAs(
                        countsAs.filter((entry) => entry.id !== type.id).map((entry) => entry.id)
                      )
                    }
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </ChipLabel>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Nothing else.</span>
          )}
        </div>
        {canEdit && adding ? (
          <WarbandTypePicker
            id="settings-warband-counts-as"
            campaignId={warband.campaign_id}
            value={null}
            hidden={[
              ...(warband.warband_type ? [warband.warband_type.id] : []),
              ...countsAs.map((type) => type.id),
            ]}
            onPick={(picked) => void setCountsAs([...countsAs.map((type) => type.id), picked.id])}
            placeholder="Search warband types"
          />
        ) : null}
        {canEdit ? (
          <Button
            variant="secondary"
            className="self-start"
            disabled={saving}
            onClick={() => setAdding((open) => !open)}
          >
            {adding ? "Cancel" : "Add a type"}
          </Button>
        ) : null}
      </div>
      <FormError message={error} />
    </SettingsCard>
  );
}
