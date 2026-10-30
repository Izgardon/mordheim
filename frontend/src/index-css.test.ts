import { describe, expect, it } from "vitest";

import stylesheet from "@/index.css?raw";

describe("global stylesheet", () => {
  it("loads no font from mordheimer.net (it 404s, and its licence is unknown) (BUG-60)", () => {
    expect(stylesheet).not.toMatch(/mordheimer\.net/);
    expect(stylesheet).not.toMatch(/@font-face/);
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
