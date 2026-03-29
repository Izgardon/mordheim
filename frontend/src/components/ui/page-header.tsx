import type { ReactNode } from "react"

import { PageSubnav } from "@/components/ui/page-subnav"
import { useMediaQuery } from "@/lib/use-media-query"

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
  rightSlot?: ReactNode
}

export function PageHeader({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  rightSlot,
}: PageHeaderProps) {
  const isMobile = useMediaQuery("(max-width: 960px)")
  const showTabs = Boolean(tabs && tabs.length > 0 && activeTab && onTabChange)

  if (isMobile) {
    return null
  }

  return (
    <PageSubnav
      title={title}
      subtitle={subtitle}
      tabs={showTabs ? tabs : undefined}
      activeTab={activeTab}
      onTabChange={onTabChange}
      actions={rightSlot}
    />
  )
}
