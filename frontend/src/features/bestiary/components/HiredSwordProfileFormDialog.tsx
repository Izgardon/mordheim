import { useHiredSwordForm } from "../hooks/useHiredSwordForm";
import BestiaryFormDialogShell from "./form/BestiaryFormDialogShell";
import HiredSwordFormFields from "./form/HiredSwordFormFields";

import type { HiredSwordProfile } from "../types/bestiary-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  onCreated?: (profile: HiredSwordProfile) => void;
};

/** Hired Swords' Add hired sword dialog. */
export default function HiredSwordProfileFormDialog({
  open,
  onOpenChange,
  campaignId,
  onCreated,
}: Props) {
  const form = useHiredSwordForm({ campaignId, open, onOpenChange, onCreated });

  return (
    <BestiaryFormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Add Hired Sword"
      onSubmit={form.submit}
      error={form.error}
      isSaving={form.isSaving}
      canSubmit={Boolean(form.values.name.trim())}
    >
      <HiredSwordFormFields form={form} />
    </BestiaryFormDialogShell>
  );
}
