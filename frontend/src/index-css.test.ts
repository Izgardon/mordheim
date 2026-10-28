import { describe, expect, it } from "vitest";

import stylesheet from "@/index.css?raw";

describe("global stylesheet", () => {
  it("loads no font from mordheimer.net (it 404s, and its licence is unknown) (BUG-60)", () => {
    expect(stylesheet).not.toMatch(/mordheimer\.net/);
    expect(stylesheet).not.toMatch(/@font-face/);
  });

  it("gives a touch target 44 px on a touch or narrow screen, its box or its taps above and below (the bestiary rewrite's browser check)", () => {
    const touch = stylesheet.match(
      /@media \(pointer: coarse\), \(max-width: 960px\) \{([\s\S]*?)\n {2}\}/
    )?.[1];

    expect(touch).toMatch(/\.touch-target \{\s*min-width: 2\.75rem;\s*min-height: 2\.75rem;/);
    expect(touch).toMatch(/\.touch-target-row \{\s*align-items: center;/);
    expect(touch).toMatch(/\.touch-target-y::after \{[^}]*height: max\(100%, 2\.75rem\);/);
  });
});
