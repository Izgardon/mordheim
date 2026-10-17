import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { MobileTopBarConfig } from "../routes/CampaignLayout";
import { useMobileTopBarOverride } from "./useMobileTopBarOverride";

const wrapper = ({ children }: PropsWithChildren) => (
  <MemoryRouter initialEntries={["/campaigns/7/warband"]}>{children}</MemoryRouter>
);

const useTopBar = (defaultTopBar: MobileTopBarConfig) => ({
  ...useMobileTopBarOverride(defaultTopBar),
  navigate: useNavigate(),
});

describe("useMobileTopBarOverride", () => {
  it("layers the page's override over a changing default", () => {
    const { result, rerender } = renderHook(useTopBar, {
      wrapper,
      initialProps: { title: "Warband", rightSlot: "icons" } as MobileTopBarConfig,
    });

    act(() => result.current.setMobileTopBar({ title: "Edit Hero", rightSlot: "save" }));
    rerender({ title: "Warband", rightSlot: "icons with a new badge", meta: "rejoin" });

    expect(result.current.topBar).toEqual({
      title: "Edit Hero",
      rightSlot: "save",
      meta: "rejoin",
    });
  });

  it("drops the override on navigation and keeps the setter stable within a page", () => {
    const defaultTopBar: MobileTopBarConfig = { title: "Warband" };
    const { result } = renderHook(() => useTopBar(defaultTopBar), { wrapper });
    const setter = result.current.setMobileTopBar;

    act(() => result.current.setMobileTopBar({ title: "Edit Hero" }));
    expect(result.current.setMobileTopBar).toBe(setter);

    act(() => result.current.navigate("/campaigns/7/skills"));
    expect(result.current.topBar).toBe(defaultTopBar);
  });
});
