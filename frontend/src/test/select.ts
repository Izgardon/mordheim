import { act, screen } from "@testing-library/react";

import type { setupUser } from "./user-event";

/**
 * Picks an option of a Radix select: opens it from its trigger, then takes the option by keyboard.
 * jsdom puts every pointer at 0,0, so Radix reads a click on an option as the pointer that opened
 * it never moving and ignores it.
 */
export async function pickOption(
  user: ReturnType<typeof setupUser>,
  trigger: HTMLElement,
  name: string | RegExp
) {
  await user.click(trigger);
  const option = await screen.findByRole("option", { name });
  act(() => option.focus());
  await user.keyboard("{Enter}");
}
