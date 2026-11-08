import { describe, expect, it } from "vitest";

import stylesheet from "@/index.css?raw";

const block = (selector: string) =>
  stylesheet.match(new RegExp(`\\n  ${selector} \\{([\\s\\S]*?)\\n  \\}`))?.[1] ?? "";
const LIGHT = ':root\\[data-theme="light"\\]';

/** A token's hex value in a theme's block. */
const token = (css: string, name: string) =>
  css.match(new RegExp(`${name}: (#[0-9a-f]{6});`))?.[1] ?? "";

const channels = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => {
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** WCAG's contrast ratio. */
const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};
/** The hue angle in degrees (HSL). */
const hue = (hex: string) => {
  const [r, g, b] = channels(hex);
  const max = Math.max(r, g, b);
  const span = max - Math.min(r, g, b);
  const sector = max === r ? (g - b) / span : max === g ? (b - r) / span + 2 : (r - g) / span + 4;
  return (sector * 60 + 360) % 360;
};

describe("global stylesheet", () => {
  it("loads no font from mordheimer.net (it 404s, and its licence is unknown) (BUG-60)", () => {
    expect(stylesheet).not.toMatch(/mordheimer\.net/);
    expect(stylesheet).not.toMatch(/@font-face/);
  });

  it("defines every design token for dark on :root and again for light", () => {
    const names = (css: string) =>
      [...css.matchAll(/^\s*(--[\w-]+):/gm)].map((match) => match[1]).sort();
    const dark = block(":root");
    const light = block(LIGHT);

    expect(names(dark)).toContain("--color-accent-hi");
    expect(names(dark)).toContain("--background");
    expect(names(light)).toEqual(names(dark));
    expect(dark).toMatch(/color-scheme: dark;/);
    expect(light).toMatch(/color-scheme: light;/);
  });

  // William: "yes" to pushing the light gold and bronze apart (they read alike at #8a6a1c, #8a4f2a)
  it("keeps the light card's gold and bronze apart, each AA as small text on the card", () => {
    const light = block(LIGHT);
    const card = token(light, "--color-surface");
    const gold = token(light, "--color-metal-gold");
    const bronze = token(light, "--color-metal-bronze");

    expect(card).toBe("#fbf8f2");
    expect(contrast(gold, card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(bronze, card)).toBeGreaterThanOrEqual(4.5);
    expect(hue(gold)).toBeGreaterThan(hue("#8a6a1c")); // yellower than before
    expect(hue(bronze)).toBeLessThan(hue("#8a4f2a")); // redder than before
    expect(hue(gold) - hue(bronze)).toBeGreaterThanOrEqual(30);
    expect(token(block(":root"), "--color-metal-gold")).toBe("#c9a24a"); // dark mode as it was
    expect(token(light, "--color-metal-silver")).toBe("#5f666f");
  });
});
