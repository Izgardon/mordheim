import type { ReactNode } from "react";

import CatalogueTable from "@/features/catalogue/components/CatalogueTable";
import { EntryBadge } from "@/features/catalogue/components/EntryBadge";

import type { Spell } from "../types/spell-types";

type SpellsTableProps = {
  spells: Spell[];
  renderActions: (spell: Spell) => ReactNode;
  isMobile?: boolean;
};

const formatType = (spell: Spell) => spell.type?.replace(/_/g, " ") || "-";

/** A phone's opened row: the roll, the difficulty and the description. */
function SpellDetails({ spell }: { spell: Spell }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex gap-2">
        <span className="w-20 shrink-0 text-xs text-muted-foreground">D6</span>
        <span className="text-foreground/90">{spell.roll ?? "-"}</span>
      </div>
      <div className="flex gap-2">
        <span className="w-20 shrink-0 text-xs text-muted-foreground">Difficulty</span>
        <span className="text-foreground/90">{spell.dc ?? "-"}</span>
      </div>
      <p className="text-foreground/90">{spell.description || "No description available."}</p>
    </div>
  );
}

/** The Spells page's table: name, class, roll, difficulty, description and the row's actions. */
export default function SpellsTable({ spells, renderActions, isMobile }: SpellsTableProps) {
  return (
    <CatalogueTable
      rows={spells}
      getRowId={(spell) => String(spell.id)}
      isMobile={isMobile}
      columns={[
        {
          key: "name",
          label: "Name",
          headerClassName: "w-[20%]",
          render: (spell) => (
            <span className="font-medium text-foreground">
              {spell.name}
              <EntryBadge entry={spell} />
            </span>
          ),
        },
        { key: "type", label: "Type", headerClassName: "w-[12%]", render: formatType },
        { key: "roll", label: "D6", headerClassName: "w-[8%]", render: (s) => s.roll ?? "-" },
        { key: "dc", label: "Difficulty", headerClassName: "w-[10%]", render: (s) => s.dc ?? "-" },
        {
          key: "description",
          label: "Description",
          headerClassName: "w-[40%]",
          render: (spell) => spell.description || "-",
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
        name: (spell) => (
          <>
            {spell.name}
            <EntryBadge entry={spell} />
          </>
        ),
        second: { label: "Type", className: "w-[30%]", render: formatType },
        actions: renderActions,
        details: (spell) => <SpellDetails spell={spell} />,
      }}
    />
  );
}
