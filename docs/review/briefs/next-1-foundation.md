# Next, step 1: the design foundation and app shell

Branch `next` (worktree `.worktrees/next`, cut from main `d50f4bb2`). Everything on `next` ships together in one switch, alongside the items rebuild and one prod wipe, so nothing here goes to main on its own.

## Why

William picked design E (the "E · Combined" page of the style canvas, https://claude.ai/artifact/LM1uYExwkVe7QUKgGnCmbD). Later steps rebuild the warband page, the post-game flow, the store, the overview and the battle screen on top of this step. This step builds the ground they stand on: colour tokens for dark and light, the restyled primitives, and the new web and mobile shell.

## Change of approach (William, during the step)

Start afresh rather than keep the old code compatible. `main` keeps the old code as a reference, so nothing is lost.

- Build the new primitives cleanly, move every remaining caller onto them, and delete the old component, its tests and dead helpers in the same commit. No compatibility wrappers, re-export shims or aliases.
- Delete the old shell pieces outright once the new rail, top bar and bottom nav replace them, and remove the old colour variables and hard-coded colours rather than keeping them beside the tokens.
- Pages don't have to work until their own rebuild step. A page that gets in the way becomes a bare placeholder route ("Rebuilding in step N") and its old components, hooks, styles and tests are deleted.
- What must keep working: the app builds; typecheck, lint, format:check and vitest stay green (tests go with the code they covered); auth and routing load, so a signed-in user lands in the new shell; and the API client, query hooks and data-layer code that later steps will reuse stay.
- The report lists the placeholders and every deletion.

## Source of truth

Local copies of the design boards (read-only reference, each a self-contained HTML file; the colour values sit in `THEMES` inside each script):

- `C:\Users\wsess\AppData\Local\Temp\claude\C--src-code-projects-onebillionbeers\ee93fc75-5df2-4c84-aaa1-0df2f3050f1c\scratchpad\artifact-files\9ca91174-6a67-4b62-801a-bef2e7f39b98\project\`
  - `E-Palette.dc.html`: both palettes and the type.
  - `E-Web-Warband.dc.html`: the web nav rail, buttons, chips, cards, stat strips, item boxes, drawers, modals.
  - `E-Mobile-Warband.dc.html`: the mobile top bar, bottom nav, cards, bottom sheets.
  - `E-Mobile-Battle.dc.html`: the battle-mode bottom bar and sheets.

## Tokens

Square corners everywhere (radius 0). Fonts stay: Fraunces (names, headings), Manrope (text), Space Mono (numbers).

| Token | Dark | Light |
| --- | --- | --- |
| page (ground) | #1a1510 | #f3ece0 |
| rail (nav, top bar) | #120e0a | #ebe2d2 |
| bar (post-game bar, feed) | #15110c | #efe6d7 |
| panel (drawers, sheets, modals) | #201911 | #fbf8f2 |
| surface (cards) | #221b14 | #fbf8f2 |
| raised (selected, boxes) | #2a2118 | #f1e9dc |
| line | #33291f | #e3d7c4 |
| border | #3a2f23 | #d9cbb6 |
| strong (input and secondary borders) | #554533 | #bfae95 |
| ink | #f2e7d2 | #2b211a |
| head | #f8eedb | #1f1712 |
| text2 | #ddcdb2 | #4a3c2f |
| muted | #b3a286 | #6f5d4b |
| faint | #a8977c | #75624f |
| accent | #e49a58 | #b4532a |
| on-accent | #1c1209 | #ffffff |
| accent-text | #f0b47e | #9e4520 |
| accent-soft | rgba(228,154,88,0.14) | rgba(180,83,42,0.10) |
| accent-line | #8c5e36 | #d9a88e |
| accent-hi | #f5bf8c | #8f3d1b |
| danger-bg / danger-line / danger | #2c140e / #7a3528 / #f2a28e | #f8e3dc / #d9a090 / #9b2f1c |
| good / good-bg / good-line | #a9e3b0 / rgba(143,227,154,0.12) / #4f8a57 | #2e6b3a / #e3efe2 / #9cc29f |

- Put them on `:root` as CSS variables and point the shadcn/Tailwind variables at them (background, card, popover, primary, border, input, ring, destructive and the rest). Add Tailwind colour names for the new ones (rail, bar, raised, text2, faint, accent-text, accent-line, accent-hi, good, danger-bg). The older `--color-*` names go: their callers move onto the tokens.
- Light mode is in from the start: `data-theme="light"` on `<html>` swaps the set. Dark is the default. The choice persists per device (localStorage, wrapped in try/catch) and is applied before first paint.
- Remove hard-coded colours from the code that stays (move them onto tokens). List any you leave in the report.

## Primitives

Rebuild what exists in `frontend/src/components/ui` and add what E needs. Move the callers that remain onto the new primitives and delete what they replace.

- Button: primary (accent fill), secondary (strong outline on surface), ghost, danger text, and icon-only (44px square, `aria-label` required).
- Chip / pill with a pressed state (accent-soft fill, accent-line border, accent-hi text).
- Card: surface fill, border, no radius. Expanded state uses accent-line.
- Dialog (centred modal), Drawer (new: right side, about 600px, scrim, header with kicker and title) and BottomSheet (new: mobile, drag handle, header, scrolling body, optional footer).
- Stat strip: the 10-cell profile (M WS BS S T W I A Ld Sv) with highlighted cells (the mounted M and Sv).
- Box tile: the item and skill boxes (name, a type line under it, kinds for item, mount, injury and quiet).
- Toggle switch with a square knob, segmented tabs, inputs and selects on the new tokens.

## Shell

**Web (desktop breakpoint):** a left nav rail, 232px, as in `E-Web-Warband`.
- Campaign name block.
- A tools row with Dice, Chat and Notifications, wired to whatever the current campaign top bar (`CampaignTopBarActions`) opens today.
- Sections:
  - Campaign: Overview, Battles.
  - My warband: Warband, Encampment.
  - Reference: Search everything, plus the existing reference pages.
- Footer: user, the light/dark toggle, Settings.

Store and Locations become drawers on the warband page in step 2. The rail links to the Wargear and Locations routes, which are placeholders until their steps.

**Mobile:**
- **Top bar:** kicker and title on the left; Dice, Chat and Notifications on the right, 44px each.
- **Bottom nav:** Campaign, Warband, Battle, Reference, Me. It is flat (no pop-out button), and the current item gets the accent and an inset top line.
- **On battle routes the bottom bar becomes:** Rules, Melee, Ranged, Dice, Menu.
  - Crit tables sit inside Melee and Ranged.
  - Menu opens a bottom sheet with today's battle actions: finish or leave the battle, notes, chat, notifications.
  - Chat and notifications must stay reachable during a battle; today they are missing there.
  - While the battle pages are placeholders, Melee and Ranged hold the crit tables and the Menu holds chat, notifications and leaving; the battle screen step adds its own actions (finish, notes, the helpers) through the shell.

## Out of scope

No backend changes. No page redesigns beyond the shell: the warband page, post-game, store, overview, battle screen and reference pages are later steps, and until then they are placeholders. Don't add help text to explain the UI.

## Working rules

- Gate after every commit:
  - frontend typecheck, lint, `format:check` and vitest, all green;
  - copy the pattern of `scratchpad/rwfe-gate.sh` and `scratchpad/wt-ferw.sh` (Docker, own `node_modules` volume) for this worktree, as `wt-fenext.sh` and `nextfe-gate.sh`.
- Small commits in the repo's style (`feat(frontend): …`, plain English, what changed and why). No attribution lines. Don't push, don't merge, never use bare `git stash`.
- Tests: cover the theme switch (default, toggle, persistence, before-paint script), the shell's nav per breakpoint and battle mode, and any primitive with logic.
- When done, or told to stop, write `scratchpad/next-1-report.md`:
  - commits;
  - what moved where in the shell;
  - which pages are placeholders, and what was deleted;
  - colours left hard-coded;
  - anything that needs William's call.
