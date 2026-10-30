import { cn } from "@/lib/utils";

type CardSkeletonProps = {
  count?: number;
  className?: string;
  columns?: 1 | 2 | 3;
};

export function CardSkeleton({ count = 4, className, columns = 2 }: CardSkeletonProps) {
  const gridClass = {
    1: "grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
  }[columns];

  return (
    <div className={cn("grid gap-6", gridClass, className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="border border-border bg-surface p-6">
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
  );
}
