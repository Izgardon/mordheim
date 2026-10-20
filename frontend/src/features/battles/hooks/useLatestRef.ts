import { useLayoutEffect, useRef } from "react";

/**
 * A ref holding the latest `value`, for an effect that should re-run only when some of the value's
 * fields change but reads the whole value when it does.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
