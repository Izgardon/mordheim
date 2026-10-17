import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reloadApp } from "@/lib/reload-app";
import { AppErrorBoundary } from "./AppErrorBoundary";
import RouteError from "./RouteError";

vi.mock("@/lib/reload-app", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/reload-app")>()),
  reloadApp: vi.fn(),
}));

let shouldThrow = true;

function FlakyPage() {
  if (shouldThrow) {
    throw new Error("Cannot render this battle");
  }
  return <p>Battle page</p>;
}

function StaleChunkPage(): never {
  throw new TypeError("Failed to fetch dynamically imported module: /assets/Warband-abc123.js");
}

function renderCampaign(page: JSX.Element) {
  const router = createMemoryRouter(
    [
      {
        path: "/campaigns/:id",
        element: (
          <div>
            <nav>Campaign shell</nav>
            <Outlet />
          </div>
        ),
        children: [
          {
            errorElement: <RouteError variant="inline" />,
            children: [{ path: "battles", element: page }],
          },
        ],
      },
    ],
    { initialEntries: ["/campaigns/7/battles"] }
  );
  return render(<RouterProvider router={router} />);
}

describe("RouteError", () => {
  beforeEach(() => {
    shouldThrow = true;
    vi.mocked(reloadApp).mockClear();
    // React and the router log caught render errors; they are expected here.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("replaces only the failing page, keeps the shell, and retries", async () => {
    renderCampaign(<FlakyPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("Cannot render this battle");
    expect(screen.getByText("Campaign shell")).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Battle page")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers a reload when a page's code is missing after a deploy", () => {
    renderCampaign(<StaleChunkPage />);

    expect(screen.getByText("The app was updated")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reloadApp).toHaveBeenCalledTimes(1);
  });
});

describe("AppErrorBoundary", () => {
  it("shows a way out instead of a blank screen", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <AppErrorBoundary>
        <FlakyPage />
      </AppErrorBoundary>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("The app hit an unexpected error.");
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reloadApp).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
