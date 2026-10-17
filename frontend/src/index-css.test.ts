import { describe, expect, it } from "vitest";

import stylesheet from "@/index.css?raw";

describe("global stylesheet", () => {
  it("loads no font from mordheimer.net (it 404s, and its licence is unknown) (BUG-60)", () => {
    expect(stylesheet).not.toMatch(/mordheimer\.net/);
    expect(stylesheet).not.toMatch(/@font-face/);
  });
});
