/**
 * Where the Skills and Spells pages keep their search and type filter: in component state only,
 * so leaving the page and coming back clears both, and the URL never carries them (CAT-UX-05).
 * PR C keeps `type` and `q` in the query string (CAT-NEW-02).
 */
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { routeCampaignShell } from "@/test/campaign-fixtures";
import { routeCatalogue } from "@/test/catalogue-fixtures";
import { renderCatalogueRoute } from "@/test/catalogue-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { chooseOption } from "@/test/select-option";
import { setupUser } from "@/test/user-event";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 7, email: "aldric@example.com" }, signOut: () => undefined }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const currentPath = () => screen.getByLabelText("Current path");
const rowNamed = (name: string) => screen.queryByRole("row", { name: new RegExp(`^${name}`) });

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell();
  routeCatalogue();
});

describe("Skills: search and discipline filter", () => {
  // Characterises current behaviour (CAT-UX-05, CAT-NEW-02, pinned; flips in PR C)
  it("keeps them out of the URL and forgets them after a visit to Spells (CAT-UX-05, pinned; flips in PR C)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/skills");
    await screen.findByRole("row", { name: /^Quick Hands/ });

    await chooseOption(user, screen.getByText("All disciplines").closest("button")!, "Speed");
    await user.type(screen.getByRole("searchbox", { name: "Search skills" }), "quick");
    expect(rowNamed("Strike to Injure")).toBeNull();
    expect(currentPath()).toHaveTextContent(/^\/campaigns\/1\/skills$/);

    await user.click(screen.getByRole("link", { name: "Spells" }));
    await screen.findByRole("row", { name: /^Gutter Hex/ });
    await user.click(screen.getByRole("link", { name: "Skills" }));

    expect(await screen.findByRole("row", { name: /^Strike to Injure/ })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search skills" })).toHaveValue("");
    expect(screen.getByText("All disciplines")).toBeVisible();
  });
});

describe("Spells: search and type filter", () => {
  // Characterises current behaviour (CAT-UX-05, CAT-NEW-02, pinned; flips in PR C)
  it("keeps them out of the URL and forgets them after a visit to Skills (CAT-UX-05, pinned; flips in PR C)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/spells");
    await screen.findByRole("row", { name: /^Gutter Hex/ });

    await user.type(screen.getByRole("searchbox", { name: "Search spells" }), "cobbles");
    expect(rowNamed("Fires of U'Zhul")).toBeNull();
    expect(currentPath()).toHaveTextContent(/^\/campaigns\/1\/spells$/);

    await user.click(screen.getByRole("link", { name: "Skills" }));
    await screen.findByRole("row", { name: /^Quick Hands/ });
    await user.click(screen.getByRole("link", { name: "Spells" }));

    expect(await screen.findByRole("row", { name: /^Fires of U'Zhul/ })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search spells" })).toHaveValue("");
  });
});
