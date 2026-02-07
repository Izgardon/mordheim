import { HeaderFrame } from "@components/header-frame"
import TabSwitcher from "@components/tab-switcher"

import headerFrame from "@/assets/containers/header.webp"

type Tab = {
  id: string
  label: string
  disabled?: boolean
}

type PageHeaderProps = {
  title: string
  subtitle?: string
  tabs?: ReadonlyArray<Tab>
  activeTab?: string
  onTabChange?: (tabId: string) => void
}

export function PageHeader({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
}: PageHeaderProps) {
  const showTabs = Boolean(tabs && tabs.length > 0 && activeTab && onTabChange)

  return (
    <header className="mb-10">
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
        tabsClassName="mt-auto mb-1.5 pb-0.5 max-w-[95%]"
      >
        <div className="flex flex-col items-center gap-2">
          <h1 className="title-glow font-display text-lg font-semibold tracking-[0.08em] drop-shadow-[0_2px_3px_rgba(6,4,2,0.7)] sm:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <>
              <span className="h-px w-16 bg-[#6e5a3b] opacity-80" />
              <p className="text-[0.55rem] uppercase tracking-[0.45em] text-[#c9b48a] sm:text-xs">
                {subtitle}
              </p>
            </>
          ) : null}
        </div>
      </HeaderFrame>
    </header>
  )
}
