import { updateWarband } from "@/features/warbands/api/warbands-api";
import { unitApi, type BatchItemTarget, type UnitBatch } from "@/features/warbands/units/unit-api";

import type { PurchaseWarning } from "@/features/items/api/purchase";
import type { PendingPurchase } from "@/features/warbands/utils/pending-purchases";

import type { Unit, UnitForm, UnitKindKey } from "../../types/units";
import type { Warband, WarbandUnitsSummary } from "../../types/warband-types";
import type { UnitKindConfig } from "../../units/unit-kind-types";

export type SectionWrite<K extends UnitKindKey> = {
  warbandId: number;
  forms: UnitForm<K>[];
  /** Queued recruits, created by the batch in this order (`create.N`). */
  createForms: UnitForm<K>[];
  /** Existing units whose form changed, updated in this order (`update.N`). */
  updateForms: UnitForm<K>[];
  dismissIds: number[];
  purchases: PendingPurchase[];
  /** Each saved unit's `updated_at` when the edit began, sent with its update. */
  versions?: ReadonlyMap<number, string>;
  /** Heroes only: the name and faction to save first, when they changed. */
  header?: { warband: Warband; name: string; faction: string };
};

export type SectionWriteResult<K extends UnitKindKey> = {
  /** Every unit of the kind after the batch; null when nothing needed one. */
  units: Unit<K>[] | null;
  updatedWarband?: Warband;
  /** The batch's summary (null without a batch). */
  summary: WarbandUnitsSummary | null;
  /** What the server warned about while the purchases went ahead (overspend, spent searcher). */
  warnings: PurchaseWarning[];
  /** The batch bought or took items, so the stash, ledger and logs changed too. */
  movedItems: boolean;
};

/** Copies per item id. */
type Copies = Map<number, number>;

const unitKeyOf = (form: UnitForm) => String(form.id ?? form.draftKey);

/** The list without `copies` (the last ones of each item): the batch's lines add those. */
const withoutCopies = <T extends { id: number }>(items: T[], copies: Copies) => {
  const left = new Map(copies);
  const kept: T[] = [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const due = left.get(items[index].id) ?? 0;
    if (due > 0) {
      left.set(items[index].id, due - 1);
    } else {
      kept.unshift(items[index]);
    }
  }
  return kept;
};

/** A purchase's or stash take's unit: a queued recruit by its place in `create`, or a saved one. */
const targetOf = (unitKey: string, createForms: UnitForm[]): BatchItemTarget => {
  const index = createForms.findIndex((form) => unitKeyOf(form) === unitKey);
  return index >= 0 ? { create_index: index } : { unit_id: Number(unitKey) };
};

/**
 * The batch body for a Save, leaving out empty parts. Queued purchases and stash takes go in as
 * lines (decision 1, BUG-07, BUG-108); their copies, which the forms show, leave `items` because
 * the server appends them.
 */
export function buildBatch<K extends UnitKindKey>(
  kind: UnitKindConfig<K>,
  input: Pick<
    SectionWrite<K>,
    "forms" | "createForms" | "updateForms" | "dismissIds" | "purchases" | "versions"
  >
): UnitBatch<K> | null {
  const takes = kind.editor.stashTakes?.(input.forms) ?? [];
  const copiesByUnit = new Map<string, Copies>();
  const addCopies = (unitKey: string, itemId: number, quantity: number) => {
    const copies = copiesByUnit.get(unitKey) ?? new Map<number, number>();
    copies.set(itemId, (copies.get(itemId) ?? 0) + quantity);
    copiesByUnit.set(unitKey, copies);
  };
  input.purchases.forEach((entry) => addCopies(entry.unitId, entry.itemId, entry.quantity));
  takes.forEach((take) => addCopies(String(take.unitId), take.itemId, take.quantity));
  const payloadOf = (form: UnitForm<K>, isSessionCreated: boolean) => {
    const payload = kind.buildPayload(form, { isSessionCreated });
    const copies = copiesByUnit.get(unitKeyOf(form));
    return copies && payload.items
      ? { ...payload, items: withoutCopies(payload.items, copies) }
      : payload;
  };

  const batch: UnitBatch<K> = {};
  if (input.createForms.length > 0) {
    batch.create = input.createForms.map((form) => payloadOf(form, true));
  }
  if (input.updateForms.length > 0) {
    batch.update = input.updateForms.map((form) => {
      const version = input.versions?.get(form.id as number);
      return {
        id: form.id as number,
        ...payloadOf(form, false),
        ...(version ? { updated_at: version } : {}),
      };
    });
  }
  if (input.dismissIds.length > 0) {
    batch.dismiss = input.dismissIds;
  }
  if (input.purchases.length > 0) {
    batch.purchases = input.purchases.map((entry) => ({
      ...targetOf(entry.unitId, input.createForms),
      ...entry.line,
      quantity: entry.quantity,
    }));
  }
  if (takes.length > 0) {
    batch.stash_takes = takes.map((take) => ({
      unit_id: take.unitId,
      item_id: take.itemId,
      quantity: take.quantity,
    }));
  }
  return Object.keys(batch).length > 0 ? batch : null;
}

/**
 * One section's Save (decision 1): the warband header (heroes), then one all-or-nothing batch
 * with the queued recruits, the changed units, the dismissals, the purchases and the stash takes.
 */
export async function writeSection<K extends UnitKindKey>(
  kind: UnitKindConfig<K>,
  input: SectionWrite<K>
): Promise<SectionWriteResult<K>> {
  const { warbandId, header } = input;
  const updatedWarband =
    header && (header.name !== header.warband.name || header.faction !== header.warband.faction)
      ? await updateWarband(header.warband.id, { name: header.name, faction: header.faction })
      : header?.warband;

  const batch = buildBatch(kind, input);
  const result = batch ? await unitApi(kind.key).batch(warbandId, batch) : null;
  return {
    units: result?.units ?? null,
    updatedWarband,
    summary: result?.summary ?? null,
    warnings: result?.warnings ?? [],
    movedItems: Boolean(batch?.purchases || batch?.stash_takes),
  };
}
