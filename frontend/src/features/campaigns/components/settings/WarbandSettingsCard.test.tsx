import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach } from "vitest"

import WarbandSettingsCard from "./WarbandSettingsCard"

import type { Warband } from "@/features/warbands/types/warband-types"

const {
  listRestrictions,
  updateWarband,
  updateWarbandRestrictions,
} = vi.hoisted(() => ({
  listRestrictions: vi.fn(),
  updateWarband: vi.fn(),
  updateWarbandRestrictions: vi.fn(),
}))

vi.mock("@/features/items/api/items-api", () => ({
  listRestrictions,
}))

vi.mock("@/features/warbands/api/warbands-api", () => ({
  updateWarband,
  updateWarbandRestrictions,
}))

vi.mock("@/lib/use-media-query", () => ({
  useMediaQuery: () => false,
}))

const baseWarband: Warband = {
  id: 11,
  name: "Ashen Crows",
  faction: "Mercenaries",
  campaign_id: 4,
  user_id: 7,
  warband_link: null,
  max_units: 15,
  restrictions: [],
  created_at: "2026-04-18T10:00:00Z",
  updated_at: "2026-04-18T10:00:00Z",
}

describe("WarbandSettingsCard", () => {
  beforeEach(() => {
    listRestrictions.mockImplementation(() => new Promise(() => {}))
    updateWarband.mockReset()
    updateWarbandRestrictions.mockReset()
  })

  it("saves updated warband name and max limit from personal settings", async () => {
    const user = userEvent.setup()
    const onWarbandUpdated = vi.fn()
    updateWarband.mockResolvedValue({
      ...baseWarband,
      name: "Black Hounds",
      max_units: 18,
    })

    const { container } = render(
      <WarbandSettingsCard
        warband={baseWarband}
        canEdit={true}
        onWarbandUpdated={onWarbandUpdated}
      />
    )

    const detailsSection = container.querySelector('section[aria-label="Warband details"]')
    expect(detailsSection).not.toBeNull()
    if (!detailsSection) {
      throw new Error("Warband details section not found.")
    }

    await user.click(within(detailsSection).getByRole("button", { name: "Edit" }))

    const nameInput = within(detailsSection).getByLabelText("Warband Name")
    const maxLimitInput = within(detailsSection).getByLabelText("Max Limit")

    fireEvent.change(nameInput, { target: { value: " Black Hounds " } })
    fireEvent.change(maxLimitInput, { target: { value: "18" } })

    await user.click(within(detailsSection).getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(updateWarband).toHaveBeenCalledWith(11, {
        name: "Black Hounds",
        max_units: 18,
      })
    })
    expect(onWarbandUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Black Hounds",
        max_units: 18,
      })
    )
    expect(await screen.findByText("Warband details updated.")).toBeInTheDocument()
  })

  it("shows a validation error when max limit is below one", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <WarbandSettingsCard
        warband={baseWarband}
        canEdit={true}
        onWarbandUpdated={vi.fn()}
      />
    )

    const detailsSection = container.querySelector('section[aria-label="Warband details"]')
    expect(detailsSection).not.toBeNull()
    if (!detailsSection) {
      throw new Error("Warband details section not found.")
    }

    await user.click(within(detailsSection).getByRole("button", { name: "Edit" }))

    const maxLimitInput = within(detailsSection).getByLabelText("Max Limit")
    fireEvent.change(maxLimitInput, { target: { value: "0" } })

    await user.click(within(detailsSection).getByRole("button", { name: "Save" }))

    expect(updateWarband).not.toHaveBeenCalled()
    expect(
      await screen.findByText("Max limit must be a whole number of at least 1.")
    ).toBeInTheDocument()
  })
})
