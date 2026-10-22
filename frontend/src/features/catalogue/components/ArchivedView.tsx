import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@components/button";
import { Checkbox } from "@components/checkbox";

import { getRefusalMessage } from "@/lib/get-error-message";

import type { CatalogueEntryKind } from "../api/catalogue-entry-api";
import { useCatalogueRestore } from "../hooks/useNameTakenMatches";
import type { CatalogueEntryLike } from "../types/catalogue-entry";

/** The filter bar's "Archived" switch. */
export function ArchivedToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
      <Checkbox checked={checked} onChange={(event) => onChange(event.target.checked)} />
      Archived
    </label>
  );
}

/** An archived row's Restore: back in the campaign's lists, shops and pickers. */
export function RestoreButton({
  kind,
  campaignId,
  entry,
}: {
  kind: CatalogueEntryKind;
  campaignId: number;
  entry: CatalogueEntryLike;
}) {
  const restore = useCatalogueRestore(kind, campaignId);
  const [isRestoring, setIsRestoring] = useState(false);
  const run = async () => {
    setIsRestoring(true);
    try {
      await restore(entry);
      toast.success(`${entry.name} restored.`);
    } catch (caught) {
      toast.error(`Couldn't restore ${entry.name}.`, {
        description: getRefusalMessage(caught, "Please try again."),
      });
    } finally {
      setIsRestoring(false);
    }
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`Restore ${entry.name}`}
      disabled={isRestoring}
      onClick={() => void run()}
    >
      {isRestoring ? "Restoring..." : "Restore"}
    </Button>
  );
}
