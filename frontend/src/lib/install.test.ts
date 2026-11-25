/** Installing the app (William, 25 Nov 2026): Android's prompt kept for Account, an iPhone told how. */
import { afterEach, describe, expect, it, vi } from "vitest";

import manifest from "../../public/manifest.webmanifest?raw";
import indexHtml from "../../index.html?raw";

const fresh = async () => {
  vi.resetModules();
  return import("./install");
};

afterEach(() => vi.restoreAllMocks());

describe("installing the app", () => {
  it("keeps Android's prompt and shows it when asked", async () => {
    const install = await fresh();
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(install.installState()).toBe("prompt");
    await expect(install.promptInstall()).resolves.toBe(true);
    expect(prompt).toHaveBeenCalled();
  });

  it("tells an iPhone in Safari how, and nothing once installed", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1"
    );
    const install = await fresh();
    expect(install.installState()).toBe("ios");

    window.dispatchEvent(new Event("appinstalled"));
    expect(install.installState()).toBe("installed");
  });

  it("ships a manifest a phone can install from, linked from the page", () => {
    const parsed = JSON.parse(manifest);
    expect(parsed.display).toBe("standalone");
    expect(parsed.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"])
    );
    expect(parsed.icons.some((icon: { purpose: string }) => icon.purpose === "maskable")).toBe(
      true
    );
    expect(indexHtml).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(indexHtml).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(indexHtml).toContain("viewport-fit=cover");
  });
});
