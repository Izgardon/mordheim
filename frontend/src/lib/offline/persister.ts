import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { createStore, del, get, set, type UseStore } from "idb-keyval";

import { getTokenUserId } from "@/features/auth/utils/token-user";
import { session } from "@/lib/session";

/** What the phone holds: the kept reads, and whose they are. */
export type SavedReads = { userId: string; client: PersistedClient };

export type OfflinePersister = Persister & {
  /** Writes a save still waiting for its turn now (the app going to the background). */
  flush: () => Promise<void>;
};

const KEY = "query-cache";
/** At most one write every two seconds: a battle's taps change the cache often. */
const WRITE_EVERY_MS = 2_000;
/** A phone whose storage doesn't answer opens without what it saved, never behind a spinner. */
const RESTORE_TIMEOUT_MS = 3_000;

/** The signed-in account, from the stored token (so a restore before the profile loads knows it). */
function signedInUserId() {
  const token = session.accessToken();
  return token ? getTokenUserId(token) : null;
}

function hasIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T | undefined>((resolve, reject) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * An installed app on an iPhone or Android asks once for its storage to be kept under storage
 * pressure (WebKit grants it by judgement). Not in a browser tab, where Firefox would ask the player.
 */
let askedToKeep = false;
function askToKeepStorage() {
  if (askedToKeep) return;
  askedToKeep = true;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) void navigator.storage?.persist?.().catch(() => false);
}

/**
 * The kept reads in IndexedDB (`idb-keyval`, stored as objects, not JSON text), under the account
 * that read them: a restore for anyone else throws them away (BUG-22's shared phones). A save is
 * the account's at the moment the cache was read for it; with nobody signed in nothing is written.
 */
export function createOfflinePersister({
  store = () => createStore("mordheim-offline", "reads"),
  userId = signedInUserId,
  writeEveryMs = WRITE_EVERY_MS,
}: {
  store?: () => UseStore;
  userId?: () => string | null;
  writeEveryMs?: number;
} = {}): OfflinePersister {
  let idb: UseStore | null = null;
  const db = () => (idb ??= store());
  let pending: SavedReads | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };

  const flush = async () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const saved = pending;
    pending = null;
    if (!saved || !hasIndexedDb()) return;
    try {
      await set(KEY, saved, db());
      askToKeepStorage();
    } catch {
      // Out of space, or storage refused: the app still runs on what it reads.
    }
  };

  const removeClient = async () => {
    cancel();
    if (!hasIndexedDb()) return;
    try {
      await del(KEY, db());
    } catch {
      // Nothing to remove, or storage refused.
    }
  };

  return {
    persistClient(client) {
      const id = userId();
      if (!id) {
        cancel();
        return;
      }
      pending = { userId: id, client };
      timer ??= setTimeout(() => void flush(), writeEveryMs);
    },

    async restoreClient() {
      if (!hasIndexedDb()) return undefined;
      const saved = await withTimeout(get<SavedReads>(KEY, db()), RESTORE_TIMEOUT_MS);
      if (!saved) return undefined;
      if (saved.userId !== userId()) {
        await removeClient();
        return undefined;
      }
      return saved.client;
    },

    removeClient,
    flush,
  };
}

/** The app's persister, made on first use. */
let appPersister: OfflinePersister | null = null;
export function offlinePersister() {
  return (appPersister ??= createOfflinePersister());
}

/** Signed out or another account: what this phone kept goes, with any save still waiting. */
export function wipeOfflineReads() {
  return offlinePersister().removeClient();
}
