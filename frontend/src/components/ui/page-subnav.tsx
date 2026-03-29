import type { ReactNode } from "react";

import TabSwitcher from "@components/tab-switcher";

import { cn } from "@/lib/utils";

type Tab = {
  id: string;
  label: string;
  disabled?: boolean;
};

type PageSubnavProps = {
  title: string;
  subtitle?: string;
  tabs?: ReadonlyArray<Tab>;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  actions?: ReactNode;
  className?: string;
};

export function PageSubnav({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  actions,
  className,
}: PageSubnavProps) {
  const showTabs = Boolean(tabs && tabs.length > 0 && activeTab && onTabChange);

  return (
    <header
      className={cn(
        "mb-6 mt-0 flex min-h-[4.5rem] items-center justify-between gap-4 border-b border-border/70 bg-[#14100c] px-6 py-3 [margin-left:calc(var(--desktop-content-gutter,1.5rem)*-1)] [margin-right:calc(var(--desktop-content-gutter,1.5rem)*-1)]",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-6">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
          {subtitle ? (
            <p className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
        {showTabs ? (
          <TabSwitcher
            tabs={tabs!}
            activeTab={activeTab!}
            onTabChange={onTabChange!}
            className="min-w-0 flex-1"
            listClassName="justify-start py-0"
          />
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
