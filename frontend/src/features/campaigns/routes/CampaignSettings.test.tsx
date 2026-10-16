import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import CampaignSettings from "./CampaignSettings"

import type { CampaignRole, CampaignSummary } from "../types/campaign-types"

const { listCampaignMembers, listCampaignActiveBattles } = vi.hoisted(() => ({
  listCampaignMembers: vi.fn(),
  listCampaignActiveBattles: vi.fn(),
}))

vi.mock("../api/campaigns-api", () => ({
  listCampaignMembers,
  listCampaignActiveBattles,
  cancelCampaignActiveBattle: vi.fn(),
  deleteCampaign: vi.fn(),
  removeCampaignMember: vi.fn(),
  updateMemberPermissions: vi.fn(),
  updateMemberRole: vi.fn(),
}))

vi.mock("../../auth/hooks/use-auth", () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}))

vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: null, setWarband: vi.fn() }),
}))

vi.mock("@/lib/use-media-query", () => ({
  useMediaQuery: () => false,
}))

vi.mock("../components/settings/PersonalSettingsCard", () => ({
  default: () => <div>Personal settings card</div>,
}))
vi.mock("../components/settings/MembersCard", () => ({
  default: () => <div>Members card</div>,
}))
vi.mock("../components/settings/WarbandDiceSettingsCard", () => ({ default: () => null }))
vi.mock("../components/settings/WarbandSettingsCard", () => ({ default: () => null }))
vi.mock("../components/settings/FeedbackReportCard", () => ({ default: () => null }))
vi.mock("../components/settings/DeleteWarbandCard", () => ({ default: () => null }))
vi.mock("../components/settings/ActiveBattlesTable", () => ({ default: () => null }))
vi.mock("../components/settings/CampaignControlCard", () => ({ default: () => null }))
vi.mock("../components/settings/CampaignLevelUpSettingsCard", () => ({ default: () => null }))
vi.mock("../components/settings/DeleteCampaignCard", () => ({ default: () => null }))
vi.mock("../components/settings/RemoveMemberDialog", () => ({ default: () => null }))
vi.mock("@components/confirm-dialog", () => ({ ConfirmDialog: () => null }))

const buildCampaign = (role: CampaignRole): CampaignSummary => ({
  id: 4,
  name: "Shadows over Mordheim",
  join_code: "",
  max_players: 8,
  max_heroes: 6,
  max_hired_swords: 2,
  max_games: 10,
  starting_gold: 500,
  player_count: 3,
  role,
  in_progress: true,
  created_at: "2026-04-18T10:00:00Z",
  updated_at: "2026-04-18T10:00:00Z",
})

function SettingsRoute({ campaign }: { campaign: CampaignSummary }) {
  return (
    <MemoryRouter initialEntries={["/campaigns/4/settings"]}>
      <Routes>
        <Route path="/campaigns/:id" element={<Outlet context={{ campaign }} />}>
          <Route path="settings" element={<CampaignSettings />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe("CampaignSettings", () => {
  beforeEach(() => {
    listCampaignMembers.mockReset()
    listCampaignActiveBattles.mockReset()
    listCampaignMembers.mockResolvedValue([])
    listCampaignActiveBattles.mockResolvedValue([])
  })

  it("falls back to personal settings when the viewer loses manage rights while open", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<SettingsRoute campaign={buildCampaign("admin")} />)

    await user.click(screen.getAllByRole("button", { name: "Campaign" })[0])
    expect(await screen.findByText("Members card")).toBeInTheDocument()

    rerender(<SettingsRoute campaign={buildCampaign("player")} />)

    expect(screen.getByText("Personal settings card")).toBeInTheDocument()
    expect(screen.queryByText("Members card")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Campaign" })).not.toBeInTheDocument()
  })

  it("shows campaign management when the viewer gains manage rights while open", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<SettingsRoute campaign={buildCampaign("player")} />)

    expect(screen.getByText("Personal settings card")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Campaign" })).not.toBeInTheDocument()
    expect(listCampaignMembers).not.toHaveBeenCalled()

    rerender(<SettingsRoute campaign={buildCampaign("admin")} />)

    await waitFor(() => expect(listCampaignMembers).toHaveBeenCalledWith(4))
    await user.click(screen.getAllByRole("button", { name: "Campaign" })[0])
    expect(await screen.findByText("Members card")).toBeInTheDocument()
  })
})
