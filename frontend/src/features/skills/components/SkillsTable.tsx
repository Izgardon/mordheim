import type { ReactNode } from "react";

import CatalogueTable from "@/features/catalogue/components/CatalogueTable";

import type { Skill } from "../types/skill-types";

type SkillsTableProps = {
  skills: Skill[];
  renderActions: (skill: Skill) => ReactNode;
  isMobile?: boolean;
};

const formatType = (skill: Skill) => skill.type.replace(/_/g, " ");

/** The Skills page's table: name, list, description and the row's actions. */
export default function SkillsTable({ skills, renderActions, isMobile }: SkillsTableProps) {
  return (
    <CatalogueTable
      rows={skills}
      getRowId={(skill) => String(skill.id)}
      isMobile={isMobile}
      columns={[
        {
          key: "name",
          label: "Name",
          headerClassName: "w-[20%]",
          render: (skill) => <span className="font-medium text-foreground">{skill.name}</span>,
        },
        { key: "type", label: "Type", headerClassName: "w-[15%]", render: formatType },
        {
          key: "description",
          label: "Description",
          headerClassName: "w-[55%]",
          render: (skill) => skill.description,
        },
        {
          key: "actions",
          label: "",
          headerClassName: "w-[10%]",
          cellClassName: "whitespace-nowrap",
          render: renderActions,
        },
      ]}
      mobile={{
        name: (skill) => skill.name,
        second: { label: "Type", className: "w-[30%]", render: formatType },
        actions: renderActions,
        details: (skill) => skill.description?.trim() || "No description available.",
        detailsClassName: "text-sm text-foreground/90",
      }}
    />
  );
}
