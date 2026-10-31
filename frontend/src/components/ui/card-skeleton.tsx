import { cn } from "@/lib/utils";

type CardSkeletonProps = {
  count?: number;
  className?: string;
  columns?: 1 | 2 | 3;
};

// Fixed bar widths, so the placeholders don't jump between renders.
const WIDTHS = [
  ["62%", "88%", "54%"],
  ["48%", "76%", "40%"],
  ["70%", "92%", "61%"],
  ["55%", "81%", "47%"],
];

/** Cards still loading (design E): square bars in the line colour, pulsing. */
export function CardSkeleton({ count = 4, className, columns = 2 }: CardSkeletonProps) {
  const gridClass = {
    1: "grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
  }[columns];

  return (
    <div className={cn("grid gap-4", gridClass, className)}>
      {Array.from({ length: count }).map((_, index) => {
        const [title, line, short] = WIDTHS[index % WIDTHS.length];
        return (
          <div key={index} className="flex flex-col gap-4 border border-border bg-surface p-5">
            {[
              { width: title, height: "h-5" },
              { width: line, height: "h-3" },
              { width: short, height: "h-3" },
            ].map((bar, row) => (
              <div
                key={row}
                className={cn("animate-pulse bg-line", bar.height)}
                style={{ width: bar.width, animationDelay: `${index * 100 + row * 50}ms` }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
