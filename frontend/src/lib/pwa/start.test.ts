import { afterEach, describe, expect, it, vi } from "vitest";

import { startServiceWorker } from "./start";

describe("startServiceWorker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const loader = () => {
    const registerServiceWorker = vi.fn();
    return { load: vi.fn(async () => ({ registerServiceWorker })), registerServiceWorker };
  };

  it("registers nothing outside a production build (npm run dev, the tests)", () => {
    vi.stubGlobal("navigator", { ...navigator, serviceWorker: {} });
    const { load } = loader();

    startServiceWorker(import.meta.env.PROD, load);
    startServiceWorker(false, load);

    expect(load).not.toHaveBeenCalled();
  });

  it("registers nothing where the browser has no service workers", () => {
    const { load } = loader();

    startServiceWorker(true, load);

    expect("serviceWorker" in navigator).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it("loads the registration after the page in a production build", async () => {
    vi.stubGlobal("navigator", { ...navigator, serviceWorker: {} });
    const { load, registerServiceWorker } = loader();

    startServiceWorker(true, load);

    await vi.waitFor(() => expect(registerServiceWorker).toHaveBeenCalledTimes(1));
  });

  it("carries on when its code didn't download", async () => {
    vi.stubGlobal("navigator", { ...navigator, serviceWorker: {} });
    const load = vi.fn(async () => {
      throw new TypeError("Failed to fetch dynamically imported module");
    });

    expect(() => startServiceWorker(true, load)).not.toThrow();
    await vi.waitFor(() => expect(load).toHaveBeenCalled());
  });
});
