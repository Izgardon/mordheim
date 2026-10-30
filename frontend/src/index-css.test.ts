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

  it("defines every design token for dark on :root and again for light", () => {
    const block = (selector: string) =>
      stylesheet.match(new RegExp(`\\n  ${selector} \\{([\\s\\S]*?)\\n  \\}`))?.[1] ?? "";
    const names = (css: string) =>
      [...css.matchAll(/^\s*(--[\w-]+):/gm)].map((match) => match[1]).sort();
    const dark = block(":root");
    const light = block(':root\\[data-theme="light"\\]');

    expect(names(dark)).toContain("--color-accent-hi");
    expect(names(dark)).toContain("--background");
    expect(names(light)).toEqual(names(dark));
    expect(dark).toMatch(/color-scheme: dark;/);
    expect(light).toMatch(/color-scheme: light;/);
  });
});
