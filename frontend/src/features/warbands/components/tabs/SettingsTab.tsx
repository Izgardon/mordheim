import { useEffect, useMemo, useState } from "react";

import { X } from "lucide-react";

// components
import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import WarbandDiceSettingsCard from "../../../campaigns/components/settings/WarbandDiceSettingsCard";
import RestrictionPicker from "../shared/RestrictionPicker";

// api
import { listRestrictions } from "../../../items/api/items-api";
import { updateWarbandRestrictions } from "../../api/warbands-api";

// types
import type { Restriction } from "../../../items/types/item-types";
import type { Warband } from "../../types/warband-types";

const EXCLUDED_TYPES = new Set(["Artifact"]);

type SettingsTabProps = {
  warband: Warband;
  canEdit: boolean;
  campaignRole?: string | null;
  onWarbandUpdated: (warband: Warband) => void;
};

export default function SettingsTab({
  warband,
  canEdit,
  campaignRole,
  onWarbandUpdated,
}: SettingsTabProps) {
  const [allRestrictions, setAllRestrictions] = useState<Restriction[]>([]);
  const [selectedRestrictions, setSelectedRestrictions] = useState<Restriction[]>(
    warband.restrictions ?? []
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    listRestrictions({ campaignId: warband.campaign_id })
      .then((data) => setAllRestrictions(data.filter((r) => !EXCLUDED_TYPES.has(r.type))))
      .catch(() => setAllRestrictions([]));
  }, [warband.campaign_id]);

  useEffect(() => {
    setSelectedRestrictions(warband.restrictions ?? []);
  }, [warband.restrictions]);

  const selectedIds = useMemo(
    () => new Set(selectedRestrictions.map((r) => r.id)),
    [selectedRestrictions]
  );

  const handleToggleRestriction = (restriction: Restriction) => {
    setSelectedRestrictions((prev) =>
      prev.some((r) => r.id === restriction.id)
        ? prev.filter((r) => r.id !== restriction.id)
        : [...prev, restriction]
    );
  };

  const handleRemoveRestriction = (restrictionId: number) => {
    setSelectedRestrictions((prev) => prev.filter((r) => r.id !== restrictionId));
  };

  const startEditing = () => {
    setIsEditing(true);
    setError("");
    setMessage("");
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setSelectedRestrictions(warband.restrictions ?? []);
    setError("");
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateWarbandRestrictions(
        warband.id,
        selectedRestrictions.map((r) => r.id)
      );
      onWarbandUpdated({ ...warband, restrictions: updated });
      setIsEditing(false);
      setMessage("Restrictions updated.");
      setTimeout(() => setMessage(""), 3000);
    } catch (saveError) {
      if (saveError instanceof Error) {
        setError(saveError.message);
      } else {
        setError("Unable to save restrictions.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const displayRestrictions = isEditing ? selectedRestrictions : (warband.restrictions ?? []);

  return (
    <div className="space-y-6">
      <CardBackground className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Restrictions</h3>
            <p className="text-sm text-muted-foreground">
              The restrictions this warband satisfies for item availability.
            </p>
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={cancelEditing}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={startEditing}>
                  Edit
                </Button>
              )}
            </div>
          ) : null}
        </div>

        {isEditing ? (
          <>
            {selectedRestrictions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedRestrictions.map((r) => (
                  <div
                    key={r.id}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/60 bg-primary/20 px-2.5 py-0.5 text-sm"
                  >
                    <span>{r.restriction}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRestriction(r.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <RestrictionPicker
                restrictions={allRestrictions}
                selected={selectedIds}
                onToggle={handleToggleRestriction}
              />
            </div>
          </>
        ) : displayRestrictions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {displayRestrictions.map((r) => (
              <div
                key={r.id}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm"
              >
                <span>{r.restriction}</span>
                <span className="text-xs text-muted-foreground">({r.type})</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No restrictions set.</p>
        )}

        {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </CardBackground>

      <WarbandDiceSettingsCard campaignRole={campaignRole} />
    </div>
  );
}
