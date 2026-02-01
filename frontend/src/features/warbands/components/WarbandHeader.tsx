import { HeaderFrame } from "@components/header-frame"
import TabSwitcher from "@components/tab-switcher"
import { Tooltip } from "@components/tooltip"

import headerFrame from "@/assets/containers/header.png"
import greedIcon from "@/assets/icons/greed.png"
import fightIcon from "@/assets/icons/Fight.png"

import type { Warband } from "../types/warband-types"

type WarbandHeaderProps = {
  warband: Warband | null
  goldCrowns?: number
  rating?: number
  tabs?: { id: string; label: string; disabled?: boolean }[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
}

export default function WarbandHeader({
  warband,
  goldCrowns,
  rating,
  tabs,
  activeTab,
  onTabChange,
}: WarbandHeaderProps) {
  if (warband) {
    const showTabs = Boolean(tabs && activeTab && onTabChange)

    return (
      <header>
        <HeaderFrame
          frameSrc={headerFrame}
          tabs={
            showTabs ? (
              <TabSwitcher
                tabs={tabs!}
                activeTab={activeTab!}
                onTabChange={onTabChange!}
              />
            ) : null
          }
          tabsClassName="max-w-[95%]"
        >
          <div className="flex flex-col items-center gap-2">
            <h1 className="font-display text-lg font-semibold tracking-[0.08em] text-[#e9dcc2] drop-shadow-[0_2px_3px_rgba(6,4,2,0.7)] sm:text-2xl">
              {warband.name}
            </h1>
            <span className="h-px w-16 bg-[#6e5a3b] opacity-80" />
            <p className="text-[0.55rem] uppercase tracking-[0.45em] text-[#c9b48a] sm:text-xs">
              {warband.faction}
            </p>
            <div className="flex items-center gap-4 text-sm font-semibold text-foreground">
              <Tooltip
                trigger={
                  <div className="flex items-center gap-2">
                    <img src={greedIcon} alt="" className="h-4 w-4" />
                    <span>{goldCrowns ?? 0}</span>
                  </div>
                }
                content="Gold coins"
                minWidth={120}
                maxWidth={200}
              />
              <Tooltip
                trigger={
                  <div className="flex items-center gap-2">
                    <img src={fightIcon} alt="" className="h-4 w-4" />
                    <span>{rating ?? 0}</span>
                  </div>
                }
                content="Warband rating"
                minWidth={140}
                maxWidth={200}
              />
            </div>
          </div>
        </HeaderFrame>
      </header>
    )
  }

  return (
    <header className="text-left">
      <h1 className=" text-lg md:text-2xl font-bold" style={{ color: "#a78f79" }}>
        RAISE YOUR BANNER
      </h1>
    </header>
  )
}
