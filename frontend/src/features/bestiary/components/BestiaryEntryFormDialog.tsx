import { useBestiaryEntryForm } from "../hooks/useBestiaryEntryForm";
import BestiaryEntryFormFields from "./form/BestiaryEntryFormFields";
import BestiaryFormDialogShell from "./form/BestiaryFormDialogShell";

import type { BestiaryEntry } from "../types/bestiary-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  onCreated?: (entry: BestiaryEntry) => void;
};

/** The Bestiary's Add entry dialog. */
export default function BestiaryEntryFormDialog({
  open,
  onOpenChange,
  campaignId,
  onCreated,
}: Props) {
  const form = useBestiaryEntryForm({ campaignId, open, onOpenChange, onCreated });

  return (
    <BestiaryFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Add Bestiary Entry"
      onSubmit={form.submit}
      error={form.error}
      isSaving={form.isSaving}
      canSubmit={Boolean(form.values.name.trim())}
    >
      <BestiaryEntryFormFields form={form} />
    </BestiaryFormDialogShell>
  );
}
