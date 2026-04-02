import { Button } from "@components/button"
import { CardBackground } from "@components/card-background"

type PersonalSettingsCardProps = {
  onSignOut: () => void
  onOpenCampaigns?: () => void
}

export default function PersonalSettingsCard({
  onSignOut,
  onOpenCampaigns,
}: PersonalSettingsCardProps) {
  return (
    <CardBackground className="space-y-2 p-3 bg-[rgba(12,9,6,0.92)] sm:space-y-3 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h3 className="text-lg font-semibold text-foreground">Account</h3>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {onOpenCampaigns ? (
            <Button variant="secondary" size="sm" onClick={onOpenCampaigns}>
              Campaigns
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={onSignOut}>
            Log out
          </Button>
        </div>
      </div>
    </CardBackground>
  )
}
