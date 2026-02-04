import { Fragment } from "react"
import type { CSSProperties, ReactNode } from "react"

import { ImageScrollArea } from "@components/image-scroll-area"

import type { Item } from "../types/item-types"

type ColumnConfig = {
  key: string
  label: string
  headerClassName?: string
  cellClassName?: string
  render: (item: Item) => ReactNode
}

type ItemsTableProps = {
  items: Item[]
  columns: ColumnConfig[]
  rowBackground: CSSProperties
  expandedItemIds: number[]
  onToggleItem: (itemId: number) => void
}

export default function ItemsTable({
  items,
  columns,
  rowBackground,
  expandedItemIds,
  onToggleItem,
}: ItemsTableProps) {
  return (
    <ImageScrollArea className="table-scroll table-scroll--full flex-1 min-h-0">
      <table className="min-w-full table-fixed border border-border/60 text-xs md:text-sm">
        <thead className="bg-black text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground md:text-xs">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={[
                  "px-2 py-2 text-left font-semibold md:px-4 md:py-3",
                  column.headerClassName ?? "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {items.map((item, index) => {
            const isExpanded = expandedItemIds.includes(item.id)
            return (
              <Fragment key={item.id}>
                <tr
                  className="cursor-pointer transition-[filter] hover:brightness-110"
                  style={{
                    ...rowBackground,
                    backgroundImage:
                      index % 2 === 0
                        ? `linear-gradient(rgba(255,255,255,0.02), rgba(255,255,255,0.02)), ${rowBackground.backgroundImage}`
                        : `linear-gradient(rgba(255,255,255,0.05), rgba(255,255,255,0.05)), ${rowBackground.backgroundImage}`,
                  }}
                  onClick={() => onToggleItem(item.id)}
                  role="button"
                  aria-expanded={isExpanded}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onToggleItem(item.id)
                    }
                  }}
                >
                  {columns.map((column) => (
                    <td
                      key={`${item.id}-${column.key}`}
                      className={[
                        "px-2 py-2 text-muted-foreground md:px-4 md:py-3",
                        column.cellClassName ?? "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {column.render(item)}
                    </td>
                  ))}
                </tr>
                {isExpanded ? (
                  <tr className="bg-background/50">
                    <td
                      colSpan={columns.length}
                      className="px-4 py-3 text-sm text-foreground/90"
                    >
                      {item.description?.trim()
                        ? item.description
                        : "No description available."}
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
