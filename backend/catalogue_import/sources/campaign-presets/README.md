# Campaign presets

One file per published campaign, read in place by `manage.py seed_campaign_presets`
(`apps/campaign_presets/seeding.py`) and upserted by `slug`.

A campaign makes two choices: which published campaign it plays (the preset, which dictates the rules) and what
content is in play (the settings ticked, which the preset only guides). **A field left out means the preset says
nothing about it**, and the campaign keeps its own value — Mordheim's preset dictates nothing at all. Never fill a
field in from another preset or from the app's defaults: silence is data.

| Field | Meaning |
| --- | --- |
| `slug` | What the row is upserted by. Required. |
| `name` | What the dropdown shows. Required. |
| `sort_order` | Where it sits in the dropdown; the settings' own order is a good guide. |
| `settings` | The settings it guides the content choice towards, by **name** as `out/settings.json` holds it. They are ticked on top of whatever the campaign has, never instead of it. |
| `exploration_chart` | The chart it explores by, by the **slug** of a book chart in `sources/exploration/`. |
| `enable_locations`, `enable_encampments`, `enable_campaign_points`, `enable_blood_pacts` | `true` or `false`. |
| `max_heroes` | The most heroes a warband may hold. |
| `hero_death_roll` | `d66` or `d100`. |
| `main_resource` | What every warband's default resource is called (Treasure in Marienburg); left out, the campaign names it (Wyrdstone unless changed). |
| `resources` | Other counters every warband is given and may not delete or rename, by name (Marienburg's `["Wyrdstone"]`). |
| `skill_wordings` | Its own wording of book skills, `[{"skill", "description"}]`: a campaign taking the preset up gets its version of each, as though edited there (Revert takes it back); one it already has a version of is left alone. |
| `rules` | A file in `sources/campaign-rules/` (without `.json`) holding the campaign's rules, battle rules and charts — see below — or a list of them, read in order (Mutiny in Marienburg + Annual: Marienburg's file, then the Annual's on top; no title may repeat across them). Leave it out for a campaign whose rules we have not written yet. |

A preset naming a setting, a chart or a rules file we do not hold is **skipped with a warning** and never seeded
half-built. A preset the folder drops is left where it is, because a campaign may have picked it.

Nothing a preset dictates is a block: the pages grey the controls it sets, keep them operable, and warn when the
owner departs from one.

## A campaign's rules file

One file per published campaign in `sources/campaign-rules/`, named by the preset's `rules` field. It holds four
lists, each optional; a list left out is a list the campaign has none of.

```json
{
  "rules": [{ "title": "Campaign points", "text": "…", "umbrella": "" }],
  "battle_rules": [{ "title": "Fog", "text": "…", "umbrella": "Weather" }],
  "charts": [
    {
      "title": "Seaside Situations",
      "description": "Roll at the start of each of your turns.",
      "dice": "D66",
      "note": "Re-roll a result the ground doesn't allow.",
      "umbrella": "",
      "rows": [{ "result": "11-15", "name": "What is that!?", "text": "…" }]
    }
  ]
}
```

- A **battle rule** only matters while a game is being set up or played (the weather, the ground, an encounter being
  triggered); a **campaign rule** is about the campaign between games. They are one table told apart by their kind,
  so a title must be unique across both lists.
- `umbrella` is the heading clearly related rules or charts share (William, 19 Nov 2026: "one modal for all shared
  rules"). Blank means it stands alone. Use one only where two or more belong together.

  **Group a new campaign's rules as you write it** (William, 20 Nov 2026), its campaign rules as much as its battle
  rules: a run of rules on one subject becomes one row the player opens once, so Marienburg's 17 campaign rules read
  as 9 and Khemri's 9 as 3. These names already recur, so reach for them before inventing one:

  | Umbrella | What it gathers |
  | --- | --- |
  | `Campaign points and plots` | the six that open Marienburg and Border Town Burning alike: the points, choosing a plot, changing plot, points once lost, winning the campaign, starting over |
  | `Captives` | prisoners, stragglers, who takes a captive, a captive joining the crew |
  | `Trade` / `Cargo` / `Locales` | trade deals and charters; cargo and opening a crate; playing and trading at a locale |
  | `Encampments` / `Water` | an encampment and rebuilding it; carrying, spending, lacking and finding water |
  | `Weather` / `Fire` / `Territories` / `Boats` / `Random events` | the battle rules already grouped this way |

  Group only a run the book itself keeps together and a player would read in one go, and **only where the rules are
  adjacent** in the file: the umbrella's row sits where its first rule sits, so a group reorders the list if it is
  not already one run. A rule that stands on its own stays loose (Blood pacts, Greater Artefacts, Mounts), and
  nothing is grouped merely to shorten the list.
- A chart's `dice` is one of `D3`, `D6`, `2D6`, `3D6`, `D66`, `D100`, or blank for a table with no dice of its own;
  anything else is refused. `result` is what was rolled as the book writes it (`"2"`, `"3-4"`, `"11-15"`).
- A rule may keep a **small** table inside its `text` (two or three lines). A longer table, or one a player would
  look up on its own, is a chart.
- **A chart that answers with a word needs a rule that tells you to roll it** (William, 20 Nov 2026, on weather:
  "the main important part sits in charts then the rules that come from that chart sit in battle rules; the first
  part is more of a battle rules really"). Where each result's rules are separate rules, as Border Town Burning's
  and Marienburg's weather are, the umbrella opens with a rule carrying the roll itself and pointing at the chart,
  and the chart stays the lookup. Where the chart's own rows carry what each result does, as Khemri's and Sartosa's
  weather do, there is nothing to cross-reference and no such rule is written: it would only repeat the chart's
  description.
- `location_groups` are the places a warband visits between games (the Marketplace, Da Camp, Athel Loren's shops),
  for a preset with `enable_locations`. A group is `{name, description, restrictions, locations}`, `restrictions`
  being who may go, as text nothing checks. A location is `{name, rules, min_heroes, max_heroes, trading_action,
  tables, charts}`: how many Heroes go (a whole number or `"all"`), whether going spends each one's trading action,
  its own `tables` (a chart's shape, shown only inside it) and the titles of the campaign `charts` it links to.
  A table several places roll lives once, on its main place, and the others name it with that place in brackets:
  "roll on the Herbs and Potions table (Herbalist)". Group names are unique in a file and location names in the
  preset; across a preset's rules files a group of the same name merges, the later file's locations appended and
  the earlier file's description and restrictions kept.
