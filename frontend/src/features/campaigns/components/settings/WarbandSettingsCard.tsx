import { useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"

import { Button } from "@components/button"
import { CardBackground } from "@components/card-background"
import { Input } from "@components/input"
import RestrictionPicker from "@/features/warbands/components/shared/RestrictionPicker"
import { useMediaQuery } from "@/lib/use-media-query"

import { listRestrictions } from "@/features/items/api/items-api"
import { updateWarbandRestrictions, updateWarband } from "@/features/warbands/api/warbands-api"

import type { Restriction } from "@/features/items/types/item-types"
import type { Warband } from "@/features/warbands/types/warband-types"

const EXCLUDED_TYPES = new Set(["Artifact"])

type WarbandSettingsCardProps = {
  warband: Warband
  canEdit: boolean
  onWarbandUpdated: (warband: Warband) => void
}

export default function WarbandSettingsCard({
  warband,
  canEdit,
  onWarbandUpdated,
}: WarbandSettingsCardProps) {
  const isMobile = useMediaQuery("(max-width: 960px)")

  // PDF state
  const [pdfUrl, setPdfUrl] = useState(warband.warband_link ?? "")
  const [isPdfEditing, setIsPdfEditing] = useState(false)
  const [isPdfSaving, setIsPdfSaving] = useState(false)
  const [pdfError, setPdfError] = useState("")
  const [pdfMessage, setPdfMessage] = useState("")

  useEffect(() => {
    const url = warband.warband_link ?? ""
    setPdfUrl(url)
  }, [warband.warband_link])

  const handleSavePdf = async () => {
    setIsPdfSaving(true)
    setPdfError("")
    setPdfMessage("")
    try {
      const updated = await updateWarband(warband.id, { warband_link: pdfUrl.trim() || null })
      onWarbandUpdated({ ...warband, warband_link: updated.warband_link })
      setIsPdfEditing(false)
      setPdfMessage("PDF link updated.")
      setTimeout(() => setPdfMessage(""), 3000)
    } catch (saveError) {
      setPdfError(saveError instanceof Error ? saveError.message : "Unable to save PDF link.")
    } finally {
      setIsPdfSaving(false)
    }
  }

  // Restrictions state
  const [allRestrictions, setAllRestrictions] = useState<Restriction[]>([])
  const [selectedRestrictions, setSelectedRestrictions] = useState<Restriction[]>(
    warband.restrictions ?? []
  )
  const [isRestrictionsEditing, setIsRestrictionsEditing] = useState(false)
  const [isRestrictionsSaving, setIsRestrictionsSaving] = useState(false)
  const [restrictionsError, setRestrictionsError] = useState("")
  const [restrictionsMessage, setRestrictionsMessage] = useState("")

  useEffect(() => {
    listRestrictions({ campaignId: warband.campaign_id })
      .then((data) => setAllRestrictions(data.filter((r) => !EXCLUDED_TYPES.has(r.type))))
      .catch(() => setAllRestrictions([]))
  }, [warband.campaign_id])

  useEffect(() => {
    setSelectedRestrictions(warband.restrictions ?? [])
  }, [warband.restrictions])

  const selectedIds = useMemo(
    () => new Set(selectedRestrictions.map((r) => r.id)),
    [selectedRestrictions]
  )

  const handleToggleRestriction = (restriction: Restriction) => {
    setSelectedRestrictions((prev) =>
      prev.some((r) => r.id === restriction.id)
        ? prev.filter((r) => r.id !== restriction.id)
        : [...prev, restriction]
    )
  }

  const handleRemoveRestriction = (restrictionId: number) => {
    setSelectedRestrictions((prev) => prev.filter((r) => r.id !== restrictionId))
  }

  const handleSaveRestrictions = async () => {
    setIsRestrictionsSaving(true)
    setRestrictionsError("")
    setRestrictionsMessage("")
    try {
      const updated = await updateWarbandRestrictions(
        warband.id,
        selectedRestrictions.map((r) => r.id)
      )
      onWarbandUpdated({ ...warband, restrictions: updated })
      setIsRestrictionsEditing(false)
      setRestrictionsMessage("Restrictions updated.")
      setTimeout(() => setRestrictionsMessage(""), 3000)
    } catch (saveError) {
      setRestrictionsError(
        saveError instanceof Error ? saveError.message : "Unable to save restrictions."
      )
    } finally {
      setIsRestrictionsSaving(false)
    }
  }

  const displayRestrictions = isRestrictionsEditing
    ? selectedRestrictions
    : (warband.restrictions ?? [])

  return (
    <CardBackground disableBackground={isMobile} className={isMobile ? "space-y-4 p-3" : "space-y-4 p-6"}>
      <h3 className="text-lg font-semibold text-foreground">Warband Settings</h3>

      {/* Warband PDF */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Warband PDF</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Link to your warband roster PDF for easy sharing.
            </p>
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2">
              {isPdfEditing ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIsPdfEditing(false)
                      setPdfUrl(warband.warband_link ?? "")
                      setPdfError("")
                    }}
                    disabled={isPdfSaving}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" className="min-w-[4.5rem]" onClick={handleSavePdf} disabled={isPdfSaving}>
                    {isPdfSaving ? "Saving..." : "Save"}
                  </Button>
                </>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setIsPdfEditing(true)}>
                  Edit
                </Button>
              )}
            </div>
          ) : null}
        </div>
        {isPdfEditing ? (
          <Input
            value={pdfUrl}
            onChange={(e) => setPdfUrl(e.target.value)}
            placeholder="https://..."
            type="url"
          />
        ) : warband.warband_link ? (
          <a
            href={warband.warband_link}
            target="_blank"
            rel="noopener noreferrer"
            className="block min-w-0 truncate text-sm text-primary underline underline-offset-2"
          >
            {warband.warband_link}
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">No PDF link set.</p>
        )}
        <p className="min-h-[1.25rem] text-sm text-emerald-400">{pdfMessage}</p>
        <p className="min-h-[1.25rem] text-sm text-red-600">{pdfError}</p>
      </div>

      {/* Restrictions */}
      <div className="space-y-3 border-t border-border/50 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Restrictions</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The restrictions this warband satisfies for item availability.
            </p>
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2">
              {isRestrictionsEditing ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIsRestrictionsEditing(false)
                      setSelectedRestrictions(warband.restrictions ?? [])
                      setRestrictionsError("")
                    }}
                    disabled={isRestrictionsSaving}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" className="min-w-[4.5rem]" onClick={handleSaveRestrictions} disabled={isRestrictionsSaving}>
                    {isRestrictionsSaving ? "Saving..." : "Save"}
                  </Button>
                </>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setIsRestrictionsEditing(true)}>
                  Edit
                </Button>
              )}
            </div>
          ) : null}
        </div>

        {isRestrictionsEditing ? (
          <>
            {selectedRestrictions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedRestrictions.map((r) => (
                  <div
                    key={r.id}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/60 bg-primary/20 px-2.5 py-0.5 text-sm"
                  >
                    <span>{r.restriction}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRestriction(r.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <RestrictionPicker
                restrictions={allRestrictions}
                selected={selectedIds}
                onToggle={handleToggleRestriction}
              />
            </div>
          </>
        ) : displayRestrictions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {displayRestrictions.map((r) => (
              <div
                key={r.id}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm"
              >
                <span>{r.restriction}</span>
                <span className="text-xs text-muted-foreground">({r.type})</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No restrictions set.</p>
        )}

        <p className="min-h-[1.25rem] text-sm text-emerald-400">{restrictionsMessage}</p>
        <p className="min-h-[1.25rem] text-sm text-red-600">{restrictionsError}</p>
      </div>
    </CardBackground>
  )
}
