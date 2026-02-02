import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";
import { useEffect, useRef } from "react";

type SearchableDropdownProps<T> = {
  query: string;
  onQueryChange: (query: string) => void;
  placeholder: string;
  inputClassName: string;
  items: T[];
  isOpen: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onSelectItem: (item: T) => void;
  renderItem: (item: T) => React.ReactNode;
  renderActions?: (item: T) => React.ReactNode;
  getItemKey: (item: T) => string | number;
  emptyMessage?: string;
  canCreate?: boolean;
  onCreateClick?: () => void;
  createLabel?: string;
};

export default function SearchableDropdown<T>({
  query,
  onQueryChange,
  placeholder,
  inputClassName,
  items,
  isOpen,
  onFocus,
  onBlur,
  onSelectItem,
  renderItem,
  renderActions,
  getItemKey,
  emptyMessage = "No matches yet.",
  canCreate = false,
  onCreateClick,
  createLabel = "Create",
}: SearchableDropdownProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        onBlur?.();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, onBlur]);

  const handleFocus = () => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    onFocus?.();
  };

  const handleBlur = () => {
    blurTimeoutRef.current = window.setTimeout(() => {
      onBlur?.();
    }, 120);
  };

  return (
    <div ref={containerRef} className="relative">
      <ActionSearchInput
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
        inputClassName={inputClassName}
        onFocus={handleFocus}
        onBlur={handleBlur}
        actionLabel={canCreate ? createLabel : undefined}
        actionAriaLabel={canCreate ? `${createLabel} new` : undefined}
        actionVariant="outline"
        actionClassName="border-border/60 bg-background/70 text-foreground hover:border-primary/60"
        onAction={canCreate ? onCreateClick : undefined}
      />
      <ActionSearchDropdown open={isOpen} className="mt-1 rounded-xl">
        <div className="max-h-60 w-full overflow-y-auto p-1">
          {items.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">{emptyMessage}</p>
          ) : (
            <div className="space-y-1">
              {items.map((item) =>
                renderActions ? (
                  <div
                    key={getItemKey(item)}
                    className="flex w-full items-center justify-between rounded-xl border border-transparent bg-background/60 px-3 py-1 text-left text-xs text-foreground"
                  >
                    {renderItem(item)}
                    {renderActions(item)}
                  </div>
                ) : (
                  <button
                    key={getItemKey(item)}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onSelectItem(item)}
                    className="flex w-full items-center justify-between rounded-xl border border-transparent bg-background/60 px-3 py-1 text-left text-xs text-foreground transition-colors hover:border-primary/60 hover:bg-accent/25"
                  >
                    {renderItem(item)}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </ActionSearchDropdown>
    </div>
  );
}
