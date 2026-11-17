# Plot sources

One file per setting, a list of that setting's plots, transcribed by hand from the setting's own book. A plot is
never shared between settings: Border Town Burning's plots and Mutiny in Marienburg's stand beside each
other, even where the same plot was reworked, so every plot carries the `setting` it was printed in and each file
holds only that setting's.

`backend/catalogue_import/sources/campaign-rules/<setting>.json` holds the same setting's campaign-structuring
rules, as `{"setting", "rules": [{"title", "text"}]}`.

## A plot's fields

| Field | What it holds |
| --- | --- |
| `slug` | stable, unique within the setting |
| `name` | as the book prints it |
| `setting` | the setting's name, as `sources/settings` spells it |
| `summary` | the book's own flavour paragraph, or `""`. Never write one: a summary we compose from the plot's own scoring and win is fluff, and reads as though the book said it |
| `variant_of` | the parent plot's slug when the book prints this plot as a variant of another, else `""`. A variant is a plot row of its own with its whole ladder written out, not an overlay that replaces some of the parent's rungs |
| `no_alliance_with` | slugs of plots this one may not ally with, `[]` for none. Mutiny in Marienburg has no alliances; Border Town Burning names them on five of its six plots |
| `who_text` | who may follow the plot, as prose the player reads and decides on. Deliberately unmatched: nothing resolves it to our warband types, nothing greys and nothing warns. Our own name where the book plainly means one of our warbands, the book's in brackets where the two differ ("Low Kings (Mobsmen)"), the book's name as printed where we hold nothing |
| `scoring` | the plot's scoring lines, in the book's order |
| `achievements` | one row per point total, in order: `{"points", "name", "text"}` |

`text` is the effect in our own words with every number kept, plain prose, no markdown. Where the book contradicts
itself, transcribe what is printed and say so in the text rather than smoothing it over.

## Points and dice

An achievement's `points` is the Campaign Point total that unlocks it, always an integer. Every plot of both
settings has the same seven rungs: **5, 10, 15, 20, 25, 35 and 40** — there is no 30, in any plot or on the printed
track — and the 40 is the campaign win.

A scoring line's points may be a die, so the two are separate fields, as a fee's gold and dice are:

- `{"points": 1, "text": "..."}` — a flat number, negative where the book takes points away (`-1`).
- `{"points": null, "dice": "D3", "text": "..."}` — a die. The sign is part of the string, so Border Town
  Burning's Prophecy Foiled is `"dice": "-D3"` and its Prophecy Fulfilled `"dice": "D6"`.

Where a line's heading and its text disagree on the number, the text wins (Drowning the Witch's "+1 Heathen out of
action" scores D3).
