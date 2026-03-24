import { useEffect, useState } from "react"

import { Button } from "@components/button"
import { CardBackground } from "@components/card-background"
import { Input } from "@components/input"
import { useMediaQuery } from "@/lib/use-media-query"
import { useAppStore } from "@/stores/app-store"
import { updateWarband } from "@/features/warbands/api/warbands-api"

type PersonalSettingsCardProps = {
  onSignOut: () => void
  joinCode?: string
}

export default function PersonalSettingsCard({ onSignOut, joinCode }: PersonalSettingsCardProps) {
  const isMobile = useMediaQuery("(max-width: 960px)")
  const { warband, setWarband } = useAppStore()

  const [pdfUrl, setPdfUrl] = useState(warband?.warband_pdf ?? "")
  const [savedPdfUrl, setSavedPdfUrl] = useState(warband?.warband_pdf ?? "")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const url = warband?.warband_pdf ?? ""
    setPdfUrl(url)
    setSavedPdfUrl(url)
  }, [warband?.warband_pdf])

  const hasChanges = pdfUrl !== savedPdfUrl

  const handleSave = async () => {
    if (!warband) return
    setIsSaving(true)
    setError("")
    try {
      const updated = await updateWarband(warband.id, { warband_pdf: pdfUrl.trim() || null })
      setWarband({ ...warband, warband_pdf: updated.warband_pdf })
      const next = updated.warband_pdf ?? ""
      setSavedPdfUrl(next)
      setPdfUrl(next)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <CardBackground disableBackground={isMobile} className={isMobile ? "space-y-4 p-3" : "space-y-6 p-6"}>
      <h3 className="text-lg font-semibold text-foreground">Account</h3>
      {joinCode ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Join Code</p>
            <p className="mt-1 font-mono text-sm font-semibold text-foreground">{joinCode}</p>
          </div>
        </div>
      ) : null}
      {warband ? (
        <div className="space-y-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Warband PDF</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Link to your warband roster PDF for easy sharing.</p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="url"
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1"
            />
            <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      ) : null}
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
