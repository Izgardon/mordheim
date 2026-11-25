# mordheimer scenarios snapshot, 24 November 2026

Data only, for Mordheim's scenarios (William, 24 Nov 2026). `catalogue_import/scenarios.py` reads it and writes
`out/scenarios.json`, which `seed_scenarios` seeds.

Taken from https://mordheimer.net/docs/campaigns/scenarios: the index lists every scenario, each page is
`/docs/campaigns/scenarios/<source>/<slug>`. Each page's article (its `theme-doc-markdown` block, up to the footer)
was cut out of the downloaded HTML as text and saved byte for byte, but for its `<img>` elements (inline base64
pictures) and `<svg>` icons, which were removed, and two NUL characters in one heading's anchor (Ambush 2's); no
downloaded code was run. The footer's tags are in the manifest.

| File | What it is |
| --- | --- |
| `pages/<source>/<slug>.html` | 70 scenario articles: mordheim-rulebook 9, town-cryer 37 (Chaos on the Streets' seven among them, the `-tc5` slugs), fanatic-online 5, fanatic-magazine 1, archive-pestilen 17, other 1 (Mordheim's Burning). The slug is the page's, lower case (`The%20Great%20Library` is `the-great-library`) |
| `manifest.json` | each page's source folder, slug, URL and tags ("1v1", "Multiplayer", "Chaos on the Streets", ...) |
| `index.html` | the index's article down to its list of scenarios: the pre-battle sequence and the two 2D6 tables, the rulebook's (`scenario-table`) and Chaos on the Streets' (`cots-table`), each result linking its scenario's page |

How the build reads them:
- the title "3. Wyrdstone Hunt" is the name; the number is kept where the book numbers it (the rulebook's titles,
  and Chaos on the Streets' "Scenario N:" in its table), else blank;
- the opening paragraph of `Source:` / `Setting:` / `Author:` / `Notes:` lines gives the source and, from the notes,
  the one-line summary; everything before the first heading is the opening lines;
- `h2` and `h3` headings (and a stray `h1`) are sections in order, named the standard way (Terrain, Warbands, Set-up,
  Starting the game, Special rules, Ending the game, Experience, Wyrdstone) or in sentence case; `h4` and smaller stay
  lines in their section; a list item is a line starting "•"; a table is `{columns, rows}` placed by `{{table:N}}`;
- the site's own notes ("info", "possible error", "possible typo" boxes) are left out; its other boxes (a letter,
  the original experience) are the book's and read as text under their heading;
- tagged Multiplayer or Chaos on the Streets: multiplayer, else 1v1; tagged 1v1 as well, or written for both
  (The Lost Prince), either (William, 25 Nov 2026; the import report lists them);
- Archive Pestilen's copies of Town Cryer's Scourge & Purge, Forbidden Square and The Script of Sigmar are left
  out ("Remove duplicates"); the pages stay in the snapshot;
- each table's results weigh their 2D6 chance (2 or 12 is 1 ... 7 is 6; a span adds its numbers) for Mordheim 1a.
