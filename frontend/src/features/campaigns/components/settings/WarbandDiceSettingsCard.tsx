import { useEffect, useMemo, useState } from "react"

import { Button } from "@components/button"
import { Checkbox } from "@components/checkbox"
import { CardBackground } from "@components/card-background"
import { Input } from "@components/input"
import DiceRoller from "@/components/dice/DiceRoller"
import { useMediaQuery } from "@/lib/use-media-query"

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
  const [colorError, setColorError] = useState("")
  const [isSavingColor, setIsSavingColor] = useState(false)
  const [isSavingLoadout, setIsSavingLoadout] = useState(false)
  const [rollSignal, setRollSignal] = useState(0)

  useEffect(() => {
    const nextColor = warband?.dice_color ?? DEFAULT_DICE_COLOR
    setDiceColor(nextColor)
    setSavedColor(nextColor)
  }, [warband?.dice_color])

  const isValidColor = useMemo(() => HEX_COLOR_REGEX.test(diceColor), [diceColor])
  const hasColorChanges = useMemo(
    () => diceColor.toLowerCase() !== savedColor.toLowerCase(),
    [diceColor, savedColor]
  )

  const previewColor = isValidColor ? diceColor : DEFAULT_DICE_COLOR
  const canEdit = Boolean(
    warband &&
      (warband.user_id === user?.id || ["owner", "admin"].includes(campaignRole ?? ""))
  )

  const handleSaveColor = async () => {
    if (!warband || !canEdit) return
    if (!isValidColor) {
      setColorError("Enter a valid hex color like #2e8555.")
      return
    }
    setIsSavingColor(true)
    setColorError("")
    try {
      const updated = await updateWarband(warband.id, { dice_color: diceColor })
      setWarband({ ...warband, ...updated })
      const nextColor = updated.dice_color ?? diceColor
      setSavedColor(nextColor)
      setDiceColor(nextColor)
    } catch (saveError) {
      setColorError(saveError instanceof Error ? saveError.message : "Unable to save dice color.")
    } finally {
      setIsSavingColor(false)
    }
  }

  const handleToggleLoadout = async () => {
    if (!warband || !canEdit) return
    const next = !(warband.show_loadout_on_mobile ?? false)
    setIsSavingLoadout(true)
    try {
      const updated = await updateWarband(warband.id, { show_loadout_on_mobile: next })
      setWarband({ ...warband, ...updated })
    } catch {
      // silently fail — user can retry
    } finally {
      setIsSavingLoadout(false)
    }
  }

  const isMobile = useMediaQuery("(max-width: 960px)")

  return (
    <CardBackground disableBackground={isMobile} className={isMobile ? "space-y-2 p-3" : "space-y-2.5 p-6"}>
      <h3 className="text-lg font-semibold text-foreground">General Settings</h3>
      {warbandLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="space-y-2">
            <div className="space-y-1.5">
              <div className="h-2.5 w-20 rounded bg-muted-foreground/20" />
              <div className="h-2.5 w-52 rounded bg-muted-foreground/15" />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="h-10 w-14 rounded-md bg-muted-foreground/20" />
              <div className="h-9 w-40 rounded-md bg-muted-foreground/20" />
            </div>
          </div>
          <div className="border-t border-border/50 pt-2.5">
            <div className="h-20 rounded-xl bg-muted-foreground/15" />
          </div>
          <div className="flex items-center justify-between border-t border-border/50 pt-4">
            <div className="space-y-1.5">
              <div className="h-2.5 w-36 rounded bg-muted-foreground/20" />
              <div className="h-2.5 w-64 rounded bg-muted-foreground/15" />
            </div>
            <div className="h-4 w-4 rounded bg-muted-foreground/20" />
          </div>
        </div>
      ) : warbandError ? (
        <p className="text-sm text-red-600">{warbandError}</p>
      ) : !warband ? (
        <p className="text-sm text-muted-foreground">
          Create a warband to customise these settings.
        </p>
      ) : (
        <>
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dice colour</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Applies to dice rolls for your warband.
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
              <div className="flex min-w-[220px] flex-1 items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Input
                    value={diceColor}
                    onChange={(event) => setDiceColor(event.target.value)}
                    placeholder="#2e8555"
                    className="max-w-[220px]"
                    disabled={!canEdit}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setRollSignal((prev) => prev + 1)}
                    disabled={isSavingColor || warbandLoading}
                  >
                    Test roll
                  </Button>
                </div>
                <Button
                  size="sm"
                  className="min-w-[4.5rem]"
                  onClick={handleSaveColor}
                  disabled={!canEdit || !hasColorChanges || isSavingColor}
                >
                  {isSavingColor ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
            <p className="min-h-[1.25rem] text-sm text-red-600">{colorError}</p>
            {!canEdit ? (
              <p className="text-xs text-muted-foreground">
                You do not have permission to update this warband.
              </p>
            ) : null}
          </div>

          <div>
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

          <div className="border-t border-border/50 pt-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Show loadout on mobile</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Show the items, skills and spells on default unit cards when on mobile.
                </p>
              </div>
              <Checkbox
                checked={warband.show_loadout_on_mobile ?? false}
                onChange={handleToggleLoadout}
                disabled={!canEdit || isSavingLoadout}
              />
            </div>
          </div>
        </>
      )}
    </CardBackground>
  )
}
