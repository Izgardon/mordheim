import { getWarbandSummary, updateWarband } from "@/features/warbands/api/warbands-api";
import { unitApi, type UnitBatch } from "@/features/warbands/units/unit-api";
import {
  commitPendingPurchases,
  type PendingPurchase,
} from "@/features/warbands/utils/pending-purchases";

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
  /** Heroes only: the name and faction to save first, when they changed. */
  header?: { warband: Warband; name: string; faction: string };
};

export type SectionWriteResult<K extends UnitKindKey> = {
  /** Every unit of the kind after the batch; null when nothing needed one. */
  units: Unit<K>[] | null;
  updatedWarband?: Warband;
  summary: WarbandUnitsSummary | null;
};

/** The batch body for a Save, leaving out empty parts. */
export function buildBatch<K extends UnitKindKey>(
  kind: UnitKindConfig<K>,
  input: Pick<SectionWrite<K>, "createForms" | "updateForms" | "dismissIds">
): UnitBatch<K> | null {
  const batch: UnitBatch<K> = {};
  if (input.createForms.length > 0) {
    batch.create = input.createForms.map((form) =>
      kind.buildPayload(form, { isSessionCreated: true })
    );
  }
  if (input.updateForms.length > 0) {
    batch.update = input.updateForms.map((form) => ({
      id: form.id as number,
      ...kind.buildPayload(form, { isSessionCreated: false }),
    }));
  }
  if (input.dismissIds.length > 0) {
    batch.dismiss = input.dismissIds;
  }
  return Object.keys(batch).length > 0 ? batch : null;
}

/**
 * One section's Save: the warband header (heroes), then one all-or-nothing batch of the queued
 * recruits, the changed units and the dismissals (decision 1), the kind's extra writes, the
 * queued purchases one by one, and a summary GET only when those came after the batch.
 */
export async function writeSection<K extends UnitKindKey>(
  kind: UnitKindConfig<K>,
  input: SectionWrite<K>
): Promise<SectionWriteResult<K>> {
  const { warbandId, forms, header, purchases } = input;
  const updatedWarband =
    header && (header.name !== header.warband.name || header.faction !== header.warband.faction)
      ? await updateWarband(header.warband.id, { name: header.name, faction: header.faction })
      : header?.warband;

  const batch = buildBatch(kind, input);
  const result = batch ? await unitApi(kind.key).batch(warbandId, batch) : null;

  const extraWrites = (await kind.editor.afterSaveWrites?.(warbandId, forms)) ?? 0;

  if (purchases.length > 0) {
    await commitPendingPurchases(warbandId, purchases, (entry) => {
      const match = forms.find((form) => String(form.id ?? form.draftKey) === entry.unitId);
      return match?.name?.trim() || kind.labels.unknownName;
    });
  }

  const summary =
    extraWrites > 0 || purchases.length > 0
      ? await getWarbandSummary(warbandId)
      : (result?.summary ?? null);
  return { units: result?.units ?? null, updatedWarband, summary };
}
