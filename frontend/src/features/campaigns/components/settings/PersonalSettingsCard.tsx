import { Button } from "@components/button"
import { CardBackground } from "@components/card-background"

type PersonalSettingsCardProps = {
  onSignOut: () => void
}

export default function PersonalSettingsCard({ onSignOut }: PersonalSettingsCardProps) {
  return (
    <CardBackground className="space-y-2 p-3 bg-[rgba(12,9,6,0.92)] sm:space-y-3 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-foreground">Account</h3>
        <Button variant="secondary" size="sm" onClick={onSignOut}>
          Log out
        </Button>
      </div>
    </CardBackground>
  )
}
