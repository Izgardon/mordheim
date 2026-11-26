/** An item's card names its setting, Mordheim's grades as one, and nothing else. */
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { OwnWordsContext, WORKSHOP_WORDS } from "@/features/reference/own-words";
import { makeItem } from "@/test/warband-fixtures";

import WargearDetail, { sourceLine } from "./WargearDetail";

const OWN = "This campaign's own";

describe("an item's Source line", () => {
  it("is the setting alone, whatever the source text says", () => {
    const item = makeItem({ source: "Khemri setting, Town Cryer #18", availabilities: [] });

    expect(sourceLine(item, "Khemri", OWN)).toBe("Khemri");
  });

  it("does not repeat who may buy it, which the price rows already say", () => {
    const item = makeItem({ source: "Town Cryer #9" });

    expect(sourceLine(item, "Mordheim", OWN)).toBe("Mordheim");
  });

  it("calls an entry with no setting the campaign's own", () => {
    const own = makeItem({ source: "", campaign_id: 3, availabilities: [] });

    expect(sourceLine(own, "", OWN)).toBe(OWN);
  });
});

describe("an item's card", () => {
  const own = makeItem({ source: "", campaign_id: 3, availabilities: [] });
  const card = (wrap: (node: ReactNode) => ReactNode = (node) => node) =>
    render(
      <MemoryRouter>
        {wrap(
          <WargearDetail
            item={own}
            offer={undefined}
            warning=""
            settingName=""
            campaignId={3}
            isMobile={false}
            canBuy={false}
            canEdit={false}
            canDelete={false}
            onGet={vi.fn()}
            onSaved={vi.fn()}
            onDeleted={vi.fn()}
          />
        )}
      </MemoryRouter>
    );

  it("names a campaign's own item its own", () => {
    card();

    expect(screen.getByText(OWN)).toBeInTheDocument();
  });

  it("names a workshop's own item the player's own (William, 26 Nov 2026)", () => {
    card((node) => (
      <OwnWordsContext.Provider value={WORKSHOP_WORDS}>{node}</OwnWordsContext.Provider>
    ));

    expect(screen.getByText("Your own")).toBeInTheDocument();
    expect(screen.queryByText(OWN)).toBeNull();
  });
});
