/**
 * A rule created on the spot in a bestiary or hireling form picks its kind and its category
 * (William, 5 Nov 2026): a trait and an aura unless picked.
 */
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { pickOption } from "@/test/select";
import { setupUser } from "@/test/user-event";

import { useBestiaryLinks } from "../../hooks/useBestiaryLinks";
import BestiaryLinksFields from "./BestiaryLinksFields";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

function Harness() {
  const links = useBestiaryLinks({ campaignId: 1, open: true, specialType: "Animal" });
  return <BestiaryLinksFields links={links} />;
}

const created = (body: Record<string, unknown>) => ({ id: 90, ...body });

async function newRule(name: string) {
  const user = setupUser();
  renderWithQueryClient(<Harness />);
  await user.click(screen.getByRole("button", { name: "Add boon or bane" }));
  await user.type(screen.getByRole("combobox", { name: "Add boon or bane" }), `${name}{Enter}`);
  return user;
}

describe("A rule created on the spot", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("POST /special/", created);
  });

  it("sends the kind and the category picked", async () => {
    const user = await newRule("Tentacle");
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveTextContent("Aura");
    await user.click(screen.getByRole("button", { name: "Bane" }));
    await pickOption(user, screen.getByRole("combobox", { name: "Category" }), "Mutation");
    await user.click(screen.getByRole("button", { name: "Add rule" }));

    expect(fakeApi.bodyOf("POST /special/")).toEqual({
      campaign_id: 1,
      name: "Tentacle",
      type: "Animal",
      kind: "bane",
      category: "mutation",
      description: "",
    });
  });

  it("is a trait and an aura unless picked", async () => {
    const user = await newRule("Banner");
    await user.click(screen.getByRole("button", { name: "Add rule" }));

    expect(fakeApi.bodyOf("POST /special/")).toMatchObject({ kind: "trait", category: "aura" });
  });
});
