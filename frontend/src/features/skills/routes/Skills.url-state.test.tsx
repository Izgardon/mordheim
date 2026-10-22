/**
 * Where the Skills and Spells pages keep their search and type filter: in the query string (`q`,
 * `type`; CAT-NEW-02), so the browser's Back after another page and a shared link restore both
 * (CAT-UX-05). The rail's link to a page starts it afresh.
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
  it("puts them in the URL; the browser's Back after a visit to Spells restores them (CAT-UX-05, CAT-NEW-02)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/skills");
    await screen.findByRole("row", { name: /^Quick Hands/ });

    await chooseOption(user, screen.getByText("All disciplines").closest("button")!, "Speed");
    await user.type(screen.getByRole("searchbox", { name: "Search skills" }), "quick");
    expect(rowNamed("Strike to Injure")).toBeNull();
    expect(currentPath()).toHaveTextContent("/campaigns/1/skills?type=Speed&q=quick");

    await user.click(screen.getByRole("link", { name: "Spells" }));
    await screen.findByRole("row", { name: /^Gutter Hex/ });
    await user.click(screen.getByRole("button", { name: "Browser back" }));

    expect(await screen.findByRole("row", { name: /^Quick Hands/ })).toBeVisible();
    expect(rowNamed("Strike to Injure")).toBeNull();
    expect(screen.getByRole("searchbox", { name: "Search skills" })).toHaveValue("quick");
    expect(screen.queryByText("All disciplines")).toBeNull();
  });

  it("opens a shared link on its filter and search, and the rail's link starts afresh (CAT-NEW-02)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/skills?type=Combat&q=injure");

    expect(await screen.findByRole("row", { name: /^Strike to Injure/ })).toBeVisible();
    expect(rowNamed("Quick Hands")).toBeNull();

    await user.click(screen.getByRole("link", { name: "Spells" }));
    await screen.findByRole("row", { name: /^Gutter Hex/ });
    await user.click(screen.getByRole("link", { name: "Skills" }));

    expect(await screen.findByRole("row", { name: /^Quick Hands/ })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search skills" })).toHaveValue("");
  });
});

describe("Spells: search and type filter", () => {
  it("puts them in the URL; the browser's Back after a visit to Skills restores them (CAT-UX-05, CAT-NEW-02)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/spells");
    await screen.findByRole("row", { name: /^Gutter Hex/ });

    await user.type(screen.getByRole("searchbox", { name: "Search spells" }), "cobbles");
    expect(rowNamed("Fires of U'Zhul")).toBeNull();
    expect(currentPath()).toHaveTextContent("/campaigns/1/spells?q=cobbles");

    await user.click(screen.getByRole("link", { name: "Skills" }));
    await screen.findByRole("row", { name: /^Quick Hands/ });
    await user.click(screen.getByRole("button", { name: "Browser back" }));

    expect(await screen.findByRole("row", { name: /^Gutter Hex/ })).toBeVisible();
    expect(rowNamed("Fires of U'Zhul")).toBeNull();
    expect(screen.getByRole("searchbox", { name: "Search spells" })).toHaveValue("cobbles");
  });
});
