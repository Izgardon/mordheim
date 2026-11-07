import { useState } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { setupUser } from "@/test/user-event";

import WhoCanField from "./WhoCanField";
import { draftOf, everyone, type WhoCanDraft } from "../utils/who-can-draft";

vi.mock("@/features/warbands/api/warband-types-queries", () => ({
  useWarbandTypes: () => ({
    data: [{ id: 3, name: "Skaven", source_code: "", setting: null }],
  }),
}));
vi.mock("@/features/items/api/who-can-queries", () => ({
  useWarbandGroups: () => ({ data: [{ id: 8, name: "Undead" }] }),
}));

let latest: WhoCanDraft = everyone();

function Who({ start = everyone() }: { start?: WhoCanDraft }) {
  const [value, setValue] = useState(start);
  latest = value;
  return (
    <WhoCanField campaignId={1} id="who" label="Who can buy" value={value} onChange={setValue} />
  );
}

const meaning = () => screen.getByText(/^(Everyone|Only these|No one)/);

describe("WhoCanField", () => {
  it("is Exclude by default, for everyone, and what is added is shut out", async () => {
    const user = setupUser();
    render(<Who />);

    expect(screen.getByRole("radio", { name: "Exclude" })).toHaveAttribute("aria-checked", "true");
    expect(meaning()).toHaveTextContent("Everyone");
    await user.type(screen.getByRole("combobox"), "Skav");
    await user.click(screen.getByRole("option", { name: /Skaven/ }));

    expect(meaning()).toHaveTextContent("Everyone except these");
    expect(screen.getByText("not Skaven")).toBeInTheDocument();
    expect(latest).toMatchObject({
      forEveryone: true,
      lines: [{ name: "Skaven", excluded: true }],
    });
  });

  it("on Include lets in only what is added, and says no one while nothing is", async () => {
    const user = setupUser();
    render(<Who />);

    await user.click(screen.getByRole("radio", { name: "Include" }));
    expect(meaning()).toHaveTextContent("No one");
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "placeholder",
      "Include a warband type or group…"
    );
    await user.type(screen.getByRole("combobox"), "Und");
    await user.click(screen.getByRole("option", { name: /Undead/ }));

    expect(meaning()).toHaveTextContent("Only these");
    expect(latest).toMatchObject({
      forEveryone: false,
      lines: [{ name: "Undead", excluded: false }],
    });
  });

  it("shows a mixed list's lines as they are, and keeps them until the mode is switched", async () => {
    const user = setupUser();
    const mixed = draftOf({
      for_everyone: false,
      warbands: [
        { warband_type_id: null, warband_group_id: 8, name: "Undead", excluded: false },
        { warband_type_id: 3, warband_group_id: null, name: "Skaven", excluded: true },
      ],
    });
    render(<Who start={mixed} />);

    expect(screen.getByText("Undead (group)")).toBeInTheDocument();
    expect(screen.getByText("not Skaven")).toBeInTheDocument();
    expect(meaning()).toHaveTextContent("Only these · some lines say otherwise");
    expect(latest).toEqual(mixed);

    await user.click(screen.getByRole("radio", { name: "Exclude" }));
    expect(latest.lines.map((line) => line.excluded)).toEqual([true, true]);
  });
});
