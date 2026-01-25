import * as React from "react";

// components
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import TabSwitcher from "@/components/ui/tab-switcher";

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
    <Card className={className}>
      <CardHeader className={cn("space-y-4", headerClassName)}>
        {header ? <div>{header}</div> : null}
        <TabSwitcher
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          className={cn("-mx-6 border-b border-border/60 px-6 pb-3", tabsClassName)}
        />
      </CardHeader>
      <CardContent className={cn("space-y-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
