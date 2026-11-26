import { useMemo, useState } from "react";

import { settingsById, useSettingsList } from "@/features/campaigns/api/settings-queries";

import { cleanCode, useBookTemplates } from "../api/workshop-queries";
import type { MakeWarbandBody, WorkshopListRow } from "../types/workshop-types";
import { bookTypeOption, bookTypes, variantsToPick } from "./book-types";
import { usePreviewOf } from "./CodePreview";

/**
 * Where a new warband starts: a book type (its book list), one of my lists, a shared list's code,
 * or no list at all (William, 26 Nov 2026): a type, a budget and most warriors, units by hand.
 */
export type Source = "book" | "mine" | "code" | "none";

/** A no-list warband's budget and most warriors, until the player changes them. */
const BUDGET = "500";
const MOST_WARRIORS = "15";

/** A box's whole number at or above `least`, else null. */
const whole = (typed: string, least: number) => {
  const value = Number(typed);
  return typed.trim() && Number.isInteger(value) && value >= least ? value : null;
};

type Listed = { types: { id: number; name: string; variant: string }[]; variants: Variant[] };
type Variant = { key: string; name: string };

/**
 * New warband's draft: the name, the source, and what it needs picked: a book type (and its
 * variant where it presets none), a list (mine, or a code's, read first) with the type where it
 * serves several and the variant where that type presets none, or a type with no list and its
 * budget and most warriors. `body` is what the server takes.
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
  const [budget, setBudget] = useState(BUDGET);
  const [most, setMost] = useState(MOST_WARRIORS);
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
  const noList = source === "none";
  const listVariants = listed && !listPreset ? listed.variants : [];
  const variants = noList ? [] : listed ? listVariants : variantsToPick(picked);
  const budgetGc = whole(budget, 0);
  const mostWarriors = whole(most, 1);
  const ready =
    Boolean(name.trim()) &&
    (source === "book" || noList ? Boolean(picked) : Boolean(listed)) &&
    (!noList || (budgetGc !== null && mostWarriors !== null)) &&
    (!variants.length || Boolean(variant));

  const body = (): MakeWarbandBody =>
    noList && picked
      ? {
          name: name.trim(),
          warband_type_id: picked.type.id,
          no_list: true,
          budget: budgetGc ?? Number(BUDGET),
          max_units: mostWarriors ?? Number(MOST_WARRIORS),
        }
      : listBody();
  const listBody = (): MakeWarbandBody => ({
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
    setBudget(BUDGET);
    setMost(MOST_WARRIORS);
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
    budget,
    setBudget,
    most,
    setMost,
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
