import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SearchableDropdown from "./SearchableDropdown";

describe("SearchableDropdown", () => {
  it("focuses the search input when opened with autoFocusInput enabled", async () => {
    const { rerender } = render(
      <SearchableDropdown
        query=""
        onQueryChange={vi.fn()}
        placeholder="Search items..."
        inputClassName=""
        items={[]}
        isOpen={false}
        autoFocusInput
        onSelectItem={vi.fn()}
        renderItem={() => null}
        getItemKey={() => "item"}
      />
    );

    rerender(
      <SearchableDropdown
        query=""
        onQueryChange={vi.fn()}
        placeholder="Search items..."
        inputClassName=""
        items={[]}
        isOpen={true}
        autoFocusInput
        onSelectItem={vi.fn()}
        renderItem={() => null}
        getItemKey={() => "item"}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search items...")).toHaveFocus();
    });
  });
});
