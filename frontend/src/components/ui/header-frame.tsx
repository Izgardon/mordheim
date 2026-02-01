import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import headerNoTabs from "@/assets/containers/header_no_tabs.png"

type HeaderFrameProps = {
  frameSrc: string
  children: ReactNode
  tabs?: ReactNode
  className?: string
  contentClassName?: string
  tabsClassName?: string
}

export function HeaderFrame({
  frameSrc,
  children,
  tabs,
  className,
  contentClassName,
  tabsClassName,
}: HeaderFrameProps) {
  const hasTabs = Boolean(tabs)
  const resolvedFrame = hasTabs ? frameSrc : headerNoTabs

  return (
    <div className={cn("flex w-full justify-center", className)}>
      <div
        className={cn(
          "flex w-full max-w-[700px] flex-col items-center gap-2 px-1 text-center",
          hasTabs ? "h-[220px] justify-center pt-10" : "h-[170px] justify-center",
          contentClassName
        )}
        style={{
          backgroundImage: `url(${resolvedFrame})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      >
        {children}
        {tabs ? (
          <div className={cn("mt-auto flex w-full max-w-[85%] justify-center overflow-visible", tabsClassName)}>
            {tabs}
          </div>
        ) : null}
      </div>
    </div>
  )
}
