import { Button } from "@components/button"
import { CardBackground } from "@components/card-background"

type PersonalSettingsCardProps = {
  onSignOut: () => void
}

export default function PersonalSettingsCard({ onSignOut }: PersonalSettingsCardProps) {
  return (
    <CardBackground className="space-y-4 p-6">
      <h3 className="text-lg font-semibold text-foreground">Account</h3>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Sign out of your account
        </p>
        <Button variant="secondary" size="sm" onClick={onSignOut}>
          Log out
        </Button>
      </div>
    </CardBackground>
  )
}
