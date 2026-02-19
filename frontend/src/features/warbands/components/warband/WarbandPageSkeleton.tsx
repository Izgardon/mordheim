import { cn } from "@/lib/utils"
import headerFrame from "@/assets/containers/header.webp"
import basicBar from "@/assets/containers/basic_bar.webp"

type WarbandPageSkeletonProps = {
  className?: string
  variant?: "default" | "mobile"
}

export function WarbandPageSkeleton({
  className,
  variant = "default",
}: WarbandPageSkeletonProps) {
  if (variant === "mobile") {
    return <MobileWarbandSkeleton className={className} />
  }

  return (
    <div className={cn("min-h-0 space-y-6", className)}>
      <HeaderSkeleton />
      <div className="space-y-6 rounded-2xl border border-border/60 bg-card/70 p-6 shadow-[0_18px_32px_rgba(5,20,24,0.35)]">
        <ResourcesSkeleton />
        <HeroesSectionSkeleton />
        <SectionSkeleton title="HENCHMEN" />
        <SectionSkeleton title="HIRED SWORDS" />
      </div>
    </div>
  )
}

function MobileWarbandSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("min-h-0 space-y-5 px-2", className)}>
      <MobileTabsSkeleton />
      <ResourcesSkeletonMobile />
      <MobileSectionSkeleton title="Heroes" cardCount={2} />
      <MobileSectionSkeleton title="Henchmen" cardCount={2} />
      <MobileSectionSkeleton title="Hired Swords" cardCount={1} />
    </div>
  )
}

function HeaderSkeleton() {
  return (
    <header>
      <div className="flex w-full justify-center">
        <div
          className="flex h-[180px] w-full max-w-[600px] flex-col items-center justify-center gap-2 px-1 pt-10 text-center"
          style={{
            backgroundImage: `url(${headerFrame})`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        >
          <div className="flex flex-col items-center gap-2">
            {/* Warband name skeleton */}
            <div
              className="h-7 w-48 animate-pulse rounded"
              style={{ backgroundColor: "hsl(30 18% 20%)" }}
            />
            {/* Divider */}
            <span className="h-px w-16 bg-[#6e5a3b] opacity-80" />
            {/* Faction skeleton */}
            <div
              className="h-3 w-24 animate-pulse rounded"
              style={{
                backgroundColor: "hsl(30 15% 18%)",
                animationDelay: "100ms",
              }}
            />
            {/* Stats row skeleton */}
            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-2">
                <div
                  className="h-4 w-4 animate-pulse rounded"
                  style={{
                    backgroundColor: "hsl(30 15% 18%)",
                    animationDelay: "150ms",
                  }}
                />
                <div
                  className="h-4 w-8 animate-pulse rounded"
                  style={{
                    backgroundColor: "hsl(30 15% 18%)",
                    animationDelay: "200ms",
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="h-4 w-4 animate-pulse rounded"
                  style={{
                    backgroundColor: "hsl(30 15% 18%)",
                    animationDelay: "250ms",
                  }}
                />
                <div
                  className="h-4 w-8 animate-pulse rounded"
                  style={{
                    backgroundColor: "hsl(30 15% 18%)",
                    animationDelay: "300ms",
                  }}
                />
              </div>
              <div
                className="h-5 w-5 animate-pulse rounded"
                style={{
                  backgroundColor: "hsl(30 15% 18%)",
                  animationDelay: "350ms",
                }}
              />
            </div>
          </div>
          {/* Tabs skeleton */}
          <div className="mt-auto mb-8 flex w-full max-w-[85%] justify-center gap-2 pb-0.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-8 w-20 animate-pulse rounded"
                style={{
                  backgroundColor: "hsl(30 15% 15%)",
                  animationDelay: `${400 + index * 50}ms`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}

function MobileTabsSkeleton() {
  return (
    <div className="scrollbar-hidden w-full overflow-x-auto">
      <div className="flex min-w-max items-center gap-2 px-2 pb-2 pt-1">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-8 w-20 animate-pulse rounded-full"
            style={{
              backgroundColor: "hsl(30 15% 16%)",
              animationDelay: `${index * 60}ms`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function ResourcesSkeleton() {
  return (
    <div
      className="flex w-full flex-wrap items-start justify-between gap-3 rounded-lg px-4 py-2"
      style={{
        backgroundImage: `url(${basicBar})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        boxShadow: "0 32px 50px rgba(6, 3, 2, 0.55)",
      }}
    >
      <div className="flex w-full flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-start gap-10 px-8 py-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-1 px-4 py-2"
            >
              {/* Resource name */}
              <div
                className="h-3 w-16 animate-pulse rounded"
                style={{
                  backgroundColor: "hsl(30 15% 16%)",
                  animationDelay: `${index * 100}ms`,
                }}
              />
              {/* Resource value box */}
              <div
                className="mt-1 h-12 w-16 animate-pulse rounded"
                style={{
                  backgroundColor: "hsl(30 18% 14%)",
                  animationDelay: `${index * 100 + 50}ms`,
                }}
              />
            </div>
          ))}
        </div>
        {/* Edit button skeleton */}
        <div
          className="ml-auto h-8 w-28 animate-pulse rounded"
          style={{
            backgroundColor: "hsl(30 15% 16%)",
            animationDelay: "350ms",
          }}
        />
      </div>
    </div>
  )
}

function ResourcesSkeletonMobile() {
  return (
    <div className="space-y-3 px-2">
      <div className="flex items-center justify-between gap-3">
        <div
          className="h-4 w-28 animate-pulse rounded"
          style={{ backgroundColor: "hsl(30 18% 18%)" }}
        />
        <div
          className="h-8 w-8 animate-pulse rounded-full"
          style={{ backgroundColor: "hsl(30 15% 16%)" }}
        />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-black/30 px-3 py-2"
          >
            <div className="space-y-1">
              <div
                className="h-3 w-20 animate-pulse rounded"
                style={{
                  backgroundColor: "hsl(30 15% 16%)",
                  animationDelay: `${index * 100}ms`,
                }}
              />
              <div
                className="h-5 w-12 animate-pulse rounded"
                style={{
                  backgroundColor: "hsl(30 18% 18%)",
                  animationDelay: `${index * 100 + 50}ms`,
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-7 w-7 animate-pulse rounded-full"
                style={{
                  backgroundColor: "hsl(30 15% 16%)",
                  animationDelay: `${index * 100 + 100}ms`,
                }}
              />
              <div
                className="h-7 w-7 animate-pulse rounded-full"
                style={{
                  backgroundColor: "hsl(30 15% 16%)",
                  animationDelay: `${index * 100 + 150}ms`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function HeroesSectionSkeleton() {
  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div
          className="h-4 w-20 animate-pulse rounded"
          style={{ backgroundColor: "hsl(30 18% 18%)" }}
        />
        <div
          className="h-8 w-24 animate-pulse rounded"
          style={{
            backgroundColor: "hsl(30 15% 16%)",
            animationDelay: "50ms",
          }}
        />
      </div>
      {/* Hero cards grid */}
      <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(350px,600px))]">
        {Array.from({ length: 4 }).map((_, index) => (
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
                <div className="flex-1 space-y-2">
                  <div
                    className="h-5 rounded"
                    style={{
                      width: `${40 + (index % 3) * 15}%`,
                      backgroundColor: "hsl(30 18% 18%)",
                    }}
                  />
                  <div
                    className="h-3 rounded"
                    style={{
                      width: `${20 + (index % 2) * 10}%`,
                      backgroundColor: "hsl(30 15% 16%)",
                    }}
                  />
                </div>
              </div>
              {/* Stats table skeleton */}
              <div
                className="rounded-lg p-2"
                style={{ backgroundColor: "hsl(30 15% 10%)" }}
              >
                <div className="grid grid-cols-10 gap-1">
                  {Array.from({ length: 10 }).map((_, statIndex) => (
                    <div key={statIndex} className="space-y-1 text-center">
                      <div
                        className="mx-auto h-3 rounded"
                        style={{
                          width: "80%",
                          backgroundColor: "hsl(30 15% 16%)",
                        }}
                      />
                      <div
                        className="mx-auto h-4 rounded"
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
                    width: `${60 + (index % 2) * 20}%`,
                    backgroundColor: "hsl(30 15% 16%)",
                  }}
                />
                <div
                  className="h-3 rounded"
                  style={{
                    width: `${40 + (index % 3) * 10}%`,
                    backgroundColor: "hsl(30 15% 16%)",
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type MobileSectionSkeletonProps = {
  title: string
  cardCount: number
}

function MobileSectionSkeleton({ title, cardCount }: MobileSectionSkeletonProps) {
  return (
    <div className="space-y-4 px-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-3xl font-bold" style={{ color: "#a78f79" }}>
            {title}
          </h2>
          <div
            className="h-3 w-10 animate-pulse rounded"
            style={{ backgroundColor: "hsl(30 15% 16%)" }}
          />
        </div>
        <div
          className="h-8 w-8 animate-pulse rounded-full"
          style={{ backgroundColor: "hsl(30 15% 16%)" }}
        />
      </div>
      <div className="space-y-4">
        {Array.from({ length: cardCount }).map((_, index) => (
          <MobileUnitCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}

function MobileUnitCardSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-[#6e5a3b]/45 bg-black/60 p-4">
      <div className="space-y-2">
        <div
          className="h-4 w-40 animate-pulse rounded"
          style={{ backgroundColor: "hsl(30 18% 18%)" }}
        />
        <div
          className="h-3 w-24 animate-pulse rounded"
          style={{ backgroundColor: "hsl(30 15% 16%)" }}
        />
      </div>
      <div className="rounded-lg border border-border/40 bg-black/40 p-2">
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }).map((_, statIndex) => (
            <div key={statIndex} className="space-y-1 text-center">
              <div
                className="mx-auto h-2 w-3/4 animate-pulse rounded"
                style={{ backgroundColor: "hsl(30 15% 16%)" }}
              />
              <div
                className="mx-auto h-3 w-2/3 animate-pulse rounded"
                style={{ backgroundColor: "hsl(30 18% 18%)" }}
              />
            </div>
          ))}
        </div>
      </div>
      <div
        className="h-2 w-full animate-pulse rounded"
        style={{ backgroundColor: "hsl(30 15% 16%)" }}
      />
      <div className="space-y-2">
        <div
          className="h-3 w-4/5 animate-pulse rounded"
          style={{ backgroundColor: "hsl(30 15% 16%)" }}
        />
        <div
          className="h-3 w-3/5 animate-pulse rounded"
          style={{ backgroundColor: "hsl(30 15% 16%)" }}
        />
      </div>
      <div
        className="mx-auto h-8 w-8 animate-pulse rounded-full"
        style={{ backgroundColor: "hsl(30 15% 16%)" }}
      />
    </div>
  )
}

type SectionSkeletonProps = {
  title: string
}

function SectionSkeleton({ title }: SectionSkeletonProps) {
  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <h2 className="text-sm font-bold" style={{ color: "#a78f79" }}>
        {title}
      </h2>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="h-16 w-48 animate-pulse rounded-lg"
            style={{
              backgroundColor: "hsl(30 15% 12%)",
              animationDelay: `${index * 100}ms`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

