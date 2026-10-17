import { act, render } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ScrollToTop from "./ScrollToTop";

function Shell() {
  return (
    <>
      <ScrollToTop />
      {/* Like AppShell: the page scrolls inside this element, not the window. */}
      <div data-scroll-root="" data-testid="scroll-root">
        <Outlet />
      </div>
    </>
  );
}

describe("ScrollToTop", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });

  it("scrolls the shell's scroll container back to the top on a new page (BUG-58)", async () => {
    const router = createMemoryRouter(
      [
        {
          element: <Shell />,
          children: [
            { path: "/campaigns/7/warband", element: <p>Warband</p> },
            { path: "/campaigns/7/skills", element: <p>Skills</p> },
          ],
        },
      ],
      { initialEntries: ["/campaigns/7/warband"] }
    );
    const { getByTestId } = render(<RouterProvider router={router} />);
    const scrollRoot = getByTestId("scroll-root");
    scrollRoot.scrollTop = 640;

    await act(() => router.navigate("/campaigns/7/skills"));

    expect(scrollRoot.scrollTop).toBe(0);
  });

  it("keeps the scroll position when only the query string changes", async () => {
    const router = createMemoryRouter(
      [{ element: <Shell />, children: [{ path: "/campaigns/7", element: <p>Overview</p> }] }],
      { initialEntries: ["/campaigns/7"] }
    );
    const { getByTestId } = render(<RouterProvider router={router} />);
    const scrollRoot = getByTestId("scroll-root");
    scrollRoot.scrollTop = 300;

    await act(() => router.navigate("/campaigns/7?tab=bulletin"));

    expect(scrollRoot.scrollTop).toBe(300);
  });
});
