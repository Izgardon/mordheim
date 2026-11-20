/**
 * The reference pages' eyebrow ("Rules" over the Rules section's pages, "Reference" elsewhere) and
 * what a phone shows in its place: the page's own buttons alone (William, 20 Nov 2026), the shell's
 * top bar already naming the page.
 */
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
