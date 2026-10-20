import type { Dispatch, SetStateAction } from "react";

import { Input } from "@components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/select";

import { UNASSIGNED_OWNER } from "../hooks/useEncampments";

import type { CampaignEncampmentPayload, CampaignPlayerName } from "../types/campaign-types";

const textareaClassName =
  "w-full border border-border/60 bg-background/80 px-4 py-3 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]";

type EncampmentFormFieldsProps = {
  form: CampaignEncampmentPayload;
  setForm: Dispatch<SetStateAction<CampaignEncampmentPayload>>;
  ownerValue: string;
  onOwnerChange: (value: string) => void;
  players: CampaignPlayerName[];
};

/** An encampment's name, owner (any member, or Unassigned) and description. */
export default function EncampmentFormFields({
  form,
  setForm,
  ownerValue,
  onOwnerChange,
  players,
}: EncampmentFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <label className="mb-1 block text-xs text-muted-foreground">Name</label>
        <Input
          value={form.name ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Sailmakers' Row"
        />
      </div>
      <div className="space-y-2">
        <label className="mb-1 block text-xs text-muted-foreground">Owner</label>
        <Select value={ownerValue} onValueChange={onOwnerChange}>
          <SelectTrigger>
            <SelectValue placeholder="Choose an owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED_OWNER}>Unassigned</SelectItem>
            {players.map((player) => (
              <SelectItem key={player.id} value={String(player.id)}>
                {player.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <label className="mb-1 block text-xs text-muted-foreground">Description</label>
        <textarea
          className={`${textareaClassName} min-h-[150px]`}
          value={form.description ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="What does this encampment provide, protect, or connect to?"
        />
      </div>
    </>
  );
}
