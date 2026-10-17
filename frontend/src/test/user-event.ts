import { act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * user-event wrapped in `act`, as `routes/WarbandDesktopEditActions.test.tsx` does by hand:
 * without it the roster cards' hover and async state updates log act() warnings.
 */
export const setupUser = () => {
  const user = userEvent.setup();
  const wrap =
    <Args extends unknown[]>(action: (...args: Args) => Promise<void>) =>
    (...args: Args) =>
      act(async () => {
        await action(...args);
      });
  return {
    click: wrap(user.click.bind(user)),
    hover: wrap(user.hover.bind(user)),
    unhover: wrap(user.unhover.bind(user)),
    type: wrap(user.type.bind(user)),
    clear: wrap(user.clear.bind(user)),
  };
};
