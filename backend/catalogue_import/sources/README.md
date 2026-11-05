# Catalogue import sources

Snapshots the build script reads. They are data only, copied byte for byte from the research downloads of
21 October 2026, so the build never touches the network or anything outside the repo. Replace a file only on
purpose, note the new date here, and review the diff of `out/` that follows.

| File | What it is | Where it came from |
| --- | --- | --- |
| `mordheimer-items.json` | mordheimer's 247 items (array): rules, fluff, costs and who can buy | The JSON embedded in mordheimer.net's page bundle for `/docs/warbands/grade-1a-warbands/averlander` (webpack chunk), 21 Oct 2026 |
| `mordheimer-skills.json` | mordheimer's 259 skills (array) | The same bundle, 21 Oct 2026 |
| `mordheimer-hired-swords.json` | mordheimer's 72 hired swords (object keyed by slug) | The JSON embedded in the bundle of mordheimer's structured test page for the Averlanders, 21 Oct 2026 |
| `mordheimer-dramatis-personae.json` | mordheimer's 30 dramatis personae (object keyed by slug) | The same test bundle, 21 Oct 2026 |
| `warbands-merged.json` | 162 warband types: name, race, Broheim and mordheimer grade, setting, source and links | Broheim's warband tables (broheim.net) merged by name with mordheimer's warband index, 21 Oct 2026 |
| `cavalcade-skills.json` | the Cursed Cavalcade's 3 skills (name, description, source), which mordheimer's skills list lacks | mordheimer's Cursed Cavalcade warband page, 4 Nov 2026 (the skill groups brief) |
| `random-mutations.json` | the Random Mutation Table's 36 D66 results: each roll and the name as the table prints it, and two of the table's rules in short; no rule text (each result's special is worded in `apps/special/data/shared-specials.json`) | mordheimer's Power in the Stones page, https://mordheimer.net/docs/optional-rules/power-in-the-stones#random-mutation-table (first printed in Town Cryer #15), 5 Nov 2026 (the mutations brief) |

Also read, from the repo itself: `apps/items/data/mim-items.json` (the 62 Mutiny in Marienburg items) and
`apps/items/data/item-properties.json` (the property names those items point at), plus
`apps/items/data/standard-items.json` only to list what the first pass drops.

Our skills table (`apps/skills/data/skills.json`: a name and its list per row) becomes `out/skills.json` (one skill
per name) and `out/skill-groups.json` (each list a group holding its skills, with who learns from it), plus the new
groups overrides.json names (`new_skill_groups`, their new skills' rules from `mordheimer-skills.json` or
`cavalcade-skills.json`). Hired swords and dramatis personae are not converted yet. The build reads them for setting
grades, as evidence for warband group membership, and to give our own seeded skills, hired swords and dramatis
personae (`apps/hirelings/data/`) their settings in `out/setting-assignments.json`.
