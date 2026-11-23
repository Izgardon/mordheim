/**
 * A template's equipment lists (William, 23 Nov 2026: "equipment lists should be expandable and
 * hideable default hidden on mobile"): each list's name shows and hides it, open at first on the
 * web and closed on a phone.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makeTemplateLine } from "@/test/template-fixtures";
import { setupUser } from "@/test/user-event";

import type { TemplateList } from "../types/template-types";
import TemplateLists from "./TemplateLists";

const LISTS: TemplateList[] = [
  {
    id: 1,
    key: "slayer",
    name: "Slayer Equipment List",
    note: "",
    lines: [makeTemplateLine(1, { id: 5, name: "Axe" }, 5)],
  },
  {
    id: 2,
    key: "rememberer",
    name: "Rememberer Equipment List",
    note: "",
    lines: [makeTemplateLine(2, { id: 6, name: "Crossbow" }, 25)],
  },
];

const toggle = (name: string) => screen.getByRole("button", { name });

describe("TemplateLists", () => {
  it("hides every list on a phone until its name is tapped", async () => {
    const user = setupUser();
    render(<TemplateLists lists={LISTS} variant="" isMobile />);

    expect(toggle("Slayer Equipment List")).toHaveAttribute("aria-expanded", "false");
    expect(toggle("Rememberer Equipment List")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list")).toBeNull();

    await user.click(toggle("Slayer Equipment List"));
    expect(toggle("Slayer Equipment List")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("list", { name: "Slayer Equipment List" })).toHaveTextContent("Axe");
    expect(screen.queryByRole("list", { name: "Rememberer Equipment List" })).toBeNull();

    await user.click(toggle("Slayer Equipment List"));
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows every list on the web, each one hiding on its name", async () => {
    const user = setupUser();
    render(<TemplateLists lists={LISTS} variant="" isMobile={false} />);

    expect(toggle("Slayer Equipment List")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("list", { name: "Slayer Equipment List" })).toBeVisible();
    expect(screen.getByRole("list", { name: "Rememberer Equipment List" })).toBeVisible();

    await user.click(toggle("Rememberer Equipment List"));
    expect(toggle("Rememberer Equipment List")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list", { name: "Rememberer Equipment List" })).toBeNull();
    expect(screen.getByRole("list", { name: "Slayer Equipment List" })).toBeVisible();
  });
});
