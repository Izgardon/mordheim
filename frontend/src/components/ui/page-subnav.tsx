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
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageSubnav({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  meta,
  actions,
  className,
}: PageSubnavProps) {
  const showTabs = Boolean(tabs && tabs.length > 0 && activeTab && onTabChange);
  const showMeta = Boolean(meta);
  const showActions = Boolean(actions);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 mb-6 mt-0 flex min-h-[4.5rem] items-center justify-between gap-4 border-b border-border/70 bg-[#14100c] px-6 py-3",
        className
      )}
      style={{
        width: "calc(100vw - var(--desktop-rail-width, 240px))",
        marginLeft:
          "calc(50% - ((100vw - var(--desktop-rail-width, 240px)) / 2))",
        marginRight:
          "calc(50% - ((100vw - var(--desktop-rail-width, 240px)) / 2))",
      }}
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
        {showTabs ? <div className="h-7 w-px shrink-0 bg-border/55" aria-hidden="true" /> : null}
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
      {showMeta || showActions ? (
        <div className="flex shrink-0 items-center gap-4">
          {showMeta ? <div className="flex items-center gap-2">{meta}</div> : null}
          {showMeta && showActions ? (
            <div className="h-7 w-px bg-border/70" aria-hidden="true" />
          ) : null}
          {showActions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
