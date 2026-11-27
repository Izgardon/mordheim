import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { setupUser } from "@/test/user-event";

import ImportMenu from "./ImportMenu";

const WAGON = { id: 21, name: "The Gilded Wagon", sub: "Merchant Caravans" };

describe("ImportMenu", () => {
  it("is one button straight to the code with nothing of my own", async () => {
    const user = setupUser();
    const onCode = vi.fn();
    render(
      <ImportMenu
        label="Import a warband"
        picks={[]}
        pending={false}
        onPick={vi.fn()}
        onCode={onCode}
      />
    );
    await user.click(screen.getByRole("button", { name: "Import a warband" }));
    expect(onCode).toHaveBeenCalledOnce();
  });

  it("offers my own by name and type, then By code", async () => {
    const user = setupUser();
    const onPick = vi.fn();
    const onCode = vi.fn();
    render(
      <ImportMenu
        label="Import a warband"
        picks={[WAGON]}
        pending={false}
        onPick={onPick}
        onCode={onCode}
      />
    );
    await user.click(screen.getByRole("button", { name: "Import a warband" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "The Gilded WagonMerchant Caravans",
      "By code",
    ]);
    await user.click(screen.getByRole("menuitem", { name: /The Gilded Wagon/ }));
    expect(onPick).toHaveBeenCalledWith(21);
    expect(onCode).not.toHaveBeenCalled();
  });

  it("waits while an import is under way", () => {
    render(
      <ImportMenu label="Import a list" picks={[WAGON]} pending onPick={vi.fn()} onCode={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Importing…" })).toBeDisabled();
  });
});
