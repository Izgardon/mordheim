import { useEffect, useState } from "react";

import { Button } from "@components/button";
import { Input } from "@components/input";
import { getErrorMessage } from "@/lib/get-error-message";
import { normalizeWebUrl } from "@/lib/url-utils";

import { updateWarband } from "@/features/warbands/api/warbands-api";

import type { Warband } from "@/features/warbands/types/warband-types";

type WarbandLinkSectionProps = {
  warband: Warband;
  canEdit: boolean;
  onWarbandUpdated: (warband: Warband) => void;
};

/** A link to the warband's roster or sheet anywhere on the web, for sharing. */
export default function WarbandLinkSection({
  warband,
  canEdit,
  onWarbandUpdated,
}: WarbandLinkSectionProps) {
  const [url, setUrl] = useState(warband.warband_link ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setUrl(warband.warband_link ?? "");
  }, [warband.warband_link]);

  const cancel = () => {
    setIsEditing(false);
    setUrl(warband.warband_link ?? "");
    setError("");
  };

  const save = async () => {
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const normalizedUrl = normalizeWebUrl(url);
      const updated = await updateWarband(warband.id, { warband_link: normalizedUrl || null });
      onWarbandUpdated({ ...warband, warband_link: updated.warband_link });
      setIsEditing(false);
      setMessage("Warband link updated.");
      setTimeout(() => setMessage(""), 3000);
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save warband link."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section aria-label="Warband link" className="space-y-1.5 border-t border-border/50 pt-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Warband Link</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Link to your warband roster, sheet, or any web page for easy sharing.
          </p>
        </div>
        {canEdit ? (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="secondary" size="sm" onClick={cancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button size="sm" className="min-w-[4.5rem]" onClick={save} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
          </div>
        ) : null}
      </div>
      {isEditing ? (
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          type="url"
        />
      ) : warband.warband_link ? (
        <a
          href={warband.warband_link}
          target="_blank"
          rel="noopener noreferrer"
          className="block min-w-0 truncate text-sm text-primary underline underline-offset-2"
        >
          {warband.warband_link}
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">No warband link set.</p>
      )}
      {message && <p className="min-h-[1.25rem] text-sm text-emerald-400">{message}</p>}
      {error && <p className="min-h-[1.25rem] text-sm text-red-600">{error}</p>}
      <p className="mt-0.5 text-xs text-muted-foreground">
        If using a google drive link, make sure it is set to "Anyone with the link can view". Google
        docs links will not work well on mobile.
      </p>
    </section>
  );
}
