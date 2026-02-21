import { Fragment } from "react"
import type { CSSProperties, ReactNode } from "react"

import { ImageScrollArea } from "@components/image-scroll-area"
import { ChevronDown } from "lucide-react"

import type { Item } from "../types/item-types"

type ColumnConfig<T extends Item = Item> = {
  key: string
  label: string
  headerClassName?: string
  cellClassName?: string
  render: (item: T) => ReactNode
}

type ItemsTableProps<T extends Item = Item> = {
  items: T[]
  columns: ColumnConfig<T>[]
  rowBackground: CSSProperties
  expandedItemIds: number[]
  onToggleItem: (itemId: number) => void
}

export default function ItemsTable<T extends Item>({
  items,
  columns,
  rowBackground,
  expandedItemIds,
  onToggleItem,
}: ItemsTableProps<T>) {
  return (
    <ImageScrollArea className="table-scroll table-scroll--full flex-1 min-h-0">
      <table className="min-w-full table-fixed border border-border/60 text-xs md:text-sm">
        <thead className="bg-black text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground md:text-xs">
          <tr>
            <th className="w-10 px-2 py-2 text-left font-semibold md:px-4 md:py-3">
              <span className="sr-only">Expand</span>
            </th>
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
        <tbody>
          {items.map((item, index) => {
            const isExpanded = expandedItemIds.includes(item.id)
            const bgStyle = {
              ...rowBackground,
              backgroundImage:
                index % 2 === 0
                  ? `linear-gradient(rgba(255,255,255,0.02), rgba(255,255,255,0.02)), ${rowBackground.backgroundImage}`
                  : `linear-gradient(rgba(255,255,255,0.05), rgba(255,255,255,0.05)), ${rowBackground.backgroundImage}`,
            }

            return (
              <Fragment key={`${item.id}-${index}`}>
                <tr
                  className="cursor-pointer border-t border-border/60 transition-[filter] hover:brightness-110"
                  style={bgStyle}
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
                  <td className="px-2 py-2 md:px-4 md:py-3">
                    <ChevronDown
                      className={[
                        "h-4 w-4 transition-transform",
                        isExpanded ? "rotate-0 text-foreground" : "-rotate-90 text-muted-foreground",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-hidden="true"
                    />
                  </td>
                  {columns.map((column) => (
                    <td
                      key={`${item.id}-${column.key}-${index}`}
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
                  <tr className="border-t border-border/60 bg-background/50">
                    <td
                      colSpan={columns.length + 1}
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
