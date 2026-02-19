import { Fragment, useState } from "react"
import type { CSSProperties, ReactNode } from "react"

import { ImageScrollArea } from "@components/image-scroll-area"
import CollapsibleSection from "@/components/ui/collapsible-section"
import { ChevronDown } from "lucide-react"

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
  isMobile?: boolean
}

function DescriptionCollapsible({ description }: { description?: string | null }) {
  const [open, setOpen] = useState(false)
  return (
    <CollapsibleSection
      title="Description"
      collapsed={!open}
      onToggle={() => setOpen((o) => !o)}
    >
      <p className="text-xs text-muted-foreground">
        {description?.trim() || "No description available."}
      </p>
    </CollapsibleSection>
  )
}

export default function ItemsTable({
  items,
  columns,
  rowBackground,
  expandedItemIds,
  onToggleItem,
  isMobile,
}: ItemsTableProps) {
  if (isMobile) {
    const nameCol = columns.find((c) => c.key === "name")
    const priceCol = columns.find((c) => c.key === "price")
    const buttonsCol = columns.find((c) => c.key === "buttons")
    const detailCols = columns.filter(
      (c) => !["name", "price", "buttons"].includes(c.key) && c.label.trim()
    )

    return (
      <ImageScrollArea className="table-scroll table-scroll--full flex-1 min-h-0">
        <table className="min-w-full table-fixed divide-y border border-border/60 text-xs">
          <thead className="bg-black text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2 text-left font-semibold">
                <span className="sr-only">Expand</span>
              </th>
              <th className="px-2 py-2 text-left font-semibold">Name</th>
              <th className="w-[18%] px-2 py-2 text-left font-semibold">Price</th>
              <th className="w-[22%] px-2 py-2 text-left font-semibold"></th>
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
                    <td className="px-2 py-2">
                      <ChevronDown
                        className={[
                          "h-4 w-4 transition-transform",
                          isExpanded ? "rotate-0 text-foreground" : "-rotate-90 text-muted-foreground",
                        ].join(" ")}
                        aria-hidden="true"
                      />
                    </td>
                    <td className="px-2 py-2 font-medium text-foreground">
                      {nameCol?.render(item) ?? item.name}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {priceCol?.render(item) ?? "-"}
                    </td>
                    <td
                      className="px-2 py-2 whitespace-nowrap"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {buttonsCol?.render(item)}
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="bg-background/50">
                      <td colSpan={4} className="px-4 py-3">
                        <div className="flex flex-col gap-3">
                          {detailCols.map((col) => (
                            <div key={col.key} className="flex gap-2 text-sm">
                              <span className="w-24 shrink-0 text-xs text-muted-foreground">
                                {col.label}
                              </span>
                              <span>{col.render(item)}</span>
                            </div>
                          ))}
                          <DescriptionCollapsible description={item.description} />
                        </div>
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
