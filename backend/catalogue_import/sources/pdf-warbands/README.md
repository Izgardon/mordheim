# Warbands read from their PDFs

One file per warband, written by hand from its Broheim PDF (William, 5 Nov 2026: "lets begin adding warbands in via
their pdfs"), in the snapshot's page shape (`../testwarbands-2026-10-31/warbands/*.json`) plus the keys
`catalogue_import/pdf_warbands.py` describes: `warbandType`, `aliases`, `stubs`, `skillGroup` and
`specialSkillsList`, a fighter's `spellLores`, and `flags`. Rule text is in our own words with every number, roll,
range, test and condition kept, and no flavour; the PDFs and their extracted text are never committed.

The template import builds each file as a book template of its type (`pipeline.py` loads them beside the snapshot);
`python -I catalogue_import/check_pdf.py` checks them against the catalogue, and `tests/test_pdf_warbands.py` runs that
check over every file.

| File | Warband type | PDF | Pages | Read |
| --- | --- | --- | --- | --- |
| `halflings.json` | halflings (2a, Mordheim 2a) | https://www.broheim.net/downloads/warbands/experimental/Halflings.pdf | 1-4 (text layer) | 5 Nov 2026 |

## Adding a warband

1. Read the PDF's text (`pdftotext`, in reading order); open a page image only for a table or profile the text
   garbles, and say which in its flags.
2. Write `<type-slug>.json` in this shape, its `warbandType` that slug. Name each line's item as we name it or as
   one of its tags (an alias for a spelling of the PDF's own), give each item we lack a stub with the page of its
   rules, and flag every doubt with its page; leave a number you can't read empty and flag it.
3. A race of the warband's own goes in `apps/races/data/races.json` and `template_answers.RACES_BY_PAGE`; a rule that
   is a shared special but does something else is kept apart in `apps/special/data/shared-specials.json`; a pre-battle
   roll goes in `apps/special/data/prebattle-rolls.json`.
4. Rebuild (`python -I catalogue_import/build.py`), run `check_pdf.py`, and read the import report's PDF warbands
   section.
