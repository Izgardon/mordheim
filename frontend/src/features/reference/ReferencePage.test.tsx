/**
 * The reference pages' eyebrow ("Rules" over the Rules section's pages, "Reference" elsewhere) and
 * what a phone shows in its place: the page's own buttons (William, 20 Nov 2026), the shell's top
 * bar already naming the page, beside the search box (William, 22 Nov 2026).
 */
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReferenceSearch } from "./ReferenceFilters";
import ReferencePage from "./ReferencePage";

let mobile = false;
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => mobile }));

beforeEach(() => {
  mobile = false;
});

const eyebrowOver = (title: string, section: string) => {
  const { unmount } = render(
    <MemoryRouter>
      <ReferencePage title={title} section={section}>
        <p>rows</p>
      </ReferencePage>
    </MemoryRouter>
  );
  const eyebrow = screen.getByRole("heading", { level: 1, name: title }).previousElementSibling;
  const text = eyebrow?.textContent;
  unmount();
  return text;
};

describe("ReferencePage", () => {
  it("reads Rules over the Rules, House rules and Campaign rules pages, Reference over the rest", () => {
    expect(eyebrowOver("Rules", "rules")).toBe("Rules");
    expect(eyebrowOver("House rules", "house-rules")).toBe("Rules");
    expect(eyebrowOver("Campaign rules", "campaign-rules")).toBe("Rules");
    expect(eyebrowOver("Skills", "skills")).toBe("Reference");
  });

  it("drops the section dropdown on a phone and keeps the page's buttons", () => {
    mobile = true;
    render(
      <MemoryRouter>
        <ReferencePage
          title="Skills"
          section="skills"
          actions={<button type="button">Add skill</button>}
        >
          <p>rows</p>
        </ReferencePage>
      </MemoryRouter>
    );

    expect(screen.queryByRole("combobox", { name: "Reference section" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add skill" })).toBeInTheDocument();
  });

  // William, 22 Nov 2026: "On mobile, reference pages can the search bar be inline with the add
  // button. All should just say Add New."
  it("puts the page's buttons beside the search box on a phone, and over the title on the web", () => {
    const page = () => (
      <MemoryRouter>
        <ReferencePage
          title="Spells"
          section="spells"
          actions={<button type="button">Add new</button>}
          filters={
            <ReferenceSearch
              value=""
              onChange={() => undefined}
              placeholder="Search spells"
              label="Search spells"
              isMobile={mobile}
            />
          }
        >
          <p>rows</p>
        </ReferencePage>
      </MemoryRouter>
    );
    mobile = true;
    const { unmount } = render(page());
    const search = screen.getByRole("searchbox", { name: "Search spells" }).closest("label");
    expect(search?.parentElement).toContainElement(screen.getByRole("button", { name: "Add new" }));
    expect(screen.getAllByRole("button", { name: "Add new" })).toHaveLength(1);
    unmount();

    mobile = false;
    render(page());
    expect(screen.getByRole("banner")).toContainElement(
      screen.getByRole("button", { name: "Add new" })
    );
  });
});
