import type { CSSProperties, ReactNode } from "react"

import { ImageScrollArea } from "@components/image-scroll-area"

import type { Skill } from "../types/skill-types"

type SkillsTableProps = {
  skills: Skill[]
  rowBackground: CSSProperties
  renderActions: (skill: Skill) => ReactNode
}

export default function SkillsTable({
  skills,
  rowBackground,
  renderActions,
}: SkillsTableProps) {
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
