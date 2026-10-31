# Next, polish pass: contrast, width, dividers and loading states

You're on branch `next-polish` in `.worktrees/next-polish`. It branches from `next` at `f33a5a19`. Another agent is rebuilding items on `next`, and a third is investigating performance on `next-perf`.

- Commit only to `next-polish`.
- Keep out of the items, store and Wargear code where you can. Restyling their layout through shared components is fine.
- I'll merge afterwards.

William looked at the preview of `next` and asked for these four changes.

## 1. Darker background, more contrast

> "There isn't enough contrast between the cards and the main background colour on login, campaigns and main app, I think background needs to be darker."

- In dark mode, make the page background clearly darker than the cards, panels and surfaces. Today the page is `#1a1510` and the surfaces are `#201911`, `#221b14` and `#2a2118`. Something around `#0f0c09` would work.
- The rail, the top bar, the phone nav and the battle bar must still read as distinct from the page. Adjust them so the hierarchy holds: page darkest, then chrome, then cards.
- Do the same check in light mode. The page is `#f3ece0` and the surface is `#fbf8f2`, so the cards barely separate there either. A slightly deeper page would help.
- All of this happens in the tokens, not per page.
- Check text contrast still passes WCAG AA on every background you change.
- The pages to check are login and landing, campaigns, and every in-app page.

## 2. Width

> "We aren't using full page width, if we are capping the main content width can we center it in the page and can probably make it a bit wider as feeling forcibly narrow."

- Find where content is capped. It is probably the shell's main column and the page containers.
- Centre the content in the space beside the rail.
- Raise the cap to around 1440–1600 px for the app pages (overview, warband, Battles, reference, Aftermath).
- Settings and similar form pages can keep a narrower reading width, but must be centred.
- Campaigns and Account should be centred and wide enough not to feel cramped.
- On wide screens, use the extra room sensibly. For example, the overview's columns and the warband roster grid can take more cards per row.

## 3. Dividers

> "Some more dividers between content on the overview page as an example and wherever else you think might fit."

- Add hairline dividers using the existing line token between the overview's sections:
  - the readiness bar;
  - the header;
  - the stats line;
  - standings;
  - battles;
  - the chronicle.
- Add them inside sections where rows run together, such as battle rows, chronicle entries and standings rows.
- Then go through the other pages and add dividers where content runs together:
  - warband (info line, resources, tabs, roster sections);
  - Aftermath;
  - Battles;
  - settings sections;
  - reference rows;
  - the campaigns list.
- Keep them subtle and consistent.

## 4. Loading states

> "Can we update the loading states, seems to be using old cards and not matching current layout."

- Rebuild the loading skeletons so each one mirrors its page's real layout: the same columns, sections, row heights and dividers, in E's square style. Cover:
  - campaigns;
  - overview;
  - warband;
  - Aftermath;
  - Battles;
  - the battle screen;
  - the reference pages;
  - settings;
  - Account.
- Use the shared skeleton primitives and delete the old card-shaped ones.
- The full-screen swords "Loading…" should appear only at app boot, before auth resolves. Route changes inside the app should show the page skeleton inside the shell, so the rail and bar stay put.
- Check what shows during lazy route chunk loading (the Suspense fallback). It should be the shell with a skeleton, not a blank or full-screen loader.

## Rules

- Delete old code freely.
- Light testing. The gate is typecheck, lint, format, build and vitest. Use the backend gate only if you touch the backend, which you shouldn't need to.
- Small commits in the repo's style, with no attribution lines. No push or merge. Never bare `git stash`.
- Never run python on the Windows host, not even `--version`. Containers only.

Scripts are in the scratchpad: `wt-fepolish.sh` and `polishfe-gate.sh`. Their node_modules volume is `mordheim_frontend_node_modules_polish`; run `npm ci` in it first. For the backend, use `wt-polishbe.sh` (database `mordheim_polish`).

**Browser check:** run your own stack against a copy of the dev database, as earlier steps did (`scratchpad/next10/` has helpers).

- Use container names `mordheim-polish-*` and a free port.
- Don't touch `mordheim-preview-*` on 5174 (William's preview) or the containers of the other agents.
- Check light and dark, at 1920, 1440 and 375 px widths.
- Throttle the network to see the skeletons.

## Report

Write `scratchpad/next-polish-report.md`:

- commits;
- the token changes, before and after, with their contrast ratios;
- the width rules;
- where dividers were added;
- the skeletons rebuilt;
- before and after screenshots, listed by path.
