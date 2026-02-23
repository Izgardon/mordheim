import { useState } from "react"
import type { ReactNode } from "react"

import { HeaderFrame } from "@components/header-frame"
import TabSwitcher from "@components/tab-switcher"

import headerFrame from "@/assets/containers/header.webp"
import greedIcon from "@/assets/icons/greed.webp"
import ratingIcon from "@/assets/icons/Menu.webp"
import chestClosedIcon from "@/assets/icons/chest.webp"
import chestOpenIcon from "@/assets/icons/chest_open.webp"
import { useMediaQuery } from "@/lib/use-media-query"

import HeaderIconButton from "./HeaderIconButton"
import StashItemList from "./stash/StashItemList"
import WarbandRatingDialog from "./WarbandRatingDialog"
import { Tooltip } from "@/components/ui/tooltip"

import type { HenchmenGroup, Warband, WarbandHero, WarbandHiredSword, WarbandItemSummary } from "../../types/warband-types"

type WarbandHeaderProps = {
  warband: Warband | null
  goldCrowns?: number
  rating?: number
  heroes?: WarbandHero[]
  hiredSwords?: WarbandHiredSword[]
  henchmenGroups?: HenchmenGroup[]
  tabs?: { id: string; label: string; disabled?: boolean }[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
  onWarchestClick?: () => void
  isWarchestOpen?: boolean
  warchestItems?: WarbandItemSummary[]
  isWarchestLoading?: boolean
  warchestError?: string
  onWarchestClose?: () => void
  onWarchestItemsChanged?: () => void
  onHeroUpdated?: (updatedHero: WarbandHero) => void
  canEdit?: boolean
  tradeAction?: ReactNode
}

export default function WarbandHeader({
  warband,
  goldCrowns,
  rating,
  heroes = [],
  hiredSwords = [],
  henchmenGroups = [],
  tabs,
  activeTab,
  onTabChange,
  onWarchestClick,
  isWarchestOpen = false,
  warchestItems = [],
  isWarchestLoading = false,
  warchestError = "",
  onWarchestClose,
  onWarchestItemsChanged,
  onHeroUpdated,
  canEdit = false,
  tradeAction,
}: WarbandHeaderProps) {
  const isMobile = useMediaQuery("(max-width: 960px)")
  const [isRatingOpen, setIsRatingOpen] = useState(false)

  if (isMobile) {
    return null
  }

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
              <HeaderIconButton
                icon={greedIcon}
                label={goldCrowns ?? 0}
                tooltip="Gold coins"
                ariaLabel="Gold coins"
              />
              <HeaderIconButton
                icon={ratingIcon}
                label={rating ?? 0}
                tooltip="Warband Rating"
                onClick={() => setIsRatingOpen(true)}
                ariaLabel="Warband rating breakdown"
              />
              <WarbandRatingDialog
                open={isRatingOpen}
                onOpenChange={setIsRatingOpen}
                heroes={heroes}
                hiredSwords={hiredSwords}
                henchmenGroups={henchmenGroups}
              />
              {onWarchestClick && (
                <div className="warchest-anchor">
                  <HeaderIconButton
                    icon={isWarchestOpen ? chestOpenIcon : chestClosedIcon}
                    label=""
                    tooltip="Warband Stash"
                    onClick={onWarchestClick}
                    ariaLabel="Warband Stash"
                    iconClassName="h-5 w-5 object-contain"
                  />
                  <section
                    className={`warchest-float ${isWarchestOpen ? "is-open" : ""}`}
                    aria-hidden={!isWarchestOpen}
                  >
                    <StashItemList
                      items={warchestItems}
                      warbandId={warband.id}
                      isLoading={isWarchestLoading}
                      error={warchestError}
                      onClose={onWarchestClose}
                      onItemsChanged={onWarchestItemsChanged}
                      onHeroUpdated={onHeroUpdated}
                      canEdit={canEdit}
                    />
                  </section>
                </div>
              )}
              {tradeAction ? (
                <Tooltip
                  trigger={<div className="flex items-center">{tradeAction}</div>}
                  content="Start trade"
                  maxWidth={200}
                  className="inline-flex"
                />
              ) : null}
            </div>
          </div>
        </HeaderFrame>
      </header>
    )
  }

  return null;
}
