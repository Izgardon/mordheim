/**
 * The warband's own rules (William, 3 Nov 2026): a pill per rule beside Warband rules, which opens
 * them all in a modal; a pill opens it at its rule. The warband's editors add, edit and delete
 * them there (Delete asks again); a viewer only reads, and sees nothing when there are none.
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
  });

  it("opens them all from Warband rules", async () => {
    const user = setupUser();
    renderRules([hatred], false);

    await user.click(screen.getByRole("button", { name: "Warband rules" }));

    const dialog = await screen.findByRole("dialog", { name: "Warband rules" });
    expect(within(dialog).getByRole("article", { name: "Hatred" })).not.toHaveAttribute(
      "data-opened"
    );
  });

  it("is left out for a viewer when there are none", () => {
    const { container } = renderRules([], false);
    expect(container).toBeEmptyDOMElement();
  });

  it("lets an editor add the first rule", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/rules/", (body: object) => ({ id: 3, ...body }));
    renderRules([], true);

    await user.click(screen.getByRole("button", { name: "Add a rule" }));
    const form = await screen.findByRole("form", { name: "Add a rule" });
    await user.type(within(form).getByLabelText("Title"), " Wyrdstone hunters ");
    await user.type(within(form).getByLabelText("Description"), "+1 to search.");
    await user.click(within(form).getByRole("button", { name: "Add rule" }));

    expect(fakeApi.bodyOf("POST /warbands/9/rules/")).toEqual({
      title: "Wyrdstone hunters",
      description: "+1 to search.",
    });
    const dialog = screen.getByRole("dialog", { name: "Warband rules" });
    expect(await within(dialog).findByRole("article", { name: "Wyrdstone hunters" })).toBeVisible();
    expect(screen.queryByRole("form")).toBeNull();

    await user.keyboard("{Escape}");
    const section = await screen.findByRole("region", { name: "Warband rules" });
    expect(within(section).getByRole("button", { name: "Wyrdstone hunters" })).toBeVisible();
    expect(within(section).queryByRole("button", { name: "Add a rule" })).toBeNull();
  });

  it("lets an editor edit a rule, and delete it after asking again", async () => {
    const user = setupUser();
    fakeApi.on("PATCH /warbands/9/rules/1/", (body: object) => ({ ...hatred, ...body }));
    fakeApi.on("DELETE /warbands/9/rules/1/", null);
    renderRules([hatred, burn], true);

    await user.click(screen.getByRole("button", { name: "Warband rules" }));
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

describe("Add the template's rules", () => {
  function renderWithTemplate(missing: number) {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.campaign.warbandSheet(1, 9), {
      rules: [hatred],
    } as unknown as WarbandSheet);
    fakeApi.on("GET /warbands/9/template/", {
      template: { missing_rules: missing },
      variant: "",
      list_prices_open: false,
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
    await user.click(screen.getByRole("button", { name: "Warband rules" }));
    const dialog = await screen.findByRole("dialog", { name: "Warband rules" });
    await user.click(
      await within(dialog).findByRole("button", { name: "Add the template's rules" })
    );
    expect(
      await within(dialog).findByRole("article", { name: "Burn the witch" })
    ).toBeInTheDocument();
    expect(fakeApi.countOf("POST /warbands/9/rules/from-template/")).toBe(1);
  });

  it("is left out when none are missing", async () => {
    const user = setupUser();
    renderWithTemplate(0);
    await user.click(screen.getByRole("button", { name: "Warband rules" }));
    const dialog = await screen.findByRole("dialog", { name: "Warband rules" });
    await waitFor(() => expect(fakeApi.countOf("GET /warbands/9/template/")).toBe(1));
    expect(within(dialog).queryByRole("button", { name: "Add the template's rules" })).toBeNull();
  });
});
