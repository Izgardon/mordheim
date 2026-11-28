import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RegisterSWOptions } from "vite-plugin-pwa/types";

const { registerSW, updateServiceWorker, toast } = vi.hoisted(() => {
  const updateServiceWorker = vi.fn(async () => undefined);
  const toast = Object.assign(vi.fn(), { dismiss: vi.fn() });
  return {
    registerSW: vi.fn((_options: RegisterSWOptions) => updateServiceWorker),
    updateServiceWorker,
    toast,
  };
});
vi.mock("virtual:pwa-register", () => ({ registerSW }));
vi.mock("sonner", () => ({ toast }));

import {
  checkForUpdates,
  createUpdateNotice,
  registerServiceWorker,
  UPDATE_CHECK_MS,
  UPDATE_NOTICE_ID,
} from "./register-sw";

type ToastOptions = {
  id: string;
  duration: number;
  action: { label: string; onClick: () => void };
  onDismiss: () => void;
};
const lastToast = () => toast.mock.lastCall as unknown as [string, ToastOptions];

const setOnline = (online: boolean) => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  window.dispatchEvent(new Event(online ? "online" : "offline"));
};

describe("the update notice", () => {
  let listening: AbortController;
  beforeEach(() => {
    listening = new AbortController();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });
  afterEach(() => {
    listening.abort();
    vi.restoreAllMocks();
    toast.mockClear();
    toast.dismiss.mockClear();
  });

  it("says a new version is ready, with Reload, and stays until the player acts", () => {
    const reload = vi.fn();
    createUpdateNotice(reload, listening.signal).waiting();

    const [words, options] = lastToast();
    expect(words).toBe("A new version is ready.");
    expect(options).toMatchObject({ id: UPDATE_NOTICE_ID, duration: Infinity });
    expect(options.action.label).toBe("Reload");
    expect(reload).not.toHaveBeenCalled();

    options.action.onClick();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows nothing until a new version is waiting", () => {
    createUpdateNotice(vi.fn(), listening.signal);
    setOnline(false);
    setOnline(true);

    expect(toast).not.toHaveBeenCalled();
  });

  it("hides offline, where a reload would open the new build with none of the saved reads, and comes back online", () => {
    const notice = createUpdateNotice(vi.fn(), listening.signal);
    setOnline(false);
    notice.waiting();
    expect(toast).not.toHaveBeenCalled();

    setOnline(true);
    const [words, options] = lastToast();
    expect(words).toBe("A new version is ready.");

    toast.mockClear();
    setOnline(false);
    expect(toast.dismiss).toHaveBeenCalledWith(UPDATE_NOTICE_ID);
    options.onDismiss(); // sonner reports the dismissal afterwards
    setOnline(true);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("stays closed once the player closes it", () => {
    createUpdateNotice(vi.fn(), listening.signal).waiting();
    lastToast()[1].onDismiss(); // the close button or a swipe
    toast.mockClear();

    setOnline(false);
    setOnline(true);
    expect(toast).not.toHaveBeenCalled();
  });
});

describe("registering the worker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    registerSW.mockClear();
    updateServiceWorker.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    toast.mockClear();
  });

  const register = () => {
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ reload } as unknown as Location);
    registerServiceWorker();
    return { options: registerSW.mock.lastCall![0], reload };
  };

  it("never reloads by itself when a new version is waiting or another window takes it", () => {
    const { options, reload } = register();

    options.onNeedRefresh!();
    expect(lastToast()[0]).toBe("A new version is ready.");
    options.onNeedReload!(); // the new worker took over: another window's Reload
    vi.advanceTimersByTime(60_000);

    expect(reload).not.toHaveBeenCalled();
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it("on Reload, moves to the new version and reloads once it has taken over", () => {
    const { options, reload } = register();
    options.onNeedRefresh!();

    lastToast()[1].action.onClick();
    expect(updateServiceWorker).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();

    options.onNeedReload!();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("on Reload, reloads anyway when the new version doesn't take over", () => {
    const { options, reload } = register();
    options.onNeedRefresh!();

    lastToast()[1].action.onClick();
    vi.advanceTimersByTime(3_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe("checking for a new version", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const registration = () =>
    ({
      installing: null,
      update: vi.fn(async () => undefined),
    }) as unknown as ServiceWorkerRegistration & {
      update: ReturnType<typeof vi.fn>;
    };

  it("asks every hour, whenever the app comes to the front and when the signal returns, while online", () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const worker = registration();
    checkForUpdates(worker);

    vi.advanceTimersByTime(UPDATE_CHECK_MS);
    expect(worker.update).toHaveBeenCalledTimes(1);

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(worker.update).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new Event("online"));
    expect(worker.update).toHaveBeenCalledTimes(3);

    online.mockReturnValue(false);
    vi.advanceTimersByTime(UPDATE_CHECK_MS);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(worker.update).toHaveBeenCalledTimes(3);
  });
});
