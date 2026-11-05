import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { useDirtySince } from "./discard-changes";

describe("useDirtySince", () => {
  it("is dirty once the state moves from what it loaded, and clean again on markClean", () => {
    const { result } = renderHook(() => {
      const [values, setValues] = useState({ name: "Ember" });
      return { setValues, ...useDirtySince(values) };
    });
    expect(result.current.dirty).toBe(false);
    act(() => result.current.setValues({ name: "Embers" }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.setValues({ name: "Ember" }));
    expect(result.current.dirty).toBe(false); // typed back as it was

    // a load: the new entry's values and markClean in one go
    act(() => {
      result.current.setValues({ name: "Fireball" });
      result.current.markClean();
    });
    expect(result.current.dirty).toBe(false);
    act(() => result.current.setValues({ name: "Fireballs" }));
    expect(result.current.dirty).toBe(true);
  });
});
