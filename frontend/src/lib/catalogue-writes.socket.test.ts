/**
 * Catalogue writes name this browser's socket (`X-Pusher-Socket-Id`), so the server leaves the
 * writer out of the `catalogue.changed` it sends (the step 2 browser check's found item 1): the
 * writer already has its answer in the cache, and the echo re-read its list and, after a Revert or
 * a delete, the entry it had just reverted or deleted (a 404). Every kind the catalogue writes:
 * the bestiary, items and item properties, skills, spells, specials, races, hired swords and
 * dramatis personae, with Revert, delete and restore. Reads send no header.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createBestiaryEntry, updateBestiaryEntry } from "@/features/bestiary/api/bestiary-api";
import {
  deleteEntry,
  restoreEntry,
  revertEntry,
} from "@/features/catalogue/api/catalogue-entry-api";
import {
  createHirelingProfile,
  getHirelingProfile,
  updateHirelingProfile,
} from "@/features/hirelings/api/hireling-catalogue-api";
import {
  createItem,
  createItemProperty,
  listItems,
  updateItem,
} from "@/features/items/api/items-api";
import { createRace } from "@/features/races/api/races-api";
import { createSkill, updateSkill } from "@/features/skills/api/skills-api";
import { createSpecial } from "@/features/special/api/special-api";
import { createSpell, updateSpell } from "@/features/spells/api/spells-api";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(async () => ({})),
  socketId: null as string | null,
}));

vi.mock("@/lib/api-client", () => ({ apiRequest: mocks.apiRequest }));
vi.mock("@/lib/realtime/client", () => ({ realtimeSocketId: () => mocks.socketId }));

const headersOfLastCall = () => {
  const calls = mocks.apiRequest.mock.calls as unknown as [string, { headers?: unknown }?][];
  return calls[calls.length - 1][1]?.headers;
};

const body = {} as never;
const entry = { id: 5, campaign_id: null };

const WRITES: [string, () => Promise<unknown>][] = [
  ["create a beast", () => createBestiaryEntry(body)],
  ["edit a beast", () => updateBestiaryEntry(5, body)],
  ["create an item", () => createItem(body)],
  ["edit an item", () => updateItem(5, body)],
  ["create an item property", () => createItemProperty(body)],
  ["create a skill", () => createSkill(body)],
  ["edit a skill", () => updateSkill(5, body)],
  ["create a spell", () => createSpell(body)],
  ["edit a spell", () => updateSpell(5, body)],
  ["create a special", () => createSpecial(body)],
  ["create a race", () => createRace(body)],
  ["create a hired sword", () => createHirelingProfile("hired-swords", body)],
  ["edit a dramatis persona", () => updateHirelingProfile("dramatis-personae", 5, body)],
  ["revert a version", () => revertEntry("bestiary", entry, 1)],
  ["delete an entry", () => deleteEntry("items", entry, 1)],
  ["restore an entry", () => restoreEntry("skills", entry, 1)],
];

describe("catalogue writes name this browser's socket", () => {
  beforeEach(() => {
    mocks.apiRequest.mockClear();
    mocks.socketId = "123.456";
  });

  it.each(WRITES)("sends X-Pusher-Socket-Id to %s", async (_name, write) => {
    await write();

    expect(headersOfLastCall()).toEqual({ "X-Pusher-Socket-Id": "123.456" });
  });

  it("sends no header before the realtime connection has a socket, and none on reads", async () => {
    mocks.socketId = null;
    await createSkill(body);
    expect(headersOfLastCall()).toBeUndefined();

    mocks.socketId = "123.456";
    await listItems({ campaignId: 1 });
    expect(headersOfLastCall()).toBeUndefined();
    await getHirelingProfile("hired-swords", 5);
    expect(headersOfLastCall()).toBeUndefined();
  });
});
