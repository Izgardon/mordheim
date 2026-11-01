# William's answers to the import report review list

Branch `data/report-answers`, in `.worktrees/answers`, based on main `1aa6c446`. This is data only. The changes go through `backend/catalogue_import/overrides.json` (its `_readme` explains each key), and adding new override keys or build logic is fine where a decision needs it. Rebuild `out/` in the container, and update the report so it shows each item as settled.

I merge the branch myself. Production is wiped and reseeded at deploy, so the seed and `out/` are all that matter.

The codes refer to the list I typed out for William, built from `out/import-report.md`. He answered A, B and F; everything he didn't mention is taken at my recommendation.

## A. Item contradictions

Each item below gets these warband types added to who can buy it, on top of its mordheimer list. The notes say "X only" and the lists predate these warbands.

| Code | Item | Add |
| --- | --- | --- |
| A1 | Elven Steed | Druchii, Wood Elves of Athel Loren |
| A2 | Giant Spider | Night Goblins (WEB) |
| A3 | Giant Wolf | Forest Goblins (NC), Night Goblins (WEB) |
| A4 | Gnoblar Fighter | Ogre Hunting Party only. **Not Black Dwarfs** (William: "black dwarves dont get gnoblar fighters"). |
| A5 | Rhinox | Ogre Hunting Party |
| A6 | Chaos Dwarf Blunderbuss | Black Dwarfs |
| A7 | Sons of Hashut Obsidian Weapon | Black Dwarfs |
| A8 | Ball and Chain | Nothing. **Forest Goblins don't get it** (William). Keep mordheimer's list. |
| A9 | Dwarf Axe | Dwarf Slayer Cult |
| A10 | Squig Prodder | Forest Goblins (NC), Night Goblins (MIC) |

**Keep mordheimer's list as it is:**
- A11 Dragon Sword
- A12 Fighting Claws
- A13 Trip Wire
- A14 Vial of Pestilens

**A15, "Humans only" mounts** (Riding/Draft Horse, Warhorse, Rickshaw): keep mordheimer's list, and add the 13 human warbands it misses:
- Court of Profane Pleasures
- Cursed Cavalcade
- Dreamwalkers (Cult of Morr)
- Grave Robbers
- Mazzalupo
- Nipponese Expedition
- Order of the Mare
- The Outlaws of Stirwood Forest (Redux)
- Protectorate of Sigmar
- Sorcerous Society
- Vampire Hunters of Sylvania

The report gives the exact list; use its names resolved to our slugs.

**A16, Wardogs:** keep the exclusion list (all Skaven, including Clan Pestilens).

**A16, Tome of Magic:** exclude **only** Witch Hunters and Sisters of Sigmar, as its note says. William: "why no pestilens, isn't it available to any caster?" Clan Pestilens comes off the exclusion list.

**A17, Black Lotus and Dark Venom:** keep the exclusion.

**A18, Blowpipe:** Common only for Forest Goblins (NC), as now.

## B. Items no one may buy

- **B1, Fist:** stays unbuyable (the unarmed attack).
- **B2, Spiked Gauntlet:** Pit Fighters may buy it. William: "pit fighters is a legitimate warband so that weapon should appear for them". Make sure the Pit Fighters warband type, and Pit Fighters (old) if that type exists, can buy it, and that it shows in their store.

## C. Warband name mappings

All five stand as mapped:
- C1: Chaos Dwarfs to Black Dwarfs.
- C2: Wolfcloak's "Mercenaries" left out.
- C3: Norse Explorers to both types.
- C4: Night Goblins to MIC, with WEB separate.
- C5: Amazons to both types.

Mark them as settled in the report.

## E. Warband groups

| Code | Group | Decision |
| --- | --- | --- |
| E1 | Humans | Add Pit Fighters. Not Undead, Mootlanders or Black Dwarfs. |
| E2 | Humans | Keep the 7 newer human warbands. |
| E3 | Elves | Keep Druchii and Wood Elves. |
| E4 | Dwarfs | Keep Dwarf Slayer Cult. |
| E5 | Skaven and Goblins | Underworld Alliance stays in both. |
| E6 | Skaven | Don't add Nipponese Expedition. |
| E7 | Skaven | Keep Clan Moulder. |
| E8 | Orcs & Goblins | Snotlings stay in Orcs & Goblins, not in Goblins. |
| E9 | Orcs & Goblins | Don't add Sons of Hashut. |
| E10 | Mercenaries | Add Imperial Outriders and Lustrian Reavers. |
| E11 | Good | Add Imperial Outriders. |
| E12 | Evil | Add Beastmen Raiders only. |

## F. Settings

- **F1:** accept all 28 skill settings as taken.
- **F2:** Norse Shaman (hired sword) lives in **Border Town Burning**, not Lustria (William).

## Checks

- Run the import's tests and the backend gate (`scratchpad/wt-answersbe.sh` and `answersbe-gate.sh`; database `mordheim_answers`, create it if needed).
- Add or adjust import tests for the new override keys you add.
- Spot-check after a reseed, using a dev database copy or the seeders in a test:
  - the who-can lines for Gnoblar Fighter, Tome of Magic and Spiked Gauntlet;
  - the Norse Shaman's setting;
  - the group memberships changed above.

## Rules

- Small commits in the repo's style, with no attribution lines.
- No push, no merge, never a bare `git stash`.
- Never run python or python3 on the Windows host; use the containers only (`python -I catalogue_import/build.py` as the import's README says).
- Leave William's dev stack (`mordheim-*-1`) and the other agent's `.worktrees/polish2` alone.

## Report

Write `scratchpad/report-answers-report.md`: the commits, each code and what changed, and the spot-check results.
