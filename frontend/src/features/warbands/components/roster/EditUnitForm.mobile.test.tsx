/**
 * The Edit form's bar on a phone (William, 19 Nov 2026): the three that act on the unit -- dismiss,
 * Duplicate and Save -- with no Cancel, because the sheet's X and a swipe already close it. Notes
 * and Missing games stay in the body. Confirming a dismissal still says what is lost.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeHero } from "@/test/warband-fixtures";

import EditUnitForm from "./EditUnitForm";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("../../api/warband-cache", () => ({ useWarbandCacheUpdate: () => () => undefined }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));

const renderOnAPhone = () => {
  const onClose = vi.fn();
  renderWithQueryClient(
    <EditUnitForm
      entry={{ kind: "hero", unit: makeHero({ id: 5 }) }}
      campaign={null}
      campaignId={1}
      warbandId={9}
      canCreateRace={false}
      onAddItem={vi.fn()}
      onClose={onClose}
    />
  );
  return { onClose };
};

describe("The Edit form's bar on a phone", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("POST /warbands/9/heroes/batch/", { units: [], summary: {} });
  });

  it("holds the three that act on the unit, and no Cancel", () => {
    renderOnAPhone();

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss hero" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("still says what a dismissal loses, and keeps Save beside it", async () => {
    const user = setupUser();
    renderOnAPhone();

    await user.click(screen.getByRole("button", { name: "Dismiss hero" }));

    expect(
      screen.getByRole("button", { name: /Dismiss hero for good: carried items are lost/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeInTheDocument();
  });

  it("leaves Notes and Missing games in the body, not the bar", () => {
    renderOnAPhone();

    const notes = screen.getByRole("button", { name: "Notes" });
    const save = screen.getByRole("button", { name: "Save" });
    const bar = save.parentElement as HTMLElement;

    expect(within(bar).queryByRole("button", { name: "Notes" })).not.toBeInTheDocument();
    expect(notes).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Missing games" })).toBeInTheDocument();
  });
});
