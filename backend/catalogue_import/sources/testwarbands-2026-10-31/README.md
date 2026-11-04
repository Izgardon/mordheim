# mordheimer "New Warband Format" snapshot, 31 October 2026

Data only, for warband templates after the switch (William, 2026-10-31: "templates after the switch"). The
warband templates import reads the warbands, `magic.json` and `race-max-stats.json`; the serious injury table
(`injuries.py`, `out/serious-injuries.json`) reads the 20 serious injuries in `serious-injuries.json`.

Taken from https://mordheimer.net/docs/testwarbands: the JSON embedded in each test page's webpack chunk, pulled
out as text and checked with `JSON.parse` (no downloaded code was run), saved with a 2-space indent.

| File | What it is |
| --- | --- |
| `warbands/<page-slug>.json` | 50 warbands (grade 1a 13, 1b 24, 1c 13): fighters with profiles, costs, quantities, group sizes, starting XP and skill access; equipment lists with list prices; special rules; starting gold and max models |
| `manifest.json` | each warband's page URL, chunk, id, name, grade and fighter count |
| `magic.json` | 30 spell lists, 182 spells, who can cast them (warband and fighter, or a hired sword / DP caster) |
| `race-max-stats.json` | 27 races' maximum profiles |
| `warband-index.json` | mordheimer's 75-warband index (name, link, race, setting, source, grade) |
| `serious-injuries.json`, `errata.json`, `faq.json` | 56 injuries, 135 errata and 150 FAQ entries the pages link to |

The same pages also embed hired swords, dramatis personae, skills and items: identical to the 21 October
snapshots in `../`, so they are not repeated here.

Mapping to `out/warband-types.json`:
- 47 pages map to exactly one type (42 by mordheimer URL, 5 by name: `cult-of-the-posessed` is mordheimer's
  spelling);
- 3 map to several: `mercenaries` to the Reiklanders, Middenheimers and Marienburgers (plus Ostermarkers as a
  rules heading), `tileans` to its four cities, `norse` to Norse Explorers (TC13 by its grade and setting);
- 1 matched none: `tileans-original` ("Tileans (old)"), taken out of the snapshot (William, 4 Nov 2026: none of
  our types is Tileans (old)). `manifest.json` still lists it, as fetched.

Grade 2a warbands are not in the test set yet.

Equipment lists name items in lowercase, matching an item's name or one of its `tags` in
`../mordheimer-items.json`; 20 names match nothing (mostly warband-only `specialEquipment`).
