import { useEffect, useState } from "react"

import { Button } from "@components/button"
import { CardBackground } from "@components/card-background"
import { Input } from "@components/input"
import { Label } from "@components/label"
import { NumberInput } from "@components/number-input"
import { normalizeWebUrl } from "@/lib/url-utils"

import { updateWarband } from "@/features/warbands/api/warbands-api"

import type { Warband } from "@/features/warbands/types/warband-types"

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
  const currentMaxUnits = warband.max_units ?? 15

  // Details state
  const [warbandName, setWarbandName] = useState(warband.name)
  const [maxUnits, setMaxUnits] = useState(String(currentMaxUnits))
  const [isDetailsEditing, setIsDetailsEditing] = useState(false)
  const [isDetailsSaving, setIsDetailsSaving] = useState(false)
  const [detailsError, setDetailsError] = useState("")
  const [detailsMessage, setDetailsMessage] = useState("")

  useEffect(() => {
    setWarbandName(warband.name)
  }, [warband.name])

  useEffect(() => {
    setMaxUnits(String(currentMaxUnits))
  }, [currentMaxUnits])

  const parsedMaxUnits = Number(maxUnits)
  const hasDetailsChanged =
    warbandName.trim() !== warband.name || parsedMaxUnits !== currentMaxUnits

  const handleSaveDetails = async () => {
    const trimmedName = warbandName.trim()

    if (!trimmedName) {
      setDetailsError("Warband name is required.")
      return
    }

    if (!Number.isInteger(parsedMaxUnits) || parsedMaxUnits < 1) {
      setDetailsError("Max limit must be a whole number of at least 1.")
      return
    }

    setIsDetailsSaving(true)
    setDetailsError("")
    setDetailsMessage("")

    try {
      const updated = await updateWarband(warband.id, {
        name: trimmedName,
        max_units: parsedMaxUnits,
      })
      onWarbandUpdated({
        ...warband,
        name: updated.name,
        max_units: updated.max_units,
      })
      setIsDetailsEditing(false)
      setDetailsMessage("Warband details updated.")
      setTimeout(() => setDetailsMessage(""), 3000)
    } catch (saveError) {
      setDetailsError(saveError instanceof Error ? saveError.message : "Unable to save warband details.")
    } finally {
      setIsDetailsSaving(false)
    }
  }

  // Link state
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
      const normalizedUrl = normalizeWebUrl(pdfUrl)
      const updated = await updateWarband(warband.id, { warband_link: normalizedUrl || null })
      onWarbandUpdated({ ...warband, warband_link: updated.warband_link })
      setIsPdfEditing(false)
      setPdfMessage("Warband link updated.")
      setTimeout(() => setPdfMessage(""), 3000)
    } catch (saveError) {
      setPdfError(saveError instanceof Error ? saveError.message : "Unable to save warband link.")
    } finally {
      setIsPdfSaving(false)
    }
  }

  return (
    <CardBackground className="space-y-2 p-3 bg-[rgba(12,9,6,0.92)] sm:space-y-2.5 sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">Warband Settings</h3>

      <section aria-label="Warband details" className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Warband</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Update your warband name and maximum unit limit.
            </p>
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2">
              {isDetailsEditing ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIsDetailsEditing(false)
                      setWarbandName(warband.name)
                      setMaxUnits(String(currentMaxUnits))
                      setDetailsError("")
                    }}
                    disabled={isDetailsSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="min-w-[4.5rem]"
                    onClick={handleSaveDetails}
                    disabled={isDetailsSaving || !hasDetailsChanged}
                  >
                    {isDetailsSaving ? "Saving..." : "Save"}
                  </Button>
                </>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setIsDetailsEditing(true)}>
                  Edit
                </Button>
              )}
            </div>
          ) : null}
        </div>

        {isDetailsEditing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="warband-settings-name" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Warband Name
              </Label>
              <Input
                id="warband-settings-name"
                value={warbandName}
                onChange={(event) => setWarbandName(event.target.value)}
                placeholder="Ashen Crows"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="warband-settings-max-units" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Max Limit
              </Label>
              <NumberInput
                id="warband-settings-max-units"
                min={1}
                value={maxUnits}
                onChange={(event) => setMaxUnits(event.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2">
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                Warband Name
              </p>
              <p className="mt-1 text-sm text-foreground">{warband.name}</p>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2">
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                Max Limit
              </p>
              <p className="mt-1 text-sm text-foreground">{currentMaxUnits}</p>
            </div>
          </div>
        )}

        {detailsMessage && <p className="min-h-[1.25rem] text-sm text-emerald-400">{detailsMessage}</p>}
        {detailsError && <p className="min-h-[1.25rem] text-sm text-red-600">{detailsError}</p>}
      </section>

      {/* Warband link */}
      <section aria-label="Warband link" className="space-y-1.5 border-t border-border/50 pt-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Warband Link</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Link to your warband roster, sheet, or any web page for easy sharing.
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
          <p className="text-sm text-muted-foreground">No warband link set.</p>
        )}
        {pdfMessage && <p className="min-h-[1.25rem] text-sm text-emerald-400">{pdfMessage}</p>}
        {pdfError && <p className="min-h-[1.25rem] text-sm text-red-600">{pdfError}</p>}
        <p className="mt-0.5 text-xs text-muted-foreground">
          If using a google drive link, make sure it is set to "Anyone with the link can view". Google docs links will not work well on mobile.
        </p>
      </section>

    </CardBackground>
  )
}
