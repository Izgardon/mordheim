import { render, screen } from "@testing-library/react";

import { makeEditorFighter, makeEditorTemplate } from "@/test/template-editor-fixtures";

import TemplateFighterCard from "./TemplateFighterCard";

describe("TemplateFighterCard", () => {
  it('names a fighter\'s lists his equipment lists (William, 28 Nov 2026: "Yes rename that too")', () => {
    render(
      <TemplateFighterCard
        fighter={makeEditorFighter()}
        template={makeEditorTemplate()}
        variant=""
      />
    );

    expect(screen.getByText("Equipment lists")).toBeInTheDocument();
    expect(screen.getByText("Kit list")).toBeInTheDocument();
    expect(screen.queryByText("Lists")).not.toBeInTheDocument();
  });
});
