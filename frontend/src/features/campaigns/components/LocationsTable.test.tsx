import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import LocationsTable from "./LocationsTable"
import type { CampaignLocation } from "../types/campaign-types"

function makeLocation(content: string): CampaignLocation {
  return {
    id: 1,
    campaign_id: 1,
    name: "Docks",
    content,
    d6_1: "",
    d6_2: "",
    d6_3: "",
    d6_4: "",
    d6_5: "",
    d6_6: "",
  }
}

function renderExpanded(location: CampaignLocation) {
  const view = render(
    <LocationsTable locations={[location]} rowBackground={{}} renderActions={() => null} />
  )
  fireEvent.click(screen.getByText("Docks"))
  return view
}

describe("LocationsTable", () => {
  it("renders location rich text", () => {
    renderExpanded(makeLocation("<p><strong>Thick fog</strong> rolls in.</p>"))

    expect(screen.getByText("Thick fog").tagName).toBe("STRONG")
  })

  it("never renders script payloads from location content", () => {
    const { container } = renderExpanded(
      makeLocation('<p>Fog</p><img src="x" onerror="window.__pwned = true"><script>window.__pwned = true</script>')
    )

    expect(screen.getByText("Fog")).toBeTruthy()
    expect(container.querySelector("[onerror]")).toBeNull()
    expect(container.querySelector("script")).toBeNull()
    expect((window as { __pwned?: boolean }).__pwned).toBeUndefined()
  })
})
