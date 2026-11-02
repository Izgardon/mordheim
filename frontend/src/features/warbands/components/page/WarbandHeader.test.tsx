/**
 * The warband header's ⋯ menu carries the phone's way to the Encampment page, now the Me sheet
 * lists only Settings and Account.
 */
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { setupUser } from "@/test/user-event";
import WarbandHeader from "./WarbandHeader";

function renderHeader(showEncampment: boolean) {
  const router = createMemoryRouter(
    [
      {
        path: "/campaigns/:id/warband",
        element: (
          <WarbandHeader
            kicker="Reiklanders"
            name="Iron Vultures"
            stashCount={0}
            showLocations
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
    await user.click(await screen.findByRole("menuitem", { name: "Encampment" }));

    expect(await screen.findByText("Encampment page")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/campaigns/3/encampments");
  });

  it("is not in the menu when the page asks for none", async () => {
    const user = setupUser();
    renderHeader(false);

    await user.click(screen.getByRole("button", { name: "More warband actions" }));

    expect(await screen.findByRole("menuitem", { name: "Rating breakdown" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Encampment" })).toBeNull();
  });
});
