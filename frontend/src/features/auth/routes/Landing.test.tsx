/**
 * Pass 6 characterisation: the landing page as a signed-out visitor sees it today (the video
 * decision lands in PR C): the background video, the card, and the box it all sits in.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import stylesheet from "@/index.css?raw";
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

/** The declarations of the first `selector { ... }` rule in index.css. */
function cssRule(selector: string) {
  const start = stylesheet.indexOf(`${selector} {`);
  return stylesheet.slice(start, stylesheet.indexOf("}", start));
}

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  media.mobile = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Landing on desktop", () => {
  it("embeds the youtube.com video at once, autoplaying muted from a random start (decision 5, AUTH-TWEAK-05, pinned; flips in PR C)", () => {
    // Characterises current behaviour (decision 5, AUTH-TWEAK-05, pinned; flips in PR C:
    // youtube-nocookie.com, mounted after load)
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { container } = renderLanding();

    const iframe = container.querySelector("iframe");
    expect(iframe).toHaveAttribute("title", "Mordheim atmosphere video");
    const src = new URL(iframe!.getAttribute("src")!);
    expect(src.origin).toBe("https://www.youtube.com");
    expect(src.pathname).toBe("/embed/WCB10AkLI4k");
    expect(src.searchParams.get("autoplay")).toBe("1");
    expect(src.searchParams.get("mute")).toBe("1");
    expect(src.searchParams.get("start")).toBe("10");
    expect(iframe!.closest("section")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the card with the title art and the footage credit, and sends no request", () => {
    renderLanding();

    expect(screen.getByRole("heading", { name: "Mordheim Chronicler" })).toBeInTheDocument();
    expect(screen.getByAltText("Mordheim: City of the Damned")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Styggosaurus" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/@Styggosaurus"
    );
    expect(fakeApi.calls()).toEqual([]);
  });
});

describe("Landing on a phone", () => {
  it("embeds no video and paints the site background behind the card", () => {
    media.mobile = true;
    const { container } = renderLanding();

    expect(container.querySelector("iframe")).toBeNull();
    const main = container.querySelector("main")!;
    expect(main).toHaveClass("landing--mobile");
    expect(main.style.backgroundImage).toMatch(/url\(/);
    expect(screen.getByRole("link", { name: "Styggosaurus" })).toBeInTheDocument();
  });
});

describe("the landing box", () => {
  it("is one screen tall with its overflow hidden, so a long sign-up can't scroll (AUTH-UX-07, pinned; flips in PR A)", () => {
    // Characterises current behaviour (AUTH-UX-07, pinned; flips in PR A:
    // min-height: 100dvh; overflow-y: auto)
    const { container } = renderLanding();

    expect(container.querySelector("main")).toHaveClass("landing", "h-screen");
    const rule = cssRule(".landing");
    expect(rule).toMatch(/height: 100vh;/);
    expect(rule).toMatch(/overflow: hidden;/);
    expect(rule).not.toMatch(/100dvh/);
  });
});
