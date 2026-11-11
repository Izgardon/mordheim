/** An item's card names its setting (Mordheim's grades as one), unless its source already does. */
import { describe, expect, it } from "vitest";

import { makeItem } from "@/test/warband-fixtures";

import { sourceLine } from "./WargearDetail";

describe("an item's Source line", () => {
  it("names the setting beside the source", () => {
    const item = makeItem({ source: "Town Cryer #9", availabilities: [] });

    expect(sourceLine(item, "Mordheim")).toBe("Town Cryer #9 · Mordheim");
  });

  it("leaves the setting out where the source already names it", () => {
    const item = makeItem({ source: "Khemri setting, Town Cryer #18", availabilities: [] });

    expect(sourceLine(item, "Khemri")).toBe("Khemri setting, Town Cryer #18");
  });

  it("calls an entry with no setting the campaign's own", () => {
    const own = makeItem({ source: "", campaign_id: 3, availabilities: [] });

    expect(sourceLine(own, "")).toBe("This campaign's own");
  });
});
