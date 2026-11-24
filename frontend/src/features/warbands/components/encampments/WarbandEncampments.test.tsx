import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { setupUser } from "@/test/user-event";

import WarbandEncampments from "./WarbandEncampments";

function Where() {
  const location = useLocation();
  return <p>{`${location.pathname}${location.search}`}</p>;
}

describe("WarbandEncampments", () => {
  it("opens what the warband holds on the Encampments page", async () => {
    const user = setupUser();
    render(
      <MemoryRouter initialEntries={["/campaigns/7/warband"]}>
        <Routes>
          <Route
            path="/campaigns/7/warband"
            element={
              <WarbandEncampments
                campaignId={7}
                encampments={[{ id: 5, name: "Tavern", fortified: false }]}
              />
            }
          />
          <Route path="/campaigns/7/encampments" element={<Where />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Tavern" }));

    expect(screen.getByText("/campaigns/7/encampments?open=5")).toBeInTheDocument();
  });

  it("is left out when it holds none", () => {
    render(
      <MemoryRouter>
        <WarbandEncampments campaignId={7} encampments={[]} />
      </MemoryRouter>
    );
    expect(screen.queryByRole("region", { name: "Encampments" })).toBeNull();
  });
});
