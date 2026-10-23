import type { ReactNode } from "react";

import { Button } from "@components/button";

import { CatalogueFormDialog } from "@/features/catalogue/components/CatalogueFormDialog";
import { useControllableOpen } from "@/features/catalogue/hooks/useControllableOpen";

import { useRaceForm } from "../hooks/useRaceForm";
import RaceFormFields from "./RaceFormFields";

import type { Race } from "../types/race-types";

type CreateRaceDialogProps = {
  campaignId: number;
  onCreated: (race: Race) => void;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** The race picker's Create race dialog. */
export default function CreateRaceDialog({
  campaignId,
  onCreated,
  trigger,
  open,
  onOpenChange,
}: CreateRaceDialogProps) {
  const dialog = useControllableOpen({ open, onOpenChange });
  const form = useRaceForm({ campaignId, resetKey: dialog.open, onSaved: onCreated });

  return (
    <CatalogueFormDialog
      form={form}
      dialog={dialog}
      title="ADD RACE"
      trigger={trigger}
      defaultTrigger={<Button>Add race</Button>}
      submitLabel="Add race"
      onReset={form.reset}
    >
      <RaceFormFields form={form} />
    </CatalogueFormDialog>
  );
}
