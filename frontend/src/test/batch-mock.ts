/**
 * Helpers for tests of a section's Save, which sends one `POST .../<kind>/batch/` (decision 1).
 * Point a batch mock at `answerBatch(roster)` and read what it was sent with the getters.
 */
import type { Mock } from "vitest";

type Entry = Record<string, unknown>;
export type BatchBody = {
  create?: Entry[];
  update?: (Entry & { id: number })[];
  dismiss?: number[];
};

const lastBatch = (mock: Mock): BatchBody | undefined =>
  mock.mock.calls[mock.mock.calls.length - 1]?.[1];

export const batchCreates = (mock: Mock) => lastBatch(mock)?.create ?? [];
export const batchUpdates = (mock: Mock) => lastBatch(mock)?.update ?? [];
export const batchDismissals = (mock: Mock) => lastBatch(mock)?.dismiss ?? [];

/** One unit's update entry in the last batch, without its id. */
export const batchUpdate = (mock: Mock, id: number) => {
  const entry = batchUpdates(mock).find((candidate) => candidate.id === id);
  if (!entry) return undefined;
  const { id: _id, ...body } = entry;
  return body;
};

/** Answers like the server: the roster with the batch applied (new units get ids from 900). */
export const answerBatch =
  <U extends { id: number }>(roster: U[], summary: Entry = {}) =>
  async (_warbandId: number, body: BatchBody) => ({
    units: [
      ...roster
        .filter((unit) => !body.dismiss?.includes(unit.id))
        .map((unit) => ({
          ...unit,
          ...(body.update?.find((entry) => entry.id === unit.id) ?? {}),
        })),
      ...(body.create ?? []).map((entry, index) => ({ id: 900 + index, ...entry })),
    ],
    summary,
  });
