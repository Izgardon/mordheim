/**
 * The warband's own rules (William, 3 Nov 2026), laid out as Resources is (22 Nov 2026): the
 * title with Add rule across from it, one line of pills with an arrow for the rest, a pill opening
 * the modal at its rule. The warband's editors add (from the section), edit and delete them (in
 * the modal; Delete asks again); a viewer only reads, and sees nothing when there are none.
 */
import { useQuery } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import { warbandSheetQuery } from "../../api/warband-queries";
import type { WarbandSheet } from "../../types/warband-sheet";
import type { WarbandRule } from "../../types/warband-types";
import WarbandRules from "./WarbandRules";

const media = vi.hoisted(() => ({ phone: false }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => media.phone }));

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const hatred: WarbandRule = { id: 1, title: "Hatred", description: "Hates all Skaven." };
const burn: WarbandRule = { id: 2, title: "Burn the witch", description: "" };

/** The page passes the sheet's rules, so a write shows once it patches the cached sheet. */
function Page({ canEdit }: { canEdit: boolean }) {
  const sheet = useQuery({ ...warbandSheetQuery(1, 9), enabled: false }).data;
  return (
    <WarbandRules warbandId={9} warbandName="Monks" rules={sheet?.rules ?? []} canEdit={canEdit} />
  );
}

function renderRules(rules: WarbandRule[], canEdit: boolean) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.campaign.warbandSheet(1, 9), {
    rules,
  } as unknown as WarbandSheet);
  return renderWithQueryClient(<Page canEdit={canEdit} />, { queryClient });
}

beforeEach(() => {
  fakeApi.reset();
  media.phone = false;
});

describe("WarbandRules", () => {
  it("shows a pill per rule, and a pill opens the modal at its rule", async () => {
    const user = setupUser();
    renderRules([hatred, burn], false);

    const section = screen.getByRole("region", { name: "Warband rules" });
    await user.click(within(section).getByRole("button", { name: "Hatred" }));

    const dialog = await screen.findByRole("dialog", { name: "Warband rules" });
    expect(within(dialog).getByRole("article", { name: "Hatred" })).toHaveAttribute("data-opened");
    expect(within(dialog).getByRole("article", { name: "Burn the witch" })).not.toHaveAttribute(
      "data-opened"
    );
    expect(dialog).toHaveTextContent("Hates all Skaven.");
    expect(within(dialog).queryByRole("button", { name: /^Edit |^Add rule$/ })).toBeNull();
    // read only on the web too, it closes with its × as the drawers do
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("has a title and no Add rule for a viewer, and a pill opens every rule", async () => {
    const user = setupUser();
    renderRules([hatred, burn], false);

    const section = screen.getByRole("region", { name: "Warband rules" });
    expect(within(section).getByRole("heading", { name: "Warband rules" })).toBeVisible();
    expect(within(section).queryByRole("button", { name: "Add rule" })).toBeNull();
    await user.click(within(section).getByRole("button", { name: "Burn the witch" }));

    const dialog = await screen.findByRole("dialog", { name: "Warband rules" });
    expect(within(dialog).getByRole("article", { name: "Hatred" })).toBeVisible();
    expect(within(dialog).queryByRole("button", { name: "Add rule" })).toBeNull();
  });

  // William, 23 Nov 2026: a template's long line of pills made the whole open row on Reference →
  // Warbands wider than his phone, and the line didn't scroll
  it("keeps its pills out of its own width, and scrolls them sideways on a phone", () => {
    media.phone = true;
    renderRules([hatred, burn], false);

    const line = screen.getByRole("button", { name: "Hatred" }).parentElement;
    expect(line).toHaveClass("[contain:inline-size]", "overflow-x-auto");
    expect(line).not.toHaveClass("overflow-hidden");
  });

  it("clips the line on the web, the arrow showing the rest", () => {
    renderRules([hatred, burn], false);

    const line = screen.getByRole("button", { name: "Hatred" }).parentElement;
    expect(line).toHaveClass("[contain:inline-size]", "overflow-hidden");
    expect(line).not.toHaveClass("overflow-x-auto");
  });

  it("is left out for a viewer when there are none", () => {
    const { container } = renderRules([], false);
    expect(container).toBeEmptyDOMElement();
  });

  // William, 22 Nov 2026: "The add warband rule form should be its own form, not part of the
  // warband rules modal"
  it("lets an editor add the first rule in a form of its own", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/rules/", (body: object) => ({ id: 3, ...body }));
    renderRules([], true);

    await user.click(screen.getByRole("button", { name: "Add rule" }));
    const adding = await screen.findByRole("dialog", { name: "Add rule" });
    expect(screen.queryByRole("dialog", { name: "Warband rules" })).toBeNull();
    const form = within(adding).getByRole("form", { name: "Add a rule" });
    await user.type(within(form).getByLabelText("Title"), " Wyrdstone hunters ");
    await user.type(within(form).getByLabelText("Description"), "+1 to search.");
    await user.click(within(form).getByRole("button", { name: "Add rule" }));

    expect(fakeApi.bodyOf("POST /warbands/9/rules/")).toEqual({
      title: "Wyrdstone hunters",
      description: "+1 to search.",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull()); // the form closes on saving
    const section = await screen.findByRole("region", { name: "Warband rules" });
    expect(within(section).getByRole("button", { name: "Wyrdstone hunters" })).toBeVisible();
    expect(within(section).getByRole("button", { name: "Add rule" })).toBeVisible();
  });

  it("lets an editor edit a rule, and delete it after asking again", async () => {
    const user = setupUser();
    fakeApi.on("PATCH /warbands/9/rules/1/", (body: object) => ({ ...hatred, ...body }));
    fakeApi.on("DELETE /warbands/9/rules/1/", null);
    renderRules([hatred, burn], true);

    await user.click(screen.getByRole("button", { name: "Hatred" }));
    const dialog = await screen.findByRole("dialog", { name: "Warband rules" });
    await user.click(within(dialog).getByRole("button", { name: "Edit Hatred" }));
    const form = within(dialog).getByRole("form", { name: "Edit Hatred" });
    await user.clear(within(form).getByLabelText("Title"));
    await user.type(within(form).getByLabelText("Title"), "Hate");
    await user.click(within(form).getByRole("button", { name: "Save changes" }));
    expect(await within(dialog).findByRole("article", { name: "Hate" })).toBeVisible();

    await user.click(within(dialog).getByRole("button", { name: "Edit Hate" }));
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(fakeApi.calls()).not.toContain("DELETE /warbands/9/rules/1/");
    await user.click(within(dialog).getByRole("button", { name: "Delete for good" }));

    await waitFor(() => expect(within(dialog).queryByRole("article", { name: "Hate" })).toBeNull());
    expect(fakeApi.calls()).toContain("DELETE /warbands/9/rules/1/");
    expect(within(dialog).getByRole("article", { name: "Burn the witch" })).toBeVisible();
  });
});

describe("Add missing rules", () => {
  function renderWithTemplate(missing: number, template: object | null = {}) {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.campaign.warbandSheet(1, 9), {
      rules: [hatred],
    } as unknown as WarbandSheet);
    fakeApi.on("GET /warbands/9/template/", {
      template,
      variant: "",
      list_prices_open: false,
      missing_rules: missing,
    });
    const Rules = () => {
      const sheet = useQuery({ ...warbandSheetQuery(1, 9), enabled: false }).data;
      return (
        <WarbandRules
          campaignId={1}
          warbandId={9}
          warbandName="Monks"
          rules={sheet?.rules ?? []}
          canEdit
        />
      );
    };
    return renderWithQueryClient(<Rules />, { queryClient });
  }

  it("copies the rules the warband lacks, and shows only while some are missing", async () => {
    fakeApi.on("POST /warbands/9/rules/from-template/", [hatred, burn]);
    const user = setupUser();
    renderWithTemplate(1);
    await user.click(await screen.findByRole("button", { name: "Hatred" }));
    const dialog = await screen.findByRole("dialog", { name: "Warband rules" });
    await user.click(await within(dialog).findByRole("button", { name: "Add missing rules" }));
    expect(
      await within(dialog).findByRole("article", { name: "Burn the witch" })
    ).toBeInTheDocument();
    expect(fakeApi.countOf("POST /warbands/9/rules/from-template/")).toBe(1);
  });

  it("shows for a warband whose type has no template when its preset's rules are missing", async () => {
    const user = setupUser();
    renderWithTemplate(1, null);
    await user.click(await screen.findByRole("button", { name: "Hatred" }));
    const dialog = await screen.findByRole("dialog", { name: "Warband rules" });
    expect(
      await within(dialog).findByRole("button", { name: "Add missing rules" })
    ).toBeInTheDocument();
  });

  it("is left out when none are missing", async () => {
    const user = setupUser();
    renderWithTemplate(0);
    await user.click(await screen.findByRole("button", { name: "Hatred" }));
    const dialog = await screen.findByRole("dialog", { name: "Warband rules" });
    await waitFor(() => expect(fakeApi.countOf("GET /warbands/9/template/")).toBe(1));
    expect(within(dialog).queryByRole("button", { name: "Add missing rules" })).toBeNull();
  });
});
