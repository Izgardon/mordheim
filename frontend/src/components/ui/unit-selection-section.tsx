import { useMemo } from "react"
import type { ReactNode } from "react"

import { Label } from "@components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select"

import type { WarbandHero } from "@/features/warbands/types/warband-types"

export type UnitTypeOption = "heroes" | "henchmen" | "hiredswords" | "stash"

type UnitSelectionSectionProps = {
  title?: ReactNode
  description?: ReactNode
  extra?: ReactNode
  unitTypes: UnitTypeOption[]
  selectedUnitType: UnitTypeOption | ""
  selectedUnitId: string
  units: WarbandHero[]
  error?: string
  actions?: ReactNode
  disableUnitTypeSelect?: boolean
  disableUnitSelect?: boolean
  onUnitTypeChange: (value: UnitTypeOption | "") => void
  onUnitIdChange: (value: string) => void
}

const unitTypeLabels: Record<UnitTypeOption, string> = {
  heroes: "Heroes",
  henchmen: "Henchmen",
  hiredswords: "Hired Swords",
  stash: "Warband Stash",
}

const unitSelectLabels: Record<UnitTypeOption, string> = {
  heroes: "Hero",
  henchmen: "Henchmen Group",
  hiredswords: "Hired Sword",
  stash: "Stash",
}

export function UnitSelectionSection({
  title,
  description,
  extra,
  unitTypes,
  selectedUnitType,
  selectedUnitId,
  units,
  error,
  actions,
  disableUnitTypeSelect = false,
  disableUnitSelect = false,
  onUnitTypeChange,
  onUnitIdChange,
}: UnitSelectionSectionProps) {
  const isStash = selectedUnitType === "stash"
  const unitSelectLabel = selectedUnitType
    ? unitSelectLabels[selectedUnitType]
    : "Unit"

  const unitOptions = useMemo(
    () =>
      units.map((unit) => ({
        id: String(unit.id),
        label: `${unit.name ?? "Unnamed"} - ${unit.unit_type ?? "Unknown"}`,
      })),
    [units]
  )

  return (
    <div className="space-y-6 px-2 overflow-visible">
      {title ? <div className="text-center text-lg text-muted-foreground">{title}</div> : null}
      {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Unit Type</Label>
          <Select
            value={selectedUnitType}
            onValueChange={(value) => onUnitTypeChange(value as UnitTypeOption)}
            disabled={disableUnitTypeSelect}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {unitTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {unitTypeLabels[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{unitSelectLabel}</Label>
          <Select
            value={selectedUnitId}
            onValueChange={onUnitIdChange}
            disabled={
              disableUnitSelect || !selectedUnitType || isStash || unitOptions.length === 0
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${unitSelectLabel.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {unitOptions.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {extra ? <div>{extra}</div> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {actions ? <div className="flex justify-end gap-3">{actions}</div> : null}
    </div>
  )
}
