import * as React from "react";

// components
import TabSwitcher from "@components/tab-switcher";
import MobileTabs from "@components/mobile-tabs";

// utils
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";

type TabOption<T extends string> = {
  id: T;
  label: string;
  disabled?: boolean;
};

type TabbedCardProps<T extends string> = {
  tabs: ReadonlyArray<TabOption<T>>;
  activeTab: T;
  onTabChange: (tab: T) => void;
  header?: React.ReactNode;
  mobileRight?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  tabsClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
};

export default function TabbedCard<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  header,
  mobileRight,
  className,
  headerClassName,
  tabsClassName,
  contentClassName,
  children,
}: TabbedCardProps<T>) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const mobileTabsClassName =
    tabsClassName && tabsClassName.includes("hidden") ? undefined : tabsClassName;

  return (
    <div className={cn("relative", className)}>
      {isMobile ? (
        <div className="flex min-w-0 items-center justify-between gap-2 px-2 pt-2">
          <MobileTabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
            className={cn("-ml-2 min-w-0 flex-1", mobileTabsClassName)}
          />
          {mobileRight ? <div className="shrink-0 pr-2">{mobileRight}</div> : null}
        </div>
      ) : (
        <TabSwitcher
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          className={cn(
            "relative z-10 translate-y-0 sm:absolute sm:left-1/2 sm:top-0 sm:-translate-x-1/2 sm:-translate-y-1/2",
            tabsClassName
          )}
        />
      )}
      {header ? <div className={cn("flex flex-col gap-4", headerClassName)}>{header}</div> : null}
      <div className={cn("space-y-5", contentClassName)}>{children}</div>
    </div>
  );
}
