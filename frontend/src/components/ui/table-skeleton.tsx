import { cn } from "@/lib/utils"

type TableSkeletonProps = {
  columns: number
  rows?: number
  columnWidths?: string[]
  className?: string
}

export function TableSkeleton({
  columns,
  rows = 8,
  columnWidths,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn("flex-1 min-h-0 overflow-hidden", className)}>
      <table className="min-w-full table-fixed border border-border/60 text-sm">
        <thead className="bg-black text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th
                key={index}
                className={cn(
                  "px-4 py-3 text-left font-semibold",
                  columnWidths?.[index]
                )}
              >
                <div className="h-3 w-16 animate-pulse rounded bg-muted-foreground/20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="bg-transparent">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td
                  key={colIndex}
                  className={cn(
                    "px-4 py-3",
                    columnWidths?.[colIndex]
                  )}
                >
                  <div
                    className="h-4 animate-pulse rounded bg-muted-foreground/15"
                    style={{
                      width: `${60 + Math.random() * 30}%`,
                      animationDelay: `${(rowIndex * columns + colIndex) * 50}ms`,
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
