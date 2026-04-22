import { useState } from "react";

// components
import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { Input } from "@/components/ui/input";
import WarbandDiceSettingsCard from "../../../campaigns/components/settings/WarbandDiceSettingsCard";
import { normalizeWebUrl } from "@/lib/url-utils";

// api
import { updateWarband } from "../../api/warbands-api";
import type { Warband } from "../../types/warband-types";

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
  const [pdfUrl, setPdfUrl] = useState(warband.warband_link ?? "");
  const [isPdfEditing, setIsPdfEditing] = useState(false);
  const [isPdfSaving, setIsPdfSaving] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfMessage, setPdfMessage] = useState("");

  const handleSavePdf = async () => {
    setIsPdfSaving(true);
    setPdfError("");
    setPdfMessage("");
    try {
      const normalizedUrl = normalizeWebUrl(pdfUrl);
      const updated = await updateWarband(warband.id, { warband_link: normalizedUrl || null });
      onWarbandUpdated({ ...warband, warband_link: updated.warband_link });
      setIsPdfEditing(false);
      setPdfMessage("Warband link updated.");
      setTimeout(() => setPdfMessage(""), 3000);
    } catch (saveError) {
      if (saveError instanceof Error) {
        setPdfError(saveError.message);
      } else {
        setPdfError("Unable to save warband link.");
      }
    } finally {
      setIsPdfSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {canEdit ? (
        <CardBackground className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Warband Link</h3>
              <p className="text-sm text-muted-foreground">
                Link to a roster, sheet, or any web page for this warband.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              {isPdfEditing ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setIsPdfEditing(false);
                      setPdfUrl(warband.warband_link ?? "");
                      setPdfError("");
                    }}
                    disabled={isPdfSaving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSavePdf} disabled={isPdfSaving}>
                    {isPdfSaving ? "Saving..." : "Save"}
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setIsPdfEditing(true)}>
                  Edit
                </Button>
              )}
            </div>
          </div>
          {isPdfEditing ? (
            <Input
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
              placeholder="https://..."
              type="url"
            />
          ) : warband.warband_link ? (
            <a
              href={warband.warband_link}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-sm text-primary underline underline-offset-2"
            >
              {warband.warband_link}
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">No warband link set.</p>
          )}
          {pdfMessage ? <p className="text-sm text-emerald-400">{pdfMessage}</p> : null}
          {pdfError ? <p className="text-sm text-red-600">{pdfError}</p> : null}
        </CardBackground>
      ) : null}

      <WarbandDiceSettingsCard campaignRole={campaignRole} />
    </div>
  );
}
