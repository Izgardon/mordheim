/**
 * The overview's Chronicle (William, 1 Nov 2026): on the web its entries scroll inside their own
 * box under the filter chips, so the page stays short; a phone's Chronicle tab lets the page
 * scroll as before.
 */
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { CampaignChronicleEntry } from "../../types/campaign-types";
import Chronicle from "./Chronicle";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const entries: CampaignChronicleEntry[] = Array.from({ length: 12 }, (_, index) => ({
  kind: index % 2 ? "kill" : "buy",
  text: `Entry ${index + 1}`,
  meta: "Ashen Crows",
  at: `2026-11-01T10:${String(index).padStart(2, "0")}:00Z`,
}));

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /campaigns/7/chronicle/", entries);
  fakeApi.on("GET /campaigns/7/chronicle/?kind=kill", entries.slice(0, 3));
});

describe("Chronicle", () => {
  it("scrolls its entries inside a box on the web, the filters outside it", async () => {
    renderWithQueryClient(<Chronicle campaignId={7} isMobile={false} />);

    const list = await screen.findByRole("list", { name: "Chronicle entries" });
    expect(list).toHaveClass("overflow-y-auto");
    expect(list.className).toMatch(/max-h-\[\d+px\]/);
    // focusable, so the keyboard can scroll it
    expect(list).toHaveAttribute("tabindex", "0");
    expect(list).not.toContainElement(screen.getByRole("button", { name: "Kills" }));
    expect(screen.getByRole("heading", { name: "Chronicle" })).toBeInTheDocument();
  });

  it("starts a new filter's entries at the top of the box", async () => {
    const user = setupUser();
    renderWithQueryClient(<Chronicle campaignId={7} isMobile={false} />);
    const before = await screen.findByRole("list", { name: "Chronicle entries" });

    await user.click(screen.getByRole("button", { name: "Kills" }));

    expect(await screen.findAllByRole("listitem")).toHaveLength(3);
    // a new list element, so its scroll position starts at 0
    expect(screen.getByRole("list", { name: "Chronicle entries" })).not.toBe(before);
  });

  it("lets the page scroll on a phone", async () => {
    renderWithQueryClient(<Chronicle campaignId={7} isMobile heading={false} />);

    const list = await screen.findByRole("list", { name: "Chronicle entries" });
    expect(list).not.toHaveClass("overflow-y-auto");
    expect(list).not.toHaveAttribute("tabindex");
  });
});
