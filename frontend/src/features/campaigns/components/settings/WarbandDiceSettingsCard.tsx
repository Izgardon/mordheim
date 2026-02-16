import { useEffect, useMemo, useState } from "react"

import { Button } from "@components/button"
import { CardBackground } from "@components/card-background"
import { Input } from "@components/input"
import DiceRoller from "@/components/dice/DiceRoller"

// api
import { updateWarband } from "@/features/warbands/api/warbands-api"

// hooks
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAppStore } from "@/stores/app-store"

const DEFAULT_DICE_COLOR = "#2e8555"
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

type WarbandDiceSettingsCardProps = {
  campaignRole?: string | null
}

export default function WarbandDiceSettingsCard({
  campaignRole,
}: WarbandDiceSettingsCardProps) {
  const { user } = useAuth()
  const { warband, warbandLoading, warbandError, setWarband } = useAppStore()
  const [diceColor, setDiceColor] = useState(DEFAULT_DICE_COLOR)
  const [savedColor, setSavedColor] = useState(DEFAULT_DICE_COLOR)
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [rollSignal, setRollSignal] = useState(0)

  useEffect(() => {
    const nextColor = warband?.dice_color ?? DEFAULT_DICE_COLOR
    setDiceColor(nextColor)
    setSavedColor(nextColor)
  }, [warband?.dice_color])

  const isValidColor = useMemo(() => HEX_COLOR_REGEX.test(diceColor), [diceColor])
  const hasChanges = useMemo(
    () => diceColor.toLowerCase() !== savedColor.toLowerCase(),
    [diceColor, savedColor]
  )

  const previewColor = isValidColor ? diceColor : DEFAULT_DICE_COLOR
  const canEdit = Boolean(
    warband &&
      (warband.user_id === user?.id || ["owner", "admin"].includes(campaignRole ?? ""))
  )

  const handleSave = async () => {
    if (!warband || !canEdit) {
      return
    }
    if (!isValidColor) {
      setError("Enter a valid hex color like #2e8555.")
      return
    }

    setIsSaving(true)
    setError("")
    try {
      const updated = await updateWarband(warband.id, { dice_color: diceColor })
      setWarband({ ...warband, ...updated })
      const nextColor = updated.dice_color ?? diceColor
      setSavedColor(nextColor)
      setDiceColor(nextColor)
    } catch (saveError) {
      if (saveError instanceof Error) {
        setError(saveError.message)
      } else {
        setError("Unable to save dice color.")
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <CardBackground className="space-y-6 p-6">
      <h3 className="text-lg font-semibold text-foreground">Dice Settings</h3>
        {warbandLoading ? (
          <p className="text-sm text-muted-foreground">Loading warband...</p>
        ) : warbandError ? (
          <p className="text-sm text-red-600">{warbandError}</p>
        ) : !warband ? (
          <p className="text-sm text-muted-foreground">
            Create a warband to customize dice colors.
          </p>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Warband dice color</h3>
                <p className="text-sm text-muted-foreground">
                  This color applies to dice rolls for your warband.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Color
                  </span>
                  <input
                    type="color"
                    value={previewColor}
                    onChange={(event) => setDiceColor(event.target.value)}
                    className="h-10 w-14 rounded-md border border-border/60 bg-muted/20 p-1 shadow-[0_8px_20px_rgba(5,20,24,0.25)] focus-visible:outline-none focus-visible:shadow-[0_8px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]"
                    aria-label="Warband dice color"
                    disabled={!canEdit}
                  />
                </label>
                <div className="flex min-w-[220px] flex-1 items-center gap-3">
                  <Input
                    value={diceColor}
                    onChange={(event) => setDiceColor(event.target.value)}
                    placeholder="#2e8555"
                    className="max-w-[220px]"
                    disabled={!canEdit}
                  />
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!canEdit || !hasChanges || isSaving}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setRollSignal((prev) => prev + 1)}
                    disabled={!warband || isSaving || warbandLoading}
                  >
                    Test roll
                  </Button>
                </div>
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {!canEdit ? (
                <p className="text-xs text-muted-foreground">
                  You do not have permission to update this warband.
                </p>
              ) : null}
            </div>

            <div className="border-t border-border/50 pt-6">
              <DiceRoller
                mode="fixed"
                fixedNotation="2d6"
                themeColor={previewColor}
                showResultBox={false}
                showRollButton={false}
                rollSignal={rollSignal}
                fullScreen
              />
            </div>
          </>
        )}
    </CardBackground>
  )
}
