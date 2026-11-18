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
| `rules` | A file in `sources/campaign-rules/` (without `.json`) holding `{"rules": [{"title", "text"}]}`. Leave it out for a campaign whose rules we have not written yet. |

A preset naming a setting, a chart or a rules file we do not hold is **skipped with a warning** and never seeded
half-built. A preset the folder drops is left where it is, because a campaign may have picked it.

Nothing a preset dictates is a block: the pages grey the controls it sets, keep them operable, and warn when the
owner departs from one.
