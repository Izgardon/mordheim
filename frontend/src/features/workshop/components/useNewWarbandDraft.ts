import { useMemo, useState } from "react";

import { settingsById, useSettingsList } from "@/features/campaigns/api/settings-queries";

import { cleanCode, useBookTemplates } from "../api/workshop-queries";
import type { MakeWarbandBody, WorkshopListRow } from "../types/workshop-types";
import { bookTypeOption, bookTypes, variantsToPick } from "./book-types";
import { usePreviewOf } from "./CodePreview";

/** Where a new warband starts: a book type, one of my lists, or a shared list's code. */
export type Source = "book" | "mine" | "code";

type Listed = { types: { id: number; name: string; variant: string }[]; variants: Variant[] };
type Variant = { key: string; name: string };

/**
 * New warband's draft: the name, the source, and what it needs picked: a book type (and its
 * variant where it presets none), or a list (mine, or a code's, read first) with the type where
 * it serves several and the variant where that type presets none. `body` is what the server takes.
 */
export function useNewWarbandDraft(open: boolean, lists: WorkshopListRow[]) {
  const templates = useBookTemplates(open);
  const settingsList = useSettingsList({ enabled: open });
  const settings = useMemo(() => settingsById(settingsList.data?.settings), [settingsList.data]);
  const [name, setName] = useState("");
  const [source, setSourceState] = useState<Source>("book");
  const [typeId, setTypeId] = useState<number | null>(null);
  const [listId, setListId] = useState<number | null>(null);
  const [variant, setVariant] = useState("");
  const [code, setCode] = useState("");
  const preview = usePreviewOf(code);

  const rows = useMemo(() => bookTypes(templates.data ?? []), [templates.data]);
  const typeOptions = useMemo(
    () => rows.map((row) => bookTypeOption(row, settings)),
    [rows, settings]
  );
  const picked = rows.find((row) => row.type.id === typeId) ?? null;
  const mine = lists.find((row) => row.id === listId) ?? null;
  const shared = preview.data?.kind === "list" ? preview.data : null;
  const listed: Listed | null =
    source === "mine" && mine
      ? { types: mine.warband_types, variants: mine.variants }
      : source === "code" && shared
        ? { types: shared.warband_types, variants: shared.variants }
        : null;
  const listType = listed ? (typeId ?? listed.types[0]?.id ?? null) : null;
  const listPreset = listed?.types.find((type) => type.id === listType)?.variant ?? "";
  const variants = listed ? (listPreset ? [] : listed.variants) : variantsToPick(picked);
  const ready =
    Boolean(name.trim()) &&
    (source === "book" ? Boolean(picked) : Boolean(listed)) &&
    (!variants.length || Boolean(variant));

  const body = (): MakeWarbandBody => ({
    name: name.trim(),
    ...(source === "book" && picked ? { warband_type_id: picked.type.id } : {}),
    ...(source === "mine" && mine ? { list_id: mine.id } : {}),
    ...(source === "code" ? { list_code: cleanCode(code) } : {}),
    ...(listed && listType ? { warband_type_id: listType } : {}),
    ...(variant && variants.length ? { template_variant: variant } : {}),
  });
  const pickType = (next: number | null) => {
    setTypeId(next);
    setVariant("");
  };
  const reset = () => {
    setName("");
    setSourceState("book");
    setListId(null);
    setCode("");
    pickType(null);
  };

  return {
    name,
    setName,
    source,
    setSource: (next: Source) => {
      setSourceState(next);
      pickType(null);
    },
    typeOptions,
    typesLoading: templates.isLoading,
    typeId,
    pickType,
    listId,
    pickList: (next: number | null) => {
      setListId(next);
      pickType(null);
    },
    code,
    setCode,
    listTypes: listed?.types ?? [],
    listType,
    variants,
    variant,
    setVariant,
    ready,
    body,
    reset,
  };
}
