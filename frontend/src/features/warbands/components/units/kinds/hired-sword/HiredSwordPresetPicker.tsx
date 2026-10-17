import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Input } from "@components/input";
import { Label } from "@components/label";
import { useCatalogue } from "@/lib/catalogue-queries";

function formatCost(cost: number | null, expression: string): string {
  if (expression) return expression;
  if (cost !== null) return `${cost} gc`;
  return "-";
}

type HiredSwordPresetPickerProps = {
  campaignId: number;
  onAddFromPreset: (profileId: number) => Promise<void>;
};

/** "Add from preset": fills the add form from a hired-sword profile of the campaign. */
export default function HiredSwordPresetPicker({
  campaignId,
  onAddFromPreset,
}: HiredSwordPresetPickerProps) {
  const [presetQuery, setPresetQuery] = useState("");
  const { data: presetProfiles, isLoading: isLoadingPresets } = useCatalogue(
    "hired-swords",
    campaignId
  );
  const [addingPresetId, setAddingPresetId] = useState<number | null>(null);
  const [presetError, setPresetError] = useState("");
  const [hasSelectedPreset, setHasSelectedPreset] = useState(false);

  const filteredPresets = useMemo(() => {
    const q = presetQuery.trim().toLowerCase();
    if (!q) return presetProfiles;
    return presetProfiles.filter((p) => p.bestiary_entry.name.toLowerCase().includes(q));
  }, [presetProfiles, presetQuery]);

  const handlePresetClick = async (profileId: number) => {
    if (addingPresetId !== null) return;
    setAddingPresetId(profileId);
    setPresetError("");
    try {
      await onAddFromPreset(profileId);
      const selectedProfile = presetProfiles.find((profile) => profile.id === profileId);
      if (selectedProfile) {
        setPresetQuery(selectedProfile.bestiary_entry.name);
      }
      setHasSelectedPreset(true);
    } catch (err) {
      setPresetError(err instanceof Error ? err.message : "Failed to add preset.");
    } finally {
      setAddingPresetId(null);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground">Add from preset</Label>
      <Input
        type="search"
        value={presetQuery}
        onChange={(e) => setPresetQuery(e.target.value)}
        placeholder="Search presets..."
        className="max-w-sm"
      />
      <div className="max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-background/40">
        {isLoadingPresets ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">Loading presets...</p>
        ) : filteredPresets.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {presetQuery ? "No presets match your search." : "No presets available."}
          </p>
        ) : (
          <div className="divide-y divide-border/40">
            {filteredPresets.map((profile) => {
              const isAdding = addingPresetId === profile.id;
              const isDisabled = addingPresetId !== null;
              return (
                <button
                  key={profile.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handlePresetClick(profile.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="text-xs font-semibold text-foreground">
                    {profile.bestiary_entry.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {isAdding ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <>
                        Hire: {formatCost(profile.hire_cost, profile.hire_cost_expression)}
                        {" · "}
                        Upkeep: {formatCost(profile.upkeep_cost, profile.upkeep_cost_expression)}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {presetError ? <p className="text-sm text-red-600">{presetError}</p> : null}
      {!hasSelectedPreset ? (
        <div className="flex items-center gap-2 pt-1">
          <div className="h-px flex-1 bg-border/60" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            or fill in manually
          </span>
          <div className="h-px flex-1 bg-border/60" />
        </div>
      ) : null}
    </div>
  );
}
