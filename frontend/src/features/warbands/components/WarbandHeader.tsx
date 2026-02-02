import { HeaderFrame } from "@components/header-frame"
import TabSwitcher from "@components/tab-switcher"
import { Tooltip } from "@components/tooltip"

import headerFrame from "@/assets/containers/header.png"
import greedIcon from "@/assets/icons/greed.png"
import fightIcon from "@/assets/icons/Fight.png"
import chestClosedIcon from "@/assets/icons/chest.png"
import chestOpenIcon from "@/assets/icons/chest_open.png"
import exitIcon from "@/assets/icons/exit.png"

import type { Warband } from "../types/warband-types"

type WarbandHeaderProps = {
  warband: Warband | null
  goldCrowns?: number
  rating?: number
  tabs?: { id: string; label: string; disabled?: boolean }[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
  onWarchestClick?: () => void
  isWarchestOpen?: boolean
  warchestItems?: { id: number; name?: string | null }[]
  isWarchestLoading?: boolean
  warchestError?: string
  onWarchestClose?: () => void
}

export default function WarbandHeader({
  warband,
  goldCrowns,
  rating,
  tabs,
  activeTab,
  onTabChange,
  onWarchestClick,
  isWarchestOpen = false,
  warchestItems = [],
  isWarchestLoading = false,
  warchestError = "",
  onWarchestClose,
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
          tabsClassName="mt-auto mb-8 pb-0.5 max-w-[95%]"
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
                maxWidth={200}
              />
              {onWarchestClick && (
                <div className="warchest-anchor">
                  <Tooltip
                    trigger={
                      <button
                        type="button"
                        onClick={onWarchestClick}
                        className="flex h-5 w-5 cursor-pointer items-center justify-center border-none bg-transparent p-0 transition-[filter] hover:brightness-150"
                        aria-pressed={isWarchestOpen}
                      >
                        <img
                          src={isWarchestOpen ? chestOpenIcon : chestClosedIcon}
                          alt="Warband Stash"
                          className="h-full w-full object-contain"
                        />
                      </button>
                    }
                    content="Warband Stash"
                    maxWidth={200}
                  />
                  <section
                    className={`warchest-float ${isWarchestOpen ? "is-open" : ""}`}
                    aria-hidden={!isWarchestOpen}
                  >
                    <div className="warchest-header">
                      <div>
                        <p className="warchest-kicker">Warband Stash</p>
                        <h2 className="warchest-title">{warband.name}</h2>
                      </div>
                      <button
                        type="button"
                        className="warchest-close"
                        onClick={onWarchestClose ?? (() => {})}
                        aria-label="Close warband stash"
                      >
                        <img src={exitIcon} alt="" className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="warchest-body">
                      {isWarchestLoading ? (
                        <p className="warchest-muted">Loading items...</p>
                      ) : warchestError ? (
                        <p className="warchest-error">{warchestError}</p>
                      ) : warchestItems.length === 0 ? (
                        <p className="warchest-muted">No items in the stash yet.</p>
                      ) : (
                        <div className="warchest-scroll">
                          <ul className="warchest-list">
                            {warchestItems.map((item) => (
                              <li key={item.id} className="warchest-item">
                                {item.name || "Unnamed item"}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              )}
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
