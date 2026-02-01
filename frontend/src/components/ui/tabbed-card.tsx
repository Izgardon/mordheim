import * as React from "react";

// components
import TabSwitcher from "@components/tab-switcher";

// utils
import { cn } from "@/lib/utils";

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
  className,
  headerClassName,
  tabsClassName,
  contentClassName,
  children,
}: TabbedCardProps<T>) {
  return (
    <div className={cn("relative p-7", className)}>
      <TabSwitcher
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        className={cn(
          "relative z-10 translate-y-0 sm:absolute sm:left-1/2 sm:top-0 sm:-translate-x-1/2 sm:-translate-y-1/2",
          tabsClassName
        )}
      />
      <div className={cn("flex flex-col gap-4 pt-6 sm:pt-6", headerClassName)}>
        {header ? <div className="w-full">{header}</div> : null}
      </div>
      <div className={cn("space-y-5", contentClassName)}>{children}</div>
    </div>
  );
}
