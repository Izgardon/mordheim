/** The reference pages' eyebrow: "Rules" over the Rules section's pages, "Reference" elsewhere. */
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ReferencePage from "./ReferencePage";

vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

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
});
