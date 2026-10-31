# Next, step 8: restyle what was left behind (landing and sign-in, campaigns, and everything else)

Branch `next`. William: "make sure we redo the styling of the login and campaign page and anything else that might be left behind."

Read first:
- `scratchpad/next-1-report.md` (tokens, primitives, shell);
- `scratchpad/next-7b-report.md`;
- the earlier briefs in this folder.

## Rules

- Delete old code freely.
- Light testing. The gate is typecheck, lint, format, build, the remaining vitest suites, and the backend gate when the backend changes.
- Small commits in the repo's style, with no attribution lines. No push or merge, and never bare `git stash`.
- Don't stop for sign-off. Choose what keeps the design's intent and note it.
- Scripts are in the scratchpad: `wt-fenext.sh`, `nextfe-gate.sh`, `wt-nextbe.sh`, `nextbe-gate.sh`.

## Before you start

`data/items-import` was just merged into `next` (merge `a2aa1972`, which adds `backend/catalogue_import/`). Run the backend gate once at the start to confirm the merged tree is green. Fix anything the merge broke in its own commit.

## Design

There is no design E board for these pages. Make them look like they belong with the E pages already built (warband, overview, Aftermath, battle, reference, settings):

- Fraunces headings, Manrope body, Space Mono numbers;
- square corners;
- the E tokens only, no hard-coded colours;
- light and dark;
- web and phone (375 px).

The design folder (`C:\Users\wsess\AppData\Local\Temp\claude\C--src-code-projects-onebillionbeers\ee93fc75-5df2-4c84-aaa1-0df2f3050f1c\scratchpad\artifact-files\9ca91174-6a67-4b62-801a-bef2e7f39b98\project\`) has `A-Web-Campaign.dc.html` and older A/B/C/D boards. They are from earlier directions, so use them for layout ideas only. `E-Palette.dc.html` has the palette and type.

## Part A: landing and sign-in

Fully restyle these, not just token swaps:

- The landing page: the hero, the deferred video, and the copy.
- Sign in, sign up and forgot password.
- The reset-password page.

Keep every behaviour: the strength hint, refusals under their fields, the terms, and the video staying deferred and on youtube-nocookie.

## Part B: the campaigns page

Fully restyle these:

- The campaigns list (cards for each campaign: its name, your warband, players, state, archived).
- The empty state.
- Create campaign and Join campaign.
- Anything else on that page today, such as the roster preview and feedback.

The phone layout must work well.

## Part C: everything else left behind

Sweep the whole frontend for anything still on old styles and restyle it. At least:

- Account;
- creating a warband;
- NotFound and RouteError;
- the loading screen;
- toasts;
- confirm and alert dialogs;
- any shadcn/Radix component still on its stock look: select, input, popover, tooltip, checkbox, radio, tabs, dropdown menu and dialog;
- `index.html` (the background colour before the app loads, `theme-color` for light and dark), the favicon and the PWA manifest colours;
- anything in `index.css` still using old variables.

Then check the backend's email templates (invite, reset password, anything else sent) and restyle them to match. Keep them simple and email-safe, with inline styles and light only. Don't send any email to check them; render them in a test or the shell instead.

Search for leftovers mechanically:
- hard-coded hex and rgb colours outside the token files;
- old class names;
- `rounded-*` on E surfaces;
- the default shadcn colour names (`bg-background`, `text-muted-foreground` and so on) where they don't map to E tokens.

List what you found and what you changed.

## Checking

Check in a browser if practical, at web and phone widths, in light and dark:
- landing and sign-in;
- the campaigns page with several campaigns (one archived) and with none;
- Account;
- creating a warband;
- NotFound.

## Report

Write `scratchpad/next-8-report.md`:

- commits;
- what changed;
- the sweep's findings;
- anything left;
- calls you made.
