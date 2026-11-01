# Overview layout, a fluff sweep, and a "raise your warband" banner

Branch `feat/fluff-and-banner`, in `.worktrees/fluff`, based on main `55055c7e`, which is live. I merge to main myself; main auto-deploys.

Read `CLAUDE.md` first, especially the product principle **"No fluff text"** that William set today. This brief is mostly about applying it.

## 1. Overview layout (William)

> "put bounties below the chronicle and just give the chronicle a max height and let it scroll internally. also make sure the sections have the same font size titles."

- **Web:** Open bounties moves back below the Chronicle.
  - The Chronicle gets a max height and scrolls inside its own box, so the page stays short. Pick a height that shows roughly 8–10 entries.
  - Keep the filter chips fixed above the scrolling list.
  - The phone tabs stay as they are.
- **Section titles:** every section title on the overview uses one size and style. That covers Standings, Battles, Chronicle, Open bounties, the stats line's caption if it has one, and anything else. Use one shared component or class.
- **Other pages:** make section titles consistent on the pages that use the same pattern: the Battles page, the warband page's sections and settings. A section title is one style everywhere.

## 2. Fluff sweep (William)

> "again there is empty place holder fluff text, i wouldnt mind removing a lot from around the site that you think is obvious"

Go through every page and dialog, on the web and a phone:

- campaigns;
- Account;
- raising a warband;
- the overview;
- the Battles page;
- the warband page with every drawer and sheet (store, stash, locations, dice, loadout, edit, camp, ready);
- the Aftermath;
- the battle screen and pre-battle;
- the reference pages and Search everything;
- settings and the encampment;
- the landing and sign-in.

Remove text that explains what's already visible or says the obvious, for example:

- empty-state placeholders that only restate the obvious ("Nothing here yet. Add one to get started.");
- hints under fields that repeat the label;
- subtitles that describe the section below them;
- "You can change this later" lines;
- tooltips that repeat the button text.

**Keep:**
- warnings (guide, not gatekeeper);
- lossy-action wording ("all carried items are lost");
- numbers and limits the player needs (gold left, "3 of 5", ranges like 2 to 16);
- error messages;
- short empty states that tell the player something they couldn't otherwise see. Keep these as short as possible, for example "No battles yet."

When in doubt, cut it. Keep accessibility labels (`aria-label` and similar): they aren't visible fluff.

Update tests that assert removed text. List every cut in the report, grouped by page (old text, then new text or "removed"), so William can veto any of it.

## 3. "Raise your warband" banner (William)

> "if a user signs in and doesnt have a warband created can we have a permanent top of page banner on every page prompting them to create one"

- Inside a campaign, when the signed-in user has no warband in it, show a slim banner at the top of every campaign page, on the web and on a phone. It says "You have no warband in this campaign." with a "Raise your warband" button that opens the existing raise flow.
- The banner can't be dismissed. It goes as soon as a warband exists.
- It sits in the page flow under the top bars and never overlaps them. The archived-campaign banner fix shows the pattern.
- **Skip it** on the raise-warband page itself, and in an archived campaign. For members whose role can't have a warband, if such a role exists, check `campaign capabilities`.
- **Campaigns list:** a campaign card where you have no warband already says so. Make sure it does, with a link to raise one there.
- **The data:** use whatever the campaign layout already loads (the user's warband in the campaign, from the next-perf change). Add no extra request if it can be avoided.

## 4. The swords loader (William, added during the work)

> "keep swords when entering a battle and manufacture a min load time so we can make it more of a real animation, match the animation time"

- **Entering a battle.** Show the full-screen swords when the player goes into a battle's active screen: from the overview banner, from Rejoin, after Start, or from an invitation that turns into the fight.
  - A proper one-shot animation (the swords crossing and clashing) with a defined duration of roughly 1.2 to 1.6 s. Respect `prefers-reduced-motion`: a static frame and a short minimum.
  - The overlay stays up for at least one full animation, even when the data is already there, and until the data has loaded if that takes longer. Then it hands over to the battle screen without a flash.
  - The minimum time is one constant tied to the animation's CSS duration, so the two can't drift apart.
- **Elsewhere, no swords.** At app boot, show the plain page background and bring the swords in only if boot passes about 600 ms. Page changes use the in-shell skeletons.
- Drop the "LOADING..." caption under the swords if it is fluff.
- Delete anything this leaves unused. Its own commit.

## 5. Reference tables scoped to the campaign (William, added during the work)

> "for the reference tables, can we just have 'mordheim' as an option rather than 1a, 1b etc versions. also these tables should always be scoped to the campaign settings and shouldnt offer in the dropdown or results that arent part of the campaign"

- **Setting filter.** On every reference page with a Setting filter, "Mordheim" is one option. It covers the settings `mordheim`, `mordheim-1b`, `mordheim-1c` and `mordheim-2a`, only those in play. No 1a/1b/1c/2a options. Other settings stay as they are, named without a grade suffix.
- **Scope.** The reference pages (Wargear, Skills, Spells, Bestiary, Hired swords, Dramatis personae) list only entries whose setting is in play in the campaign (ticked or always on, plus anything the campaign made itself; the server sends `in_play` and `setting_id`).
  - Out-of-play entries don't show at all: not greyed, no "Show all" for them.
  - The Setting dropdown lists only in-play settings.
  - The "What <warband> can buy" switch (warband restrictions) stays, scoped within the in-play entries.
  - Search everything's reference results take the same scope.
  - The store, the hire picker and the level-up pickers stay as they are (William is asked separately).
- **Tests:** a small frontend test for the Mordheim grouping and the scope filter. Its own commit.

## Rules

- Gate: typecheck, lint, format, build, vitest, and the backend gate if the backend changes (it shouldn't).
- Small commits in the repo's style, with no attribution lines. No push or merge. Never a bare `git stash`.
- Never run python or python3 on the Windows host for any reason. Containers only.
- Scripts (in the scratchpad): `wt-fefluff.sh` and `flufffe-gate.sh`, using the node_modules volume `mordheim_frontend_node_modules_polish2`. For the backend: `wt-fluffbe.sh` and `fluffbe-gate.sh`, with database `mordheim_fluff`.
- Leave William's dev stack (`mordheim-*-1`) alone. Use your own containers, ports and browser tab, with a distinct host such as `fluff.localhost`, and close them at the end.

## Report

Write `scratchpad/fluff-and-banner-report.md`. Cover:

- the commits;
- the overview changes;
- the title style;
- the full list of text cuts by page;
- the banner, and where it shows and doesn't.

If the harness refuses the report file, put the whole report in your final reply.
