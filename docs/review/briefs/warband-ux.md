# Warband page: recruiting, unit cards and the Edit form

Branch `feat/warband-ux`, in `.worktrees/wux`, based on main `d8e32076` (live). I merge to main myself; main auto-deploys.

Read `CLAUDE.md` first, especially "No fluff text" and "A guide, not a gatekeeper". These are William's requests from 1 Nov 2026, with his words quoted. Warband templates will change recruiting later, but he wants today's flow fixed now.

Design reference:
- the design E boards `E-Web-Warband-Hero.dc.html`, `E-Web-Warband-Edit.dc.html`, `E-Mobile-Hero.dc.html` and `E-Mobile-Edit.dc.html`;
- the scratchpad `artifact-files\9ca91174-6a67-4b62-801a-bef2e7f39b98\project\` folder.

William: "the expanded layout on web isnt ideal ... a lot of empty space which is why i initially went for a column layout". Follow the boards' column layout more closely than the current build does.

## 1. Recruiting

> "the initial modal is empty, and i think i would prefer it being an inline form rather than a modal with a few more key fields at the beginning, it should then automatically start in the edit mode after saving"

- **Replace the recruit modals with an inline form.** This covers Add hero, Add group and Hire's "someone not in the list". The form opens in the roster section it belongs to, at the top of Heroes, Henchmen or Hired swords.
- **Key fields:**
  - name;
  - type;
  - race, using the new searchable select (part 4);
  - cost or hire fee, editable;
  - for a group, how many;
  - starting XP.
- **No empty modal.** The form opens with its fields ready.
- **After saving:** the new unit's card opens straight away in its Edit mode, so the rest (profile, skills, items) is filled in there.
- Camp's Recruit and the hire picker keep their flows, but must land in the same place: the new card in Edit mode.

## 2. Unit cards

1. **A bigger click target.** "more of the card should be clickable to expand it". The whole header row toggles the card, not just the arrow. Buttons inside it keep their own actions.
2. **Web layout when expanded.** Use columns rather than stacked full-width sections:
   - the profile and XP;
   - items;
   - skills, specials and spells;
   - injuries and the rest.

   Lay them out the way the boards do, so a wide screen has no big empty rows. A phone stays one column.
3. **Section titles get icons.** "i want more icons in places such as the titles like skills/specials". Use lucide icons that fit Items, Skills, Specials, Spells, Injuries and the loadout.
4. **Items get icons by kind.** "items themselves could have icons depicting what they are, weapon, ranged, black powder, armour, misc etc".
   - Map each item's type and subtype to an icon:
     - melee weapon;
     - missile weapon;
     - blackpowder;
     - armour or shield;
     - miscellaneous;
     - animal or mount;
     - consumable;
     - trade good.
   - Show the icon in the item chip, the loadout, the stash and the store rows.
   - Keep the mapping in one place.
5. **Chips you can tell apart.** "i also dont like the pills for items/skills etc they are a bit flat and no way to tell apart".
   - Give item, skill, special, spell and injury entries a distinct treatment: the icon, plus a subtle per-kind accent or border.
   - Each entry also gets a second line in muted text where useful: an item's kind, a skill's category, a spell's lore.
   - Keep the E style: square corners and the tokens.
6. **Kills are a number.** "i also dont want kills displayed the same way as if they are part of the spells/specials, it should be somewhere else, just display a number that is clickable for a breakdown".
   - Remove the Kills section from the expanded card.
   - Show the kill count as a compact figure in the card's top row ("Kills 3"), on the web and a phone.
   - Clicking it opens the breakdown: the existing kill history list, in a popover or sheet.
7. **The trading action toggle.** Make it compact and move it to the card's top row, a small toggle with its label, not a boxed control. The same applies in Edit (part 3).
8. **No fluff.** No "None yet" lines under empty sections. An empty section shows only its title and its add control, or is hidden when there's nothing to add from the card.

## 3. The Edit form

1. **Stat boxes may be empty.** An empty box saves as 0, with no null checks or errors.
2. **The searchable select** (part 4) replaces every picker in the form: race, skills, spells, specials, skill access, and "choose a special skill group".
3. **Half-rate XP.** "half rate xp isnt in line and i would prefer it spaced apart in the input title line with a much thinner toggle rather than a separate input". Put it in the XP field's label row, right-aligned, as a thin toggle.
4. **Toggles in general:** just the toggle with its text, never a bordered box. This covers Leader, Large, Caster and the others.
5. **Spells** only show when the unit is a caster (Wizard or Priest).
6. **The trading action** moves to the top row of the form and is made compact.
7. **Missing games** comes out of the body. It becomes a button at the bottom right, next to Dismiss, and opens a small form for the count and reason.
8. **While editing:**
   - hide the card's loadout and expand buttons;
   - all actions sit at the bottom, with Duplicate on the left next to Save and Cancel, and Missing games and Dismiss on the right.
9. **A more compact sheet** ("the edit sheet again is quite big ... stat line doesnt need to be full etc"):
   - the stat line as a compact row of small boxes, not full width;
   - tighter spacing;
   - group related fields onto shared rows.

   Apply this on the web inline form and the phone sheet.

## 4. The searchable select component

> "most importantly we need a custom input for searching and selecting that needs to be used everywhere we had it before: races, skills etc, result rows in this input should have titles and subtitles with skill category, spell school as subtitles as i am blind here, subtitles for the selected ones as well"

- **One shared component** in `components/ui`, used everywhere the app picks from a catalogue:
  - races, skills, spells, specials, items, the special skill group and warband types;
  - the Edit form, level-up picks, "Skill to choose", the store's item search where it fits, and the hire picker where it fits;
  - any other combobox.
- **Each result row** has a title and a muted subtitle:
  - skill: its category ("Combat", "Skaven special");
  - spell: its lore and difficulty;
  - item: its kind and price;
  - race: its maximums or source;
  - special: its type.
- **Rows outside the unit's access or the campaign** keep today's greyed-out "not usually" warning in the row and stay pickable.
- **Selected values** (chips) show the same subtitle.
- **Interaction:**
  - keyboard: arrows, Enter, Escape;
  - type to filter;
  - an empty-state row only if nothing matches.
- **Accessible:** use the combobox and listbox roles.
- **Multi-select** (skills, spells, specials) and **single-select** (race, skill group).
- Delete the old pickers it replaces.

## 5. William's follow-ups (1 Nov 2026)

1. **Add resource opens in place.** "can the add resource button open its form in place of the button rather than on a new line". The resources section's Add resource button turns into its small form (name, amount, Add, Cancel) in the same spot. Once you add or cancel, it goes back to being the button.
2. **Number inputs get − and + buttons.** "we also need number inputs used around the site to have immediate plus minus buttons on them for quick changes".
   - Give the shared `NumberInput` (in `components/ui`) − and + buttons attached to the field. They respect min, max and step, and hold-to-repeat is optional.
   - Use it for every number field in the app: costs, prices, gold, amounts, stats in Edit, XP, counts, seats, dice modifiers, bounty amounts, sell quantities, missing games, location D6 results.
   - Fields that already have their own − and + (the resource counters, the XP bar) don't need a second pair.
   - On a phone the buttons must be easy to hit, at least 36 px.
3. **"Advance ready" starts the advance.** "advance ready button on unit card should be clickable to start the advance". The badge on the closed card is a button that opens that unit's Advance flow straight away, without expanding the card first.
4. **Fantasy icons.** "can we also change the store and stash icons, i like the simple 2 icons but want more fantastical ones, can we try and find a library that helps with that goal as can use them in the above mentioned places too".
   - **Library:** use Game Icons (game-icons.net) through `react-icons/gi`. That's 4,000+ fantasy icons (swords, bows, blunderbusses, armour, potions, coin pouches, chests) and they tree-shake. Add `react-icons` back as a dependency and import only `react-icons/gi`.
   - **Licence:** Game Icons are CC BY 3.0, which means attribution is required. Add a short credit, "Icons by Lorc, Delapouite and contributors, game-icons.net, CC BY 3.0", somewhere unobtrusive: the landing footer and the Account page. List it in the report.
   - **Where to use them:**
     - the warband header's Store and Stash buttons, for example a merchant's stall or coin pouch for the store and a chest for the stash;
     - the item icons by kind (part 2.4);
     - the section title icons (part 2.3);
     - other places where a fantasy icon reads better than a lucide one (gold, wyrdstone, kills, XP).
   - **Keep lucide** for plain UI controls: chevrons, close, plus and minus, search, settings.
   - **One file** holds every icon choice, `components/ui/game-icons.tsx`, so a swap later is one edit.
   - Size and colour the icons with the E tokens so they sit with the text in both themes.

## 6. Two small bugs found by the last batch

1. **The Battles list page on a phone** shows the battle top bar and battle tools, not the normal bottom nav. Only a battle's own screens should have the battle bar.
2. **At 1440 px the overview's standings table scrolls sideways.** Make it fit: tighter columns, drop a column at that width, or let a long warband name wrap.

## Rules

- **Gate:** typecheck, lint, format, build and vitest. Run the backend gate only if the backend changes, for example if stats can't be saved as 0.
- **Tests:** write vitest tests for the searchable select and the recruit-then-edit flow.
- **Commits:** small, in the repo's style, no attribution lines. No push or merge, and never a bare `git stash`.
- **Python:** never run python or python3 on the Windows host; containers only.
- **Browser checks:** web at 1440 and 1920, a phone at 375, light and dark. Use your own containers, ports and tab, and a distinct host.
- **William's dev stack** (`mordheim-*-1`) stays untouched.

## Report

Write `scratchpad/warband-ux-report.md`, or put it in your reply if the file is refused. Cover:
- commits;
- each numbered point and what was done;
- the icon mapping;
- the components deleted;
- screenshots by path.
