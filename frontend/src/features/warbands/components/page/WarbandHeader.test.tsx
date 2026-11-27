/**
 * The warband header's ⋯ menu carries the phone's way to the Encampment page, now the Settings
 * sheet lists only the campaign's settings and Account. On a phone ⋯ sits on Store and Stash's
 * row (William, 27 Nov 2026), Trade locations under them.
 */
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupUser } from "@/test/user-event";
import WarbandHeader from "./WarbandHeader";

const media = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => media.mobile }));

beforeEach(() => {
  media.mobile = false;
});

function renderHeader(showEncampment: boolean, showLocations = true) {
  const router = createMemoryRouter(
    [
      {
        path: "/campaigns/:id/warband",
        element: (
          <WarbandHeader
            kicker="Reiklanders"
            name="Iron Vultures"
            stashCount={0}
            showLocations={showLocations}
            showEncampment={showEncampment}
            onOpen={() => undefined}
            menu={[{ label: "Rating breakdown", onSelect: () => undefined }]}
          />
        ),
      },
      { path: "/campaigns/:id/encampments", element: <p>Encampment page</p> },
    ],
    { initialEntries: ["/campaigns/3/warband"] }
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("WarbandHeader's Encampment", () => {
  it("opens the campaign's Encampment page from the ⋯ menu", async () => {
    const user = setupUser();
    const router = renderHeader(true);

    await user.click(screen.getByRole("button", { name: "More warband actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Encampments" }));

    expect(await screen.findByText("Encampment page")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/campaigns/3/encampments");
  });

  it("is not in the menu when the page asks for none", async () => {
    const user = setupUser();
    renderHeader(false);

    await user.click(screen.getByRole("button", { name: "More warband actions" }));

    expect(await screen.findByRole("menuitem", { name: "Rating breakdown" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Encampments" })).toBeNull();
  });
});

describe("WarbandHeader's buttons", () => {
  const button = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

  it("puts ⋯ on Store and Stash's row on a phone, Trade locations under them", () => {
    media.mobile = true;
    renderHeader(false);

    const row = button("Store").parentElement;
    expect(button("Stash").parentElement).toBe(row);
    expect(button("More warband actions").parentElement).toBe(row);
    expect(row?.children).toHaveLength(3);
    expect(button("Trade locations").parentElement).not.toBe(row);
  });

  it("keeps the row of three without Trade locations", () => {
    media.mobile = true;
    renderHeader(false, false);

    const row = button("Store").parentElement;
    expect(button("More warband actions").parentElement).toBe(row);
    expect(screen.queryByRole("button", { name: /^Trade locations/ })).toBeNull();
  });

  it("keeps one line on the web, ⋯ after Trade locations", () => {
    renderHeader(false);

    const line = button("Store").parentElement;
    const names = Array.from(line?.querySelectorAll(":scope > button") ?? []).map(
      (element) => element.textContent || element.getAttribute("aria-label")
    );
    expect(names).toEqual(["Store", "Stash", "Trade locations", "More warband actions"]);
  });
});
