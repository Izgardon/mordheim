/**
 * The landing page as a signed-out visitor sees it: the background video (decision 5, landed in
 * PR C), the sign-in column, and the box it all sits in.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/features/auth/stores/auth-store";
import { fakeApi } from "@/test/fake-api";
import { createQueryWrapper } from "@/test/query-test-utils";
import Landing from "./Landing";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", () => ({ disconnectRealtime: vi.fn() }));
const media = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => media.mobile }));

function renderLanding() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/"]}>
        <Landing />
      </MemoryRouter>
    </AuthProvider>,
    { wrapper: createQueryWrapper() }
  );
}

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  media.mobile = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Lets the effects' timers run. */
const nextTask = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));

describe("Landing on desktop", () => {
  it("embeds YouTube's no-cookie video only after the page has loaded, autoplaying muted from a random start (decision 5, AUTH-TWEAK-05)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { container } = renderLanding();
    expect(container.querySelector("iframe")).toBeNull(); // not in the first render

    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());

    const iframe = container.querySelector("iframe");
    expect(iframe).toHaveAttribute("title", "Mordheim atmosphere video");
    const src = new URL(iframe!.getAttribute("src")!);
    expect(src.origin).toBe("https://www.youtube-nocookie.com");
    expect(src.pathname).toBe("/embed/WCB10AkLI4k");
    expect(src.searchParams.get("autoplay")).toBe("1");
    expect(src.searchParams.get("mute")).toBe("1");
    expect(src.searchParams.get("start")).toBe("10");
    expect(iframe!.closest("section")).toHaveAttribute("aria-hidden", "true");
  });

  it("waits for the window's load event while the page is still loading (decision 5, AUTH-TWEAK-05)", async () => {
    Object.defineProperty(document, "readyState", { configurable: true, get: () => "loading" });
    try {
      const { container } = renderLanding();
      await nextTask();
      expect(container.querySelector("iframe")).toBeNull();

      act(() => {
        window.dispatchEvent(new Event("load"));
      });

      expect(container.querySelector("iframe")).not.toBeNull();
    } finally {
      delete (document as { readyState?: unknown }).readyState; // back to Document's own getter
    }
  });

  it("shows the heading and the footage credit, and sends no request", () => {
    renderLanding();

    expect(screen.getByRole("heading", { name: "Mordheim Chronicler" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Styggosaurus" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/@Styggosaurus"
    );
    expect(
      screen.getByText(/not affiliated with or endorsed by Games Workshop/)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "broheim.net" })).toHaveAttribute(
      "href",
      "https://broheim.net"
    );
    expect(fakeApi.calls()).toEqual([]);
  });
});

describe("Landing on a phone", () => {
  it("embeds no video, so credits no footage", () => {
    media.mobile = true;
    const { container } = renderLanding();

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("main")).toHaveClass("auth-page--phone");
    expect(screen.queryByRole("link", { name: "Styggosaurus" })).toBeNull();
    expect(
      screen.getByText(/not affiliated with or endorsed by Games Workshop/)
    ).toBeInTheDocument();
  });
});

describe("the landing box", () => {
  it("is one visible screen tall and scrolls its form while the picture half stays put (AUTH-UX-07)", () => {
    // The page itself never scrolls (body is overflow: hidden), so the box must: the visible
    // viewport's height and its own vertical scroll. The form's column grows with its form
    // (never shorter than the screen), so a long sign-up is reached by scrolling, not clipped.
    const { container } = renderLanding();

    const main = container.querySelector("main")!;
    expect(main).toHaveClass("h-[100dvh]", "overflow-y-auto");
    expect(main).not.toHaveClass("h-screen");
    expect(main).not.toHaveClass("min-h-screen");
    expect(main.querySelector("section")).toHaveClass("min-h-[100dvh]");
    expect(container.querySelector(".auth-aside")).toHaveClass("sticky", "top-0", "h-[100dvh]");
  });
});
