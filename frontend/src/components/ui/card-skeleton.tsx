import { cn } from "@/lib/utils"

type CardSkeletonProps = {
  count?: number
  className?: string
  columns?: 1 | 2 | 3
}

export function CardSkeleton({
  count = 4,
  className,
  columns = 2,
}: CardSkeletonProps) {
  const gridClass = {
    1: "grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
  }[columns]

  return (
    <div className={cn("grid gap-6", gridClass, className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-[0_12px_24px_rgba(5,20,24,0.3)]"
        >
          <div className="space-y-4">
            <div
              className="h-5 animate-pulse rounded bg-muted-foreground/20"
              style={{
                width: `${50 + Math.random() * 30}%`,
                animationDelay: `${index * 100}ms`,
              }}
            />
            <div className="space-y-2">
              <div
                className="h-3 animate-pulse rounded bg-muted-foreground/15"
                style={{
                  width: `${70 + Math.random() * 25}%`,
                  animationDelay: `${index * 100 + 50}ms`,
                }}
              />
              <div
                className="h-3 animate-pulse rounded bg-muted-foreground/15"
                style={{
                  width: `${40 + Math.random() * 30}%`,
                  animationDelay: `${index * 100 + 100}ms`,
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

type ListSkeletonProps = {
  count?: number
  className?: string
}

export function ListSkeleton({
  count = 4,
  className,
}: ListSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-[0_12px_24px_rgba(5,20,24,0.3)]"
        >
          <div className="space-y-3">
            <div
              className="h-4 animate-pulse rounded bg-muted-foreground/20"
              style={{
                width: `${30 + Math.random() * 25}%`,
                animationDelay: `${index * 100}ms`,
              }}
            />
            <div className="space-y-2">
              <div
                className="h-3 animate-pulse rounded bg-muted-foreground/15"
                style={{
                  width: `${80 + Math.random() * 15}%`,
                  animationDelay: `${index * 100 + 50}ms`,
                }}
              />
              <div
                className="h-3 animate-pulse rounded bg-muted-foreground/15"
                style={{
                  width: `${50 + Math.random() * 30}%`,
                  animationDelay: `${index * 100 + 100}ms`,
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

type RosterSkeletonProps = {
  rows?: number
  className?: string
}

export function RosterSkeleton({
  rows = 5,
  className,
}: RosterSkeletonProps) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-[0_18px_32px_rgba(5,20,24,0.35)]", className)}>
      <table className="w-full table-fixed text-left text-sm text-foreground">
        <colgroup>
          <col className="w-[35%]" />
          <col className="w-[25%]" />
          <col className="w-[15%]" />
          <col className="w-[15%]" />
          <col className="w-[10%]" />
        </colgroup>
        <tbody>
          {Array.from({ length: rows }).map((_, index) => (
            <tr
              key={index}
              className="border-b border-border/40 bg-background/30"
            >
              <td className="px-3 py-3 align-middle sm:px-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-muted-foreground/20" style={{ animationDelay: `${index * 100}ms` }} />
                  <div
                    className="h-4 animate-pulse rounded bg-muted-foreground/20"
                    style={{
                      width: `${50 + (index % 3) * 15}%`,
                      animationDelay: `${index * 100 + 50}ms`,
                    }}
                  />
                </div>
              </td>
              <td className="px-3 py-3 align-middle sm:px-4">
                <div
                  className="h-4 animate-pulse rounded bg-muted-foreground/15"
                  style={{
                    width: `${55 + (index % 4) * 10}%`,
                    animationDelay: `${index * 100 + 100}ms`,
                  }}
                />
              </td>
              <td className="px-3 py-3 align-middle sm:px-4">
                <div
                  className="h-4 animate-pulse rounded bg-muted-foreground/15"
                  style={{
                    width: `${50 + (index % 3) * 15}%`,
                    animationDelay: `${index * 100 + 150}ms`,
                  }}
                />
              </td>
              <td className="px-3 py-3 align-middle sm:px-4">
                <div
                  className="h-4 animate-pulse rounded bg-muted-foreground/15"
                  style={{
                    width: `${45 + (index % 4) * 12}%`,
                    animationDelay: `${index * 100 + 200}ms`,
                  }}
                />
              </td>
              <td className="px-3 py-3 align-middle sm:px-4">
                <div
                  className="ml-auto h-7 w-full animate-pulse rounded-xl bg-muted-foreground/15"
                  style={{ animationDelay: `${index * 100 + 250}ms` }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
