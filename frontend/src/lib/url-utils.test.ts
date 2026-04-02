import { describe, expect, it } from "vitest"

import { normalizeWebUrl } from "./url-utils"

describe("normalizeWebUrl", () => {
  it("keeps fully qualified urls unchanged", () => {
    expect(normalizeWebUrl("https://example.com/sheet")).toBe("https://example.com/sheet")
  })

  it("adds https for plain website links", () => {
    expect(normalizeWebUrl("example.com/sheet")).toBe("https://example.com/sheet")
  })

  it("returns an empty string for blank values", () => {
    expect(normalizeWebUrl("   ")).toBe("")
  })
})
