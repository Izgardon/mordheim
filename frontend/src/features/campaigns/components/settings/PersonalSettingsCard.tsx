import { Button } from "@components/button"
import { CardBackground } from "@components/card-background"
import { useMediaQuery } from "@/lib/use-media-query"

type PersonalSettingsCardProps = {
  onSignOut: () => void
}

export default function PersonalSettingsCard({ onSignOut }: PersonalSettingsCardProps) {
  const isMobile = useMediaQuery("(max-width: 960px)")
  return (
    <CardBackground disableBackground={isMobile} className={isMobile ? "space-y-4 p-3" : "space-y-4 p-6"}>
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
