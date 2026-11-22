import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useFitText } from "./use-fit-text";

function Value({ text }: { text: string }) {
  const ref = useFitText<HTMLSpanElement>(26, [text]);
  return (
    <span ref={ref} data-testid="value">
      {text}
    </span>
  );
}

/** jsdom has no layout: give every element the widths a phone's column would. */
function measure(room: number, natural: number) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(room);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(natural);
}

describe("useFitText", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the largest size while the line fits", () => {
    measure(100, 80);
    render(<Value text="245" />);
    expect(screen.getByTestId("value").style.fontSize).toBe("26px");
  });

  it("shrinks the line to its width rather than wrapping it", () => {
    measure(60, 120);
    render(<Value text="1234 gc" />);
    expect(screen.getByTestId("value").style.fontSize).toBe("13px");
  });

  it("never goes below a readable size", () => {
    measure(10, 200);
    render(<Value text="12345678 gc" />);
    expect(screen.getByTestId("value").style.fontSize).toBe("11px");
  });
});
