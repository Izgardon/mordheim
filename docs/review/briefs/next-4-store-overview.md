# Next, steps 4 and 5: the store, the overview and the Battles page (plus step 3's leftovers)

Branch `next`. Read first: `scratchpad/next-1-report.md`, `next-2-report.md` and `next-3-report.md`, and the earlier briefs in this folder.

Same rules:

- Delete old code freely.
- Light testing: the gate is typecheck, lint, format, build, the remaining vitest suites and the backend gate when the backend changes.
- Small commits in the repo's style, no attribution lines, no push or merge, never bare `git stash`.
- Don't stop for sign-off. Choose what keeps the design's intent and note it.

Scripts are in the scratchpad: `wt-fenext.sh`, `nextfe-gate.sh`, `wt-nextbe.sh`, `nextbe-gate.sh`.

Design boards (local copies, current):

`C:\Users\wsess\AppData\Local\Temp\claude\C--src-code-projects-onebillionbeers\ee93fc75-5df2-4c84-aaa1-0df2f3050f1c\scratchpad\artifact-files\9ca91174-6a67-4b62-801a-bef2e7f39b98\project\`

- `E-Web-Warband.dc.html`: the store drawer (view "store"), basket included.
- `E-Mobile-Warband.dc.html`: the store sheet, with the basket bar.
- `E-Web-Overview.dc.html`, `E-Mobile-Overview.dc.html`

## Part A: step 3 leftovers

1. The Aftermath gets Finds (gold and items) and the "keep stat changes" ticks, in the tab where they fit best.
2. Skip post-battle and Close post-battle go in the Aftermath's ⋯ menu.
3. On the Aftermath, the rail highlights Warband.
4. The camp Buy chip and row tick once something has been bought after the battle.

## Part B: the store (step 4)

One acquire panel, used by the store drawer (web), the store sheet (phone), Buy again on an item, and later the Wargear page's "Get this item".

- **Drawer layout:** search; a "What I can buy" toggle (on by default; when off, restricted items show with a short warning such as "Skaven only" and can still be bought); category chips; rows (name, type, price, Common or Rare N); Get.
- **Common items:**
  - the price is prefilled and editable;
  - a small Free checkbox (found or given; today's Give, with a reason);
  - one button per recipient showing the total ("Aldric · 15 gc", "The Long Shots ×3 · 45 gc"). One tap adds the item to the basket.
- **Rare items:**
  - The rarity number can't be edited.
  - A search bonus runs from −3 to +10 and defaults to 0.
  - Search with a hero (it spends that hero's trading action, as today) or with no hero.
  - Buy without searching skips the roll.
  - The result line reads like "Aldric rolled 4 + 3, +1 bonus = 8. Found one."
  - The recipient buttons appear once the item is found or the search is skipped.
- **Variable gold** (for example 100 + 1D6×10): a roll button fills in the price, and it can be rerolled.
- **From a unit:** when the store is reached from a unit (its loadout, Add item, Equip or Buy again), that unit's button comes first and is highlighted, and the header says "Buying for <name>". The header Store button opens with no unit chosen.
- **Basket:**
  - lines show the item, the recipient and an editable price, with Remove;
  - the total and the gold left;
  - Buy all.
  - On a phone the basket is a bar at the bottom of the sheet that opens to list the lines.
- **Backend:** wire to today's acquire API: buy with rarity and price, rarity rolls spending trading actions, give free with a reason. Add only what's missing, for example a search bonus or no-hero searches.

## Part C: the overview and the Battles page (step 5)

- **Overview** (`E-Web-Overview`, `E-Mobile-Overview`):
  - **Readiness bar:** each player's state (Ready, Post-game, In battle).
  - **Header:** Start battle and Report a result, the same size, plus a ⋯ menu with Invite a player, Campaign settings and Export.
  - **Stats line.**
  - **Standings table:** each warband links to its warband page.
  - **Battles list:** each row expands to its key moments grouped by turn, several per turn (kills, out of action, routs, finds, plus deaths in an "After" group). No level-ups.
  - **Chronicle:** filterable by All, Kills, Deaths, Level-ups (hero level-ups and lad's got talent only), Purchases and Trades.
  - **Open bounties:** only if bounties exist in the backend; otherwise leave the panel out and note it.
  - **Phone:** tabs for Standings (first), Chronicle, Battles and Bounties.
- **Starting a battle:**
  - It is never blocked by players still in their post-game.
  - Starting one readies you up.
  - Reported results (Approve, Decline, Withdraw) and the unfinished or stuck battle banners must stay reachable on the overview.
- **Battles page** (the rail's Battles link): every battle, in the same expandable rows.
- Use the existing battle event and kill data for moments. If something isn't recorded per turn, put it under "During".

## Report

Write `scratchpad/next-4-report.md`:

- commits;
- what works;
- placeholders;
- backend changes;
- calls you made.
