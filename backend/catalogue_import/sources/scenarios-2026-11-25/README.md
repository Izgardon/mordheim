# The settings' scenarios, 25 November 2026

Data only, for the scenarios of every setting beyond Mordheim 1a (William, 24-25 Nov 2026). `scenario_build.py`
reads it with the first snapshot (`../scenarios-2026-11-24/`, Mordheim's 70 pages) and writes `out/scenarios.json`,
which `seed_scenarios` seeds.

| File | What it is |
| --- | --- |
| `pages/<folder>/<slug>.html` | 62 more of mordheimer's scenario pages, cut as the first snapshot's are (each page's `theme-doc-markdown` article, its `<img>` and `<svg>` elements and NUL characters removed; no downloaded code was run): the 34 the site holds under `/docs/campaigns/scenarios/` but leaves off its index (town-cryer 20, fanatic-magazine 10, archive-pestilen 4: the Empire in Flames, Lustria, Albion and Khemri scenarios among them) and the 28 under a setting's own pages, `/docs/campaigns/campaign-settings/<setting>/scenarios/<slug>` (border-town-burning 16, nemesis-crown 9, empire-in-flames 3, each folder named for our setting) |
| `tables/<setting>.html` | the articles of mordheimer's scenario pages for Albion, Border Town Burning, Empire in Flames, Lustria and the Nemesis Crown, as evidence for `settings.json`'s tables |
| `manifest.json` | each page's folder, slug, URL and tags (a setting's own pages carry none) |
| `pdf/<setting>.json` | the scenarios of the campaign documents mordheimer doesn't hold, in the scenario shape: `{document, scenarios}` (see below) |
| `settings.json` | `{settings, none}`: each setting's scenario tables as its book prints them, and the settings that add none of their own, with why |

All of mordheimer's pages were fetched from https://mordheimer.net on 25 Nov 2026 (its sitemap lists them). Its
Procession of Morr pages are left out: we hold no such setting.

## The PDFs' scenarios (`pdf/`)

Read from the campaign PDFs (the git-ignored `.pdf-sources/`; `tools/pdf-scenarios/blocks.py` drafts a page range as
markup in reading order, `to_json.py` turns the corrected markup into the file) and corrected against the pages:
headings named as the book names them (the import names them the standard way, `heading`), profiles and charts as
tables (`{columns, rows}` placed by `{{table:N}}`), the book's words kept but for joined lines, hyphens and plain
typos. The PDFs themselves and their text are never committed.

| File | Document | Scenarios |
| --- | --- | --- |
| `karak-azgal.json` | Karak Azgal, pages 72-75 | The Engineers Workshop, Dragonslayer |
| `relics-of-the-crusades.json` | Relics of the Crusades Part 1, pages 4-8 and 15 | Dungeon Raid; The Thing in the Ruins and The Thing in the Dark (variations) |
| `mousillon.json` | Mousillon campaign rules, Redux, pages 23-39 | its 14; Hell Hath No Fury (a variation of Skirmish) |
| `mutiny-in-marienburg.json` | Mutiny in Marienburg, pages 50-84 | its 20 less Last Orders! and The Heist, which are Border Town Burning's pages reprinted (their text layer is unreadable; their opening lines match) |
| `marienburg-annual.json` | the Marienburg Annual, page 57 | Nice Day for a Waaagh Beheadin' |
| `sartosa.json` | Sartosa's scenarios, pages 2-21 | its 10 (Last Orders! its own version); 16 variations of scenarios we hold |

An entry is a scenario (`slug`, `name`, `number`, `source`, `players`, `summary`, `intro`, `sections`), or a book's
variation of one we hold (`slug`, `name`, `base` the slug it varies, `source`, `summary`, `title` and `text` the
changes): the import reads a variation as its scenario with the changes as a first section. A book that only renames
one of ours ("Treasure Hunt (as Wyrdstone Hunt)") is no variation: its table links ours. A scenario's `players` is
what its book says (Border Town Burning's and Mutiny in Marienburg's tables mark an optional multiplayer scenario `*`,
either, and a multiplayer one `**`); a `summary` is ours, one line.

## The tables (`settings.json`)

Each setting: `setting` (our setting's name), `from` (its book and what was read), `tables` (each `{table, dice,
rows}`, a row `{rolls, slug}` or `{rolls, name}` for a scenario we don't hold, `share` where the result rolls again
between two), `each` (a setting with no table: each 1), `listed` (`{slug, why}`, the setting's own scenarios no table
rolls: at 0, pickable and never drawn) and `missing` (named, held nowhere). `scenario_settings.py` has the weights:
a result's chance in 36ths whatever its dice, a scenario on two tables adding both.

A setting's scenario that is one we hold, by name and content, links ours (Empire in Flames' and Lustria's tables name
the rulebook's and Chaos on the Streets'; Mutiny in Marienburg's Last Orders! is Border Town Burning's). Two of one
name from two sources stay two, the later named for its source (Last Orders! (Border Town Burning), the Nemesis Crown's
coming first), and a page's slug another holds takes its folder (`last-orders-border-town-burning`).
