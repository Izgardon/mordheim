import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FIT_VALUE, useFitRow } from "./use-fit-row";

function Row({ texts }: { texts: string[] }) {
  const ref = useFitRow<HTMLDListElement>(26, [texts.join()]);
  return (
    <dl ref={ref}>
      {texts.map((text) => (
        <dd key={text} data-testid={text} {...{ [FIT_VALUE]: "" }}>
          {text}
        </dd>
      ))}
    </dl>
  );
}

/** jsdom has no layout: give each value the widths a phone's column would, by its text. */
function measure(widths: Record<string, { room: number; natural: number }>) {
  const of = (element: HTMLElement) => widths[element.textContent ?? ""] ?? { room: 0, natural: 0 };
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (
    this: HTMLElement
  ) {
    return of(this).room;
  });
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (
    this: HTMLElement
  ) {
    return of(this).natural;
  });
}

describe("useFitRow", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the largest size while every value fits", () => {
    measure({ "245": { room: 100, natural: 80 }, "4": { room: 100, natural: 20 } });
    render(<Row texts={["245", "4"]} />);
    expect(screen.getByTestId("245").style.fontSize).toBe("26px");
    expect(screen.getByTestId("4").style.fontSize).toBe("26px");
  });

  it("shrinks every value to the size the tightest fits at", () => {
    measure({ "1234 gc": { room: 60, natural: 120 }, "25": { room: 60, natural: 30 } });
    render(<Row texts={["1234 gc", "25"]} />);
    expect(screen.getByTestId("1234 gc").style.fontSize).toBe("13px");
    expect(screen.getByTestId("25").style.fontSize).toBe("13px");
  });

  it("never goes below a readable size", () => {
    measure({ "12345678 gc": { room: 10, natural: 200 } });
    render(<Row texts={["12345678 gc"]} />);
    expect(screen.getByTestId("12345678 gc").style.fontSize).toBe("11px");
  });
});
