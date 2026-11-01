/**
 * The swords (William, 1 Nov 2026): only at a slow boot and on entering a battle. Boot shows the
 * plain page first and the swords only once it passes BOOT_SWORDS_DELAY_MS; the strike's CSS
 * length comes from SWORD_CLASH_MS, the constant the battle's entrance waits on.
 */
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BootScreen, SwordsScreen } from "./loading-screen";
import { BOOT_SWORDS_DELAY_MS, SWORD_CLASH_MS } from "./sword-clash";

describe("SwordsScreen", () => {
  it("draws the swords inline, timed by SWORD_CLASH_MS, with no caption and no external assets", () => {
    const { container } = render(<SwordsScreen label="Entering the battle" />);

    const status = screen.getByRole("status", { name: "Entering the battle" });
    expect(status).toHaveTextContent("");
    const svg = container.querySelector("svg.sword-clash") as SVGElement;
    expect(svg.style.getPropertyValue("--sword-clash-ms")).toBe(`${SWORD_CLASH_MS}ms`);
    // The old Lottie player fetched its animation and WASM from third-party CDNs.
    expect(container.querySelector("canvas, img, iframe, object")).toBeNull();
  });
});

describe("BootScreen", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is the plain page at first, and brings the swords in only when boot is slow", () => {
    const { container } = render(<BootScreen />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();

    act(() => vi.advanceTimersByTime(BOOT_SWORDS_DELAY_MS - 1));
    expect(container.querySelector("svg")).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector("svg.sword-clash")).not.toBeNull();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});
