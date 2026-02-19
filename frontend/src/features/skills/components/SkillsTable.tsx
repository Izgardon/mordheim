import { Fragment, useState } from "react"
import type { CSSProperties, ReactNode } from "react"

import { ImageScrollArea } from "@components/image-scroll-area"
import { ChevronDown } from "lucide-react"

import type { Skill } from "../types/skill-types"

type SkillsTableProps = {
  skills: Skill[]
  rowBackground: CSSProperties
  renderActions: (skill: Skill) => ReactNode
  isMobile?: boolean
}

export default function SkillsTable({
  skills,
  rowBackground,
  renderActions,
  isMobile,
}: SkillsTableProps) {
  const [expandedIds, setExpandedIds] = useState<number[]>([])

  const toggle = (id: number) =>
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )

  if (isMobile) {
    return (
      <ImageScrollArea className="table-scroll table-scroll--full flex-1 min-h-0">
        <table className="min-w-full table-fixed divide-y border border-border/60 text-xs">
          <thead className="bg-black text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2 text-left font-semibold">
                <span className="sr-only">Expand</span>
              </th>
              <th className="px-2 py-2 text-left font-semibold">Name</th>
              <th className="w-[30%] px-2 py-2 text-left font-semibold">Type</th>
              <th className="w-[22%] px-2 py-2 text-left font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {skills.map((skill, index) => {
              const isExpanded = expandedIds.includes(skill.id)
              return (
                <Fragment key={skill.id}>
                  <tr
                    className="cursor-pointer transition-[filter] hover:brightness-110"
                    style={{
                      ...rowBackground,
                      backgroundImage:
                        index % 2 === 0
                          ? `linear-gradient(rgba(255,255,255,0.02), rgba(255,255,255,0.02)), ${rowBackground.backgroundImage}`
                          : `linear-gradient(rgba(255,255,255,0.05), rgba(255,255,255,0.05)), ${rowBackground.backgroundImage}`,
                    }}
                    onClick={() => toggle(skill.id)}
                    role="button"
                    aria-expanded={isExpanded}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        toggle(skill.id)
                      }
                    }}
                  >
                    <td className="px-2 py-2">
                      <ChevronDown
                        className={[
                          "h-4 w-4 transition-transform",
                          isExpanded ? "rotate-0 text-foreground" : "-rotate-90 text-muted-foreground",
                        ].join(" ")}
                        aria-hidden="true"
                      />
                    </td>
                    <td className="px-2 py-2 font-medium text-foreground">{skill.name}</td>
                    <td className="px-2 py-2 text-muted-foreground">{skill.type.replace(/_/g, " ")}</td>
                    <td
                      className="px-2 py-2 whitespace-nowrap"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {renderActions(skill)}
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="bg-background/50">
                      <td colSpan={4} className="px-4 py-3 text-sm text-foreground/90">
                        {skill.description?.trim() || "No description available."}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </ImageScrollArea>
    )
  }

  return (
    <ImageScrollArea className="table-scroll table-scroll--full flex-1 min-h-0">
      <table className="min-w-full table-fixed divide-y border border-border/60 text-sm">
        <thead className="bg-black text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <tr>
            <th className="w-[20%] px-4 py-3 text-left font-semibold">Name</th>
            <th className="w-[15%] px-4 py-3 text-left font-semibold">Type</th>
            <th className="w-[55%] px-4 py-3 text-left font-semibold">Description</th>
            <th className="w-[10%] px-4 py-3 text-left font-semibold"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {skills.map((skill, index) => (
            <tr
              key={skill.id}
              className="transition-[filter] hover:brightness-110"
              style={{
                ...rowBackground,
                backgroundImage:
                  index % 2 === 0
                    ? `linear-gradient(rgba(255,255,255,0.02), rgba(255,255,255,0.02)), ${rowBackground.backgroundImage}`
                    : `linear-gradient(rgba(255,255,255,0.05), rgba(255,255,255,0.05)), ${rowBackground.backgroundImage}`,
              }}
            >
              <td className="px-4 py-3 font-medium text-foreground">{skill.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{skill.type.replace(/_/g, " ")}</td>
              <td className="px-4 py-3 text-muted-foreground">{skill.description}</td>
              <td className="px-4 py-3 whitespace-nowrap">{renderActions(skill)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ImageScrollArea>
  )
}
