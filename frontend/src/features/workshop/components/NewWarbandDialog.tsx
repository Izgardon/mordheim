import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { SearchSelect } from "@/components/ui/search-select";
import { Field, FormError } from "@/features/campaigns/components/settings/settings-ui";
import { toastServerWarnings } from "@/features/warbands/utils/server-warnings";
import { getRefusalMessage } from "@/lib/get-error-message";

import { useMakeWarband } from "../api/workshop-queries";
import { madePath } from "../paths";
import type { WorkshopListRow } from "../types/workshop-types";
import ChipPick from "./ChipPick";
import CodePreview from "./CodePreview";
import { useNewWarbandDraft, type Source } from "./useNewWarbandDraft";

const SOURCES: { key: Source; name: string }[] = [
  { key: "book", name: "A warband type" },
  { key: "mine", name: "One of my lists" },
  { key: "code", name: "A list code" },
];

/**
 * New warband (the workshop): a name, then a book warband type (every type: every setting is in
 * play in a workshop), one of my lists, or a shared list's code (read first), with the type where
 * the list serves several and the variant where the type presets none. Its page opens once made.
 */
export default function NewWarbandDialog({
  open,
  onOpenChange,
  lists,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** My lists, to start from one. */
  lists: WorkshopListRow[];
}) {
  const navigate = useNavigate();
  const make = useMakeWarband();
  const draft = useNewWarbandDraft(open, lists);
  const [error, setError] = useState("");
  const sources = lists.length ? SOURCES : SOURCES.filter((source) => source.key !== "mine");
  const listOptions = lists.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.warband_types.map((type) => type.name).join(", "),
  }));

  const change = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      draft.reset();
      setError("");
    }
  };
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!draft.ready || make.isPending) return;
    setError("");
    make.mutate(draft.body(), {
      onSuccess: (made) => {
        toastServerWarnings(made.warnings);
        change(false);
        navigate(madePath(made));
      },
      onError: (refused) => setError(getRefusalMessage(refused, "Couldn't make the warband.")),
    });
  };

  return (
    <ModalSheet
      open={open}
      onOpenChange={change}
      kicker="Warbands"
      title="New warband"
      className="max-w-[520px]"
      footer={
        <div className="grid w-full grid-cols-[1fr_2fr] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={() => change(false)}>
            Cancel
          </Button>
          <Button
            className="min-h-12"
            disabled={!draft.ready || make.isPending}
            onClick={() => submit()}
          >
            {make.isPending ? "Making…" : "Make the warband"}
          </Button>
        </div>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="Name" htmlFor="workshop-warband-name">
          <Input
            id="workshop-warband-name"
            value={draft.name}
            onChange={(event) => draft.setName(event.target.value)}
            maxLength={120}
            className="h-11 text-base md:h-11"
          />
        </Field>
        <ChipPick<Source>
          label="Start from"
          options={sources}
          value={draft.source}
          onChange={draft.setSource}
        />
        {draft.source === "book" ? (
          <Field label="Warband type" htmlFor="workshop-warband-type">
            <SearchSelect
              id="workshop-warband-type"
              label="Warband type"
              placeholder="Search warband types"
              emptyText="No warband type matches."
              loading={draft.typesLoading}
              options={draft.typeOptions}
              value={draft.typeOptions.find((option) => option.id === draft.typeId) ?? null}
              onChange={(option) => draft.pickType(option ? Number(option.id) : null)}
              inputClassName="h-11 text-base"
            />
          </Field>
        ) : draft.source === "mine" ? (
          <Field label="List" htmlFor="workshop-warband-list">
            <SearchSelect
              id="workshop-warband-list"
              label="List"
              placeholder="Search my lists"
              emptyText="No list matches."
              options={listOptions}
              value={listOptions.find((option) => option.id === draft.listId) ?? null}
              onChange={(option) => draft.pickList(option ? Number(option.id) : null)}
              inputClassName="h-11 text-base"
            />
          </Field>
        ) : (
          <CodePreview
            id="workshop-list-code"
            code={draft.code}
            onCode={draft.setCode}
            label="List code"
          />
        )}
        {draft.listTypes.length > 1 ? (
          <ChipPick
            label="Warband type"
            options={draft.listTypes.map((type) => ({ key: type.id, name: type.name }))}
            value={draft.listType}
            onChange={draft.pickType}
          />
        ) : null}
        {draft.variants.length ? (
          <ChipPick
            label="Variant"
            options={draft.variants}
            value={draft.variant || null}
            onChange={draft.setVariant}
          />
        ) : null}
        <FormError message={error} />
      </form>
    </ModalSheet>
  );
}
