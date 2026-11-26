import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { SearchSelect } from "@/components/ui/search-select";
import { settingsById, useSettingsList } from "@/features/campaigns/api/settings-queries";
import { Field, FormError } from "@/features/campaigns/components/settings/settings-ui";
import { toastServerWarnings } from "@/features/warbands/utils/server-warnings";
import { getRefusalMessage } from "@/lib/get-error-message";

import { useBookTemplates, useMakeList } from "../api/workshop-queries";
import { templateOption } from "./book-types";
import { madePath } from "../paths";

/**
 * New warband list (the workshop): a name, and the book list it starts as a copy of (none: a
 * blank list). The list's page opens once it is made, for the template editor.
 */
export default function NewListDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const make = useMakeList();
  const templates = useBookTemplates(open);
  const settingsList = useSettingsList({ enabled: open });
  const settings = useMemo(() => settingsById(settingsList.data?.settings), [settingsList.data]);
  const [name, setName] = useState("");
  const [copyOf, setCopyOf] = useState<number | null>(null);
  const [error, setError] = useState("");
  const options = useMemo(
    () =>
      (templates.data ?? [])
        .map((template) => templateOption(template, settings))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [templates.data, settings]
  );

  const change = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setName("");
      setCopyOf(null);
      setError("");
    }
  };
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!name.trim() || make.isPending) return;
    setError("");
    make.mutate(
      { name: name.trim(), ...(copyOf ? { copy_of_template_id: copyOf } : {}) },
      {
        onSuccess: (made) => {
          toastServerWarnings(made.warnings);
          change(false);
          navigate(madePath(made));
        },
        onError: (refused) => setError(getRefusalMessage(refused, "Couldn't make the list.")),
      }
    );
  };

  return (
    <ModalSheet
      open={open}
      onOpenChange={change}
      kicker="Warband lists"
      title="New warband list"
      className="max-w-[520px]"
      footer={
        <div className="grid w-full grid-cols-[1fr_2fr] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={() => change(false)}>
            Cancel
          </Button>
          <Button
            className="min-h-12"
            disabled={!name.trim() || make.isPending}
            onClick={() => submit()}
          >
            {make.isPending ? "Making…" : "Make the list"}
          </Button>
        </div>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="Name" htmlFor="workshop-list-name">
          <Input
            id="workshop-list-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={160}
            className="h-11 text-base md:h-11"
          />
        </Field>
        <Field label="Copy of a book list" htmlFor="workshop-list-copy">
          <SearchSelect
            id="workshop-list-copy"
            label="Copy of a book list"
            placeholder="Blank, or search the book's lists"
            emptyText="No list matches."
            loading={templates.isLoading}
            options={options}
            value={options.find((option) => option.id === copyOf) ?? null}
            onChange={(option) => setCopyOf(option ? Number(option.id) : null)}
            clearLabel="Start blank"
            inputClassName="h-11 text-base"
          />
        </Field>
        <FormError message={error} />
      </form>
    </ModalSheet>
  );
}
