import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { SearchSelect } from "@/components/ui/search-select";
import { settingsById, useSettingsList } from "@/features/campaigns/api/settings-queries";
import { Field, FormError } from "@/features/campaigns/components/settings/settings-ui";
import { toastServerWarnings } from "@/features/warbands/utils/server-warnings";
import { getRefusalMessage } from "@/lib/get-error-message";

import { cleanCode, useBookTemplates, useMakeWarband } from "../api/workshop-queries";
import type { MakeWarbandBody } from "../types/workshop-types";
import { bookTypeOption, bookTypes, variantsToPick } from "./book-types";
import CodePreview, { usePreviewOf } from "./CodePreview";
import { workshopPath } from "./WorkshopCard";

type Source = "book" | "list";

/** A row of chips picking one of a few (the source, a variant, a list's type). */
function ChipPick<T extends string | number>(props: {
  label: string;
  options: { key: T; name: string }[];
  value: T | null;
  onChange: (key: T) => void;
}) {
  return (
    <Field label={props.label}>
      <div role="group" aria-label={props.label} className="flex flex-wrap gap-1.5">
        {props.options.map((option) => (
          <Chip
            key={option.key}
            pressed={option.key === props.value}
            onClick={() => props.onChange(option.key)}
          >
            {option.name}
          </Chip>
        ))}
      </div>
    </Field>
  );
}

/**
 * New warband (the workshop): a name, then a book warband type (every type: a workshop ticks
 * every setting) with its variant where the type presets none, or a shared list's code, read
 * first, with the type where it serves several. The warband's page opens once it is made.
 */
export default function NewWarbandDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const make = useMakeWarband();
  const templates = useBookTemplates(open);
  const settingsList = useSettingsList({ enabled: open });
  const settings = useMemo(() => settingsById(settingsList.data?.settings), [settingsList.data]);
  const [name, setName] = useState("");
  const [source, setSource] = useState<Source>("book");
  const [typeId, setTypeId] = useState<number | null>(null);
  const [variant, setVariant] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const preview = usePreviewOf(code);

  const rows = useMemo(() => bookTypes(templates.data ?? []), [templates.data]);
  const options = useMemo(() => rows.map((row) => bookTypeOption(row, settings)), [rows, settings]);
  const picked = rows.find((row) => row.type.id === typeId) ?? null;
  const variants = variantsToPick(picked);
  const listTypes = preview.data?.kind === "list" ? preview.data.warband_types : [];
  const listType = typeId ?? listTypes[0]?.id ?? null;
  const listPreset = listTypes.find((type) => type.id === listType)?.variant ?? "";
  const listVariants = preview.data?.kind === "list" && !listPreset ? preview.data.variants : [];
  const ready =
    Boolean(name.trim()) &&
    (source === "book"
      ? Boolean(picked) && (!variants.length || Boolean(variant))
      : !!preview.data && (!listVariants.length || Boolean(variant)));

  const change = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setName("");
      setTypeId(null);
      setVariant("");
      setCode("");
      setError("");
    }
  };
  const body = (): MakeWarbandBody =>
    source === "book"
      ? {
          name: name.trim(),
          warband_type_id: picked?.type.id,
          ...(variant ? { template_variant: variant } : {}),
        }
      : {
          name: name.trim(),
          list_code: cleanCode(code),
          ...(listType ? { warband_type_id: listType } : {}),
          ...(variant && listVariants.length ? { template_variant: variant } : {}),
        };
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!ready || make.isPending) return;
    setError("");
    make.mutate(body(), {
      onSuccess: (made) => {
        toastServerWarnings(made.warnings);
        change(false);
        navigate(workshopPath(made.id));
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
          <Button className="min-h-12" disabled={!ready || make.isPending} onClick={() => submit()}>
            {make.isPending ? "Making…" : "Make the warband"}
          </Button>
        </div>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="Name" htmlFor="workshop-warband-name">
          <Input
            id="workshop-warband-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            className="h-11 text-base md:h-11"
          />
        </Field>
        <ChipPick<Source>
          label="Start from"
          options={[
            { key: "book", name: "A warband type" },
            { key: "list", name: "A list code" },
          ]}
          value={source}
          onChange={(next) => {
            setSource(next);
            setTypeId(null);
            setVariant("");
          }}
        />
        {source === "book" ? (
          <>
            <Field label="Warband type" htmlFor="workshop-warband-type">
              <SearchSelect
                id="workshop-warband-type"
                label="Warband type"
                placeholder="Search warband types"
                emptyText="No warband type matches."
                loading={templates.isLoading}
                options={options}
                value={options.find((option) => option.id === typeId) ?? null}
                onChange={(option) => {
                  setTypeId(option ? Number(option.id) : null);
                  setVariant("");
                }}
                inputClassName="h-11 text-base"
              />
            </Field>
            {variants.length ? (
              <ChipPick
                label="Variant"
                options={variants}
                value={variant || null}
                onChange={setVariant}
              />
            ) : null}
          </>
        ) : (
          <>
            <CodePreview id="workshop-list-code" code={code} onCode={setCode} label="List code" />
            {listTypes.length > 1 ? (
              <ChipPick
                label="Warband type"
                options={listTypes.map((type) => ({ key: type.id, name: type.name }))}
                value={listType}
                onChange={(next) => {
                  setTypeId(next);
                  setVariant("");
                }}
              />
            ) : null}
            {listVariants.length ? (
              <ChipPick
                label="Variant"
                options={listVariants}
                value={variant || null}
                onChange={setVariant}
              />
            ) : null}
          </>
        )}
        <FormError message={error} />
      </form>
    </ModalSheet>
  );
}
