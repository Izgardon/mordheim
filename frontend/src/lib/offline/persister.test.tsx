import "fake-indexeddb/auto";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import {
  PersistQueryClientProvider,
  persistQueryClientRestore,
  persistQueryClientSave,
} from "@tanstack/react-query-persist-client";
import { render, screen } from "@testing-library/react";
import { createStore, get, set } from "idb-keyval";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { offlinePersistOptions } from "./persist-options";
import { createOfflinePersister, type SavedReads } from "./persister";

const SHEET = queryKeys.campaign.warbandSheet(1, 9);
const MEMBERS = queryKeys.campaign.members(1);

let storeCount = 0;
const clients: QueryClient[] = [];

/** One phone: its own IndexedDB store, and whoever is signed in on it. */
function phone(signedIn: { id: string | null } = { id: "7" }, writeEveryMs = 2_000) {
  const store = createStore(`mordheim-offline-test-${(storeCount += 1)}`, "reads");
  const persister = createOfflinePersister({
    store: () => store,
    userId: () => signedIn.id,
    writeEveryMs,
  });
  return { store, persister, signedIn, saved: () => get<SavedReads>("query-cache", store) };
}

function client() {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  return queryClient;
}

afterEach(() => {
  clients.splice(0).forEach((queryClient) => queryClient.clear());
});

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function save(device: ReturnType<typeof phone>, queryClient: QueryClient, buildId = "b1") {
  await persistQueryClientSave({
    queryClient,
    ...offlinePersistOptions(queryClient, { persister: device.persister, buildId }),
  });
  await device.persister.flush();
}

async function restore(device: ReturnType<typeof phone>, queryClient: QueryClient, buildId = "b1") {
  await persistQueryClientRestore({
    queryClient,
    ...offlinePersistOptions(queryClient, { persister: device.persister, buildId }),
  });
}

describe("what is written to the phone", () => {
  it("writes only the kept reads, under the account that read them", async () => {
    const device = phone();
    const queryClient = client();
    queryClient.setQueryData(SHEET, { id: 9, name: "The Ashen Crows" });
    queryClient.setQueryData(MEMBERS, [{ email: "rival@example.com" }]);

    await save(device, queryClient);

    const saved = await device.saved();
    expect(saved?.userId).toBe("7");
    expect(saved?.client.buster).toBe("b1");
    expect(saved?.client.clientState.queries.map((query) => query.queryKey)).toEqual([SHEET]);
    expect(saved?.client.clientState.mutations).toEqual([]);
  });

  it("writes nothing with nobody signed in", async () => {
    const device = phone({ id: null });
    const queryClient = client();
    queryClient.setQueryData(SHEET, { id: 9 });

    await save(device, queryClient);

    expect(await device.saved()).toBeUndefined();
  });

  it("writes once a while has passed, the latest cache", async () => {
    const device = phone({ id: "7" }, 100);
    const stateWith = (timestamp: number) =>
      ({ buster: "b1", timestamp, clientState: { queries: [], mutations: [] } }) as never;

    device.persister.persistClient(stateWith(1));
    device.persister.persistClient(stateWith(2));
    expect(await device.saved()).toBeUndefined();

    await vi.waitFor(async () => expect((await device.saved())?.client.timestamp).toBe(2));
  });
});

describe("after a reload", () => {
  it("shows what the phone kept before anything is read", async () => {
    const device = phone();
    const before = client();
    before.setQueryData(SHEET, { id: 9, name: "The Ashen Crows" });
    await save(device, before);

    const after = client();
    function Sheet() {
      // With no signal the read never answers: the kept copy is what shows.
      const sheet = useQuery({ queryKey: SHEET, queryFn: () => new Promise<never>(() => {}) });
      return <p>{(sheet.data as { name: string } | undefined)?.name ?? "Loading"}</p>;
    }
    render(
      <PersistQueryClientProvider
        client={after}
        persistOptions={offlinePersistOptions(after, {
          persister: device.persister,
          buildId: "b1",
        })}
      >
        <Sheet />
      </PersistQueryClientProvider>
    );

    expect(await screen.findByText("The Ashen Crows")).toBeInTheDocument();
    // A restored read keeps its week in memory, so an hour unused doesn't drop it from the phone.
    expect(after.getQueryCache().find({ queryKey: SHEET })?.gcTime).toBe(7 * 24 * 60 * 60_000);
  });

  it("throws the kept reads away on a new build", async () => {
    const device = phone();
    const before = client();
    before.setQueryData(SHEET, { id: 9 });
    await save(device, before, "b1");

    const after = client();
    await restore(device, after, "b2");

    expect(after.getQueryData(SHEET)).toBeUndefined();
    expect(await device.saved()).toBeUndefined();
  });

  it("never gives one account's kept reads to another", async () => {
    const device = phone();
    const before = client();
    before.setQueryData(SHEET, { id: 9 });
    await save(device, before);

    device.signedIn.id = "8";
    const after = client();
    await restore(device, after);

    expect(after.getQueryData(SHEET)).toBeUndefined();
    expect(await device.saved()).toBeUndefined();
  });

  it("throws away what an old version saved in a shape it can't read", async () => {
    const device = phone();
    const broken = { buster: "b1", timestamp: Date.now(), clientState: { queries: "?" } };
    await set("query-cache", { userId: "7", client: broken }, device.store);

    // TanStack reports the bad copy on the console (outside production) as it throws it away.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const after = client();
    await expect(restore(device, after)).rejects.toBeTruthy();
    vi.restoreAllMocks();
    expect(await device.saved()).toBeUndefined();
  });
});

describe("signing out", () => {
  it("removes what the phone kept, and a save still waiting", async () => {
    const device = phone({ id: "7" }, 50);
    const queryClient = client();
    queryClient.setQueryData(SHEET, { id: 9 });
    await save(device, queryClient);
    await persistQueryClientSave({
      queryClient,
      ...offlinePersistOptions(queryClient, { persister: device.persister }),
    });

    await device.persister.removeClient();
    await pause(150);

    expect(await device.saved()).toBeUndefined();
  });
});
