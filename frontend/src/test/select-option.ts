import { act, screen, within } from "@testing-library/react";

import type { setupUser } from "./user-event";

/**
 * The Radix select next to a visible label: the dialogs' labels aren't tied to their triggers,
 * so this climbs from the label to the nearest container holding a combobox.
 */
export const selectNear = (labelText: string, root: HTMLElement = screen.getByRole("dialog")) => {
  let node: HTMLElement | null = within(root).getByText(labelText);
  while (node) {
    const trigger = node.querySelector<HTMLElement>("button[role=combobox]");
    if (trigger) return trigger;
    node = node.parentElement;
  }
  throw new Error(`No select next to "${labelText}"`);
};

/**
 * Picks an option of a Radix select by keyboard, as a keyboard user does. A pointer pick is
 * swallowed in jsdom: Radix ignores the first pointerup after opening, and the act-wrapped
 * user-event registers that listener only after the opening click has finished.
 */
export const chooseOption = async (
  user: ReturnType<typeof setupUser>,
  trigger: HTMLElement,
  option: string | RegExp
) => {
  act(() => trigger.focus());
  await user.keyboard("{Enter}");
  const target = await screen.findByRole("option", { name: option });
  act(() => target.focus());
  await user.keyboard("{Enter}");
};
