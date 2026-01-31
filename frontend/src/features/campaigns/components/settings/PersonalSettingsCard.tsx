import { Button } from "@components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@components/card"

type PersonalSettingsCardProps = {
  onSignOut: () => void
}

export default function PersonalSettingsCard({ onSignOut }: PersonalSettingsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Sign out of your account
          </p>
          <Button variant="secondary" size="sm" onClick={onSignOut}>
            Log out
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
