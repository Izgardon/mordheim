import { useId, useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useDirtySince, useDiscardChanges } from "@/components/ui/discard-changes";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { AREA, LABEL } from "@/features/locations/components/form-styles";
import { getErrorMessage } from "@/lib/get-error-message";

import { useAddScenario, useCreateScenario } from "../api/scenario-queries";
import { STANDARD_SECTIONS, type CampaignScenario, type ScenarioInput } from "../types";

const SELECT = "min-h-10 border border-strong bg-page px-2 text-sm text-ink";
const BLANK: ScenarioInput = {
  name: "",
  players: "1v1",
  source: "",
  summary: "",
  intro: "",
  sections: [],
};

/**
 * Add new: the campaign's own scenario, written in the catalogue and put on the list at 1×: its
 * name, who it is for, source, one-line summary, opening lines and sections, the standard headings
 * one press each.
 */
export default function ScenarioFormDialog({
  campaignId,
  open,
  onOpenChange,
  onSaved,
}: {
  campaignId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (row: CampaignScenario) => void;
}) {
  const id = useId();
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(open);
  const { dirty, markClean } = useDirtySince(form);
  if (shown !== open) {
    setShown(open);
    setForm(BLANK);
    setError("");
    markClean();
  }
  const create = useCreateScenario(campaignId);
  const add = useAddScenario(campaignId);
  const discard = useDiscardChanges({ dirty, onClose: () => onOpenChange(false) });
  const set = (patch: Partial<ScenarioInput>) => setForm({ ...form, ...patch });
  const setSection = (at: number, patch: Partial<ScenarioInput["sections"][number]>) =>
    set({ sections: form.sections.map((s, index) => (index === at ? { ...s, ...patch } : s)) });
  const addSection = (title: string) => set({ sections: [...form.sections, { title, text: "" }] });
  const used = new Set(form.sections.map((section) => section.title));
  const saving = create.isPending || add.isPending;
  const save = () => {
    const input = {
      ...form,
      name: form.name.trim(),
      sections: form.sections.filter((section) => section.title.trim()),
    };
    create.mutate(input, {
      onSuccess: (scenario) =>
        add.mutate(
          { scenarioId: scenario.id },
          {
            onSuccess: (row) => {
              markClean();
              onOpenChange(false);
              onSaved(row);
            },
            onError: (failure) => setError(getErrorMessage(failure, "Couldn't list the scenario.")),
          }
        ),
      onError: (failure) => setError(getErrorMessage(failure, "Couldn't save the scenario.")),
    });
  };
  const field = (key: "name" | "source" | "summary", label: string, max: number) => (
    <div className="flex min-w-[200px] flex-1 flex-col gap-2">
      <label htmlFor={`${id}-${key}`} className={LABEL}>
        {label}
      </label>
      <Input
        id={`${id}-${key}`}
        maxLength={max}
        value={form[key]}
        onChange={(event) => set({ [key]: event.target.value })}
      />
    </div>
  );

  return (
    <ModalSheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : discard.close())}
      kicker="Scenarios"
      title="Add a scenario"
      closeButton
      className="max-w-[720px]"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {error ? (
            <p role="alert" className="m-0 mr-auto text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button variant="secondary" onClick={discard.close}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !form.name.trim()}>
            {saving ? "Saving…" : "Add scenario"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-4">
          {field("name", "Name", 160)}
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-players`} className={LABEL}>
              Players
            </label>
            <select
              id={`${id}-players`}
              className={SELECT}
              value={form.players}
              onChange={(event) => set({ players: event.target.value as ScenarioInput["players"] })}
            >
              <option value="1v1">1v1</option>
              <option value="multiplayer">Multiplayer</option>
              <option value="either">1v1 or multiplayer</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          {field("source", "Source", 120)}
          {field("summary", "Summary", 1000)}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-intro`} className={LABEL}>
            Opening lines
          </label>
          <textarea
            id={`${id}-intro`}
            className={`${AREA} min-h-[80px]`}
            value={form.intro}
            onChange={(event) => set({ intro: event.target.value })}
          />
        </div>
        {form.sections.map((section, at) => (
          <fieldset key={at} className="m-0 flex flex-col gap-2 border border-border p-3">
            <legend className="sr-only">Section {at + 1}</legend>
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Section ${at + 1} heading`}
                maxLength={160}
                value={section.title}
                onChange={(event) => setSection(at, { title: event.target.value })}
              />
              <IconButton
                aria-label={`Remove ${section.title || `section ${at + 1}`}`}
                onClick={() => set({ sections: form.sections.filter((_, index) => index !== at) })}
              >
                <X aria-hidden="true" />
              </IconButton>
            </div>
            <textarea
              aria-label={`${section.title || `Section ${at + 1}`} text`}
              className={`${AREA} min-h-[90px]`}
              value={section.text}
              onChange={(event) => setSection(at, { text: event.target.value })}
            />
          </fieldset>
        ))}
        <div className="flex flex-col gap-2">
          <span className={LABEL}>Add a section</span>
          <div className="flex flex-wrap gap-1.5">
            {STANDARD_SECTIONS.filter((title) => !used.has(title)).map((title) => (
              <Chip key={title} onClick={() => addSection(title)}>
                {title}
              </Chip>
            ))}
            <Chip onClick={() => addSection("")}>
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              Other
            </Chip>
          </div>
        </div>
      </div>
      {discard.confirm}
    </ModalSheet>
  );
}
