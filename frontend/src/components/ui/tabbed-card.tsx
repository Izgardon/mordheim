import * as React from "react";

// components
import { Card, CardContent, CardHeader } from "@components/card";
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
    <Card className={cn("relative", className)}>
      <TabSwitcher
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        className={cn(
          "relative z-10 translate-y-0 sm:absolute sm:left-1/2 sm:top-0 sm:-translate-x-1/2 sm:-translate-y-1/2",
          tabsClassName
        )}
      />
      <CardHeader className={cn("flex flex-col gap-4 space-y-0 pt-6 sm:pt-12", headerClassName)}>
        {header ? <div className="w-full">{header}</div> : null}
      </CardHeader>
      <CardContent className={cn("space-y-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

