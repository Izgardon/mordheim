import { cn } from "@/lib/utils"

type HeroCardSkeletonProps = {
  count?: number
  className?: string
}

export function HeroCardSkeleton({
  count = 4,
  className,
}: HeroCardSkeletonProps) {
  return (
    <div
      className={cn(
        "grid gap-5",
        "grid-cols-[repeat(auto-fit,minmax(350px,600px))]",
        className
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-lg p-6"
          style={{
            backgroundColor: "hsl(30 20% 12%)",
            animationDelay: `${index * 100}ms`,
          }}
        >
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div
                  className="h-5 rounded"
                  style={{
                    width: `${40 + Math.random() * 30}%`,
                    backgroundColor: "hsl(30 18% 18%)",
                  }}
                />
                <div
                  className="h-3 rounded"
                  style={{
                    width: `${20 + Math.random() * 15}%`,
                    backgroundColor: "hsl(30 15% 16%)",
                  }}
                />
              </div>
            </div>

            {/* Stats table skeleton */}
            <div className="rounded-lg p-2" style={{ backgroundColor: "hsl(30 15% 10%)" }}>
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: 10 }).map((_, statIndex) => (
                  <div key={statIndex} className="text-center space-y-1">
                    <div
                      className="h-3 mx-auto rounded"
                      style={{
                        width: "80%",
                        backgroundColor: "hsl(30 15% 16%)",
                      }}
                    />
                    <div
                      className="h-4 mx-auto rounded"
                      style={{
                        width: "60%",
                        backgroundColor: "hsl(30 18% 18%)",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment/skills section */}
            <div className="space-y-2">
              <div
                className="h-3 rounded"
                style={{
                  width: `${60 + Math.random() * 30}%`,
                  backgroundColor: "hsl(30 15% 16%)",
                }}
              />
              <div
                className="h-3 rounded"
                style={{
                  width: `${40 + Math.random() * 25}%`,
                  backgroundColor: "hsl(30 15% 16%)",
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
