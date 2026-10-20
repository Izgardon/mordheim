import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";
import { getItemAvailabilityCostLabel } from "@/features/battles/components/postbattle/find-items";
import type { FindItemSearch } from "@/features/battles/hooks/useFindItemSearch";

/** "Search and add an item": the campaign's items filtered by name, picked into the finds. */
export default function FindItemPicker({
  finds,
  disabled,
}: {
  finds: FindItemSearch;
  disabled: boolean;
}) {
  const { catalogue, results } = finds;
  return (
    <ActionSearchInput
      value={finds.search}
      onChange={(event) => {
        finds.setSearch(event.target.value);
        if (!finds.isOpen) {
          finds.setIsOpen(true);
        }
      }}
      onFocus={() => finds.setIsOpen(true)}
      placeholder="Search and add an item"
      disabled={disabled}
      containerClassName="battle-postbattle-finds-search w-full"
      inputClassName="field-surface h-10 !rounded-none !border-[#5a3f24] !bg-[#130d09] text-foreground placeholder:text-muted-foreground"
    >
      <ActionSearchDropdown
        open={finds.isOpen && !disabled}
        onClose={() => finds.setIsOpen(false)}
        className="mt-1 !rounded-none border-[#5a3f24] bg-[#130d09]"
      >
        <div className="max-h-60 w-full overflow-y-auto">
          {catalogue.isLoading ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">Loading items...</div>
          ) : catalogue.error ? (
            <div className="px-3 py-3 text-sm text-red-600">{catalogue.error}</div>
          ) : results.length > 0 ? (
            <div>
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 border-b border-border/40 px-3 py-2 text-left last:border-b-0 hover:bg-[#21170f]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => finds.addItem(item)}
                >
                  <span className="min-w-0 truncate font-semibold text-foreground">
                    {item.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {getItemAvailabilityCostLabel(item)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-3 text-sm text-muted-foreground">No matching items found.</div>
          )}
        </div>
      </ActionSearchDropdown>
    </ActionSearchInput>
  );
}
