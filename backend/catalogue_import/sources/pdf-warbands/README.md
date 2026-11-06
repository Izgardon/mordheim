# Warbands read from their PDFs

One file per warband, written by hand from its Broheim PDF (William, 5 Nov 2026: "lets begin adding warbands in via
their pdfs"), in the snapshot's page shape (`../testwarbands-2026-10-31/warbands/*.json`) plus the keys
`catalogue_import/pdf_warbands.py` describes: `warbandType`, `aliases`, `stubs`, `itemRules`, `priceRows`,
`skillGroup` and `specialSkillsList`, a fighter's `spellLores`, and `flags`. Rule text is in our own words with every number, roll,
range, test and condition kept, and no flavour; the PDFs and their extracted text are never committed.

The template import builds each file as a book template of its type (`pipeline.py` loads them beside the snapshot);
`python -I catalogue_import/check_pdf.py` checks them against the catalogue, and `tests/test_pdf_warbands.py` runs that
check over every file.

| File | Warband type | PDF | Pages | Read |
| --- | --- | --- | --- | --- |
| `halflings.json` | halflings (2a, Mordheim 2a) | https://www.broheim.net/downloads/warbands/experimental/Halflings.pdf | 1-4 (text layer) | 5 Nov 2026 |
| `grave-robbers.json` | grave-robbers (2a, Sylvania) | https://www.broheim.net/downloads/warbands/supplement/sylvania/Grave%20Robbers.pdf | 1-4 (text layer) | 5 Nov 2026 |
| `skaven-of-clan-moulder.json` | skaven-of-clan-moulder (2a, Mordheim 2a) | https://www.broheim.net/downloads/warbands/web/Clan%20Moulder.pdf | 1-7 (a scan, OCR) | 5 Nov 2026 |
| `bretonnian-grail-companions.json` | bretonnian-grail-companions (2a, Mordheim 2a) | https://www.broheim.net/downloads/warbands/web/Bretonnian%20Grail%20CompanionsV0.7.pdf | 1-9 (text layer) | 6 Nov 2026 |
| `druchii.json` | druchii (2a, Mordheim 2a) | https://www.broheim.net/downloads/warbands/experimental/Druchii.pdf | 1-9 (text layer; pages 2, 3 and 8 as images) | 6 Nov 2026 |
| `dwarf-slayer-cult.json` | dwarf-slayer-cult (2a, Mordheim 2a) | https://www.broheim.net/downloads/warbands/web/Dwarf%20Slayer%20Cult%20v6.pdf | 1-7 (text layer; page 2 as an image) | 6 Nov 2026 |
| `survivors-of-strigos.json` | survivors-of-strigos (2a, Sylvania) | https://www.broheim.net/downloads/warbands/supplement/sylvania/Survivors%20Of%20Strigos.pdf | 1-6 (text layer; its skill table and Dark Arts are images) | 6 Nov 2026 |
| `masters-of-horror.json` | masters-of-horror (2a, Sylvania) | https://www.broheim.net/downloads/warbands/supplement/sylvania/Masters%20Of%20Horror.pdf | 1-4 (text layer; its skill table is an image) | 6 Nov 2026 |
| `ogre-hunting-party.json` | ogre-hunting-party (2a, Mordheim 2a) | https://www.broheim.net/downloads/warbands/web/Ogre%20Hunting%20Party.pdf | 1-7 (text layer; page 2 as an image) | 6 Nov 2026 |
| `wood-elves-of-athel-loren.json` | wood-elves-of-athel-loren (2a, Mordheim 2a) | https://www.broheim.net/downloads/warbands/web/Wood%20Elves%20of%20Athel%20Loren.pdf | 1-5 (text layer) | 6 Nov 2026 |
| `nipponese-expedition.json` | nipponese-expedition (2a, Mordheim 2a) | https://www.broheim.net/downloads/warbands/web/Nipponese%20Expedition%20v2.2.pdf | 1-8 (text layer; page 2, a scan, as an image) | 6 Nov 2026 |
| `snotlings.json` | snotlings (2a, Mordheim 2a) | https://www.broheim.net/downloads/warbands/web/Snotlings.pdf | 1-11 (text layer; page 2 as an image) | 6 Nov 2026 |
| `outlaws-of-stirwood-forest-redux.json` | outlaws-of-stirwood-forest-redux (2a, Mordheim 2a) | https://www.broheim.net/downloads/warbands/web/Outlaws%20of%20Stirwood%20Forest%2C%20Redux.pdf | 1-6 (pages 2-4 as images) | 6 Nov 2026 |
| `necrarchs-the-soul-stealers.json` | necrarchs-the-soul-stealers (2a, Sylvania) | https://www.broheim.net/downloads/lod/LOD1.pdf#page=5 | 5-10 of Letters of the Damned #1 (text layer; the skill table from a page crop) | 6 Nov 2026 |
| `protectorate-of-sigmar.json` | protectorate-of-sigmar (2a, Mordheim 2a) | https://www.broheim.net/downloads/lod/LOD3.pdf#page=8 | 8-12 of Letters of the Damned #3 (text layer) | 6 Nov 2026 |
| `sorcerous-society.json` | sorcerous-society (2a, Mordheim 2a) | https://www.broheim.net/downloads/lod/LOD4.pdf#page=6 | 6-13 of Letters of the Damned #4 (text layer) | 6 Nov 2026 |
| `vampire-hunters-of-sylvania.json` | vampire-hunters-of-sylvania (2a, Sylvania) | https://www.broheim.net/downloads/lod/LOD5.pdf#page=9 | 9-13 of Letters of the Damned #5 (text layer) | 6 Nov 2026 |
| `dreamwalkers-cult-of-morr.json` | dreamwalkers-cult-of-morr (2a, Mordheim 2a) | https://www.broheim.net/downloads/warbands/web/Dreamwalkers,%20Cult%20Of%20Morr.pdf | 15-22 (text layer; 1-4 and 23-25 scans of art, 7-14 background) | 6 Nov 2026 |
| `militiant-mootlanders.json` | militiant-mootlanders (2b, Mutiny in Marienburg) | https://www.broheim.net/downloads/warbands/supplement/mutinyinmarienburg/Militiant%20Mootlanders.pdf | 1-5 (text layer; page 3 as an image) | 6 Nov 2026 |
| `sea-ghosts.json` | sea-ghosts (2b, Mutiny in Marienburg) | https://www.broheim.net/downloads/warbands/supplement/mutinyinmarienburg/Sea%20Ghosts.pdf | 1-6 (text layer; page 3 as an image) | 6 Nov 2026 |
| `metal-mongers.json` | metal-mongers (2b, Mutiny in Marienburg) | https://www.broheim.net/downloads/warbands/supplement/mutinyinmarienburg/Metal%20Mongers.pdf | 1-7 (text layer) | 6 Nov 2026 |
| `low-kings.json` | low-kings (2b, Mutiny in Marienburg) | https://www.broheim.net/downloads/warbands/supplement/mutinyinmarienburg/Low%20Kings.pdf | 1-5 (text layer; page 2 as an image) | 6 Nov 2026 |
| `fen-guard.json` | fen-guard (2b, Mutiny in Marienburg) | https://www.broheim.net/downloads/warbands/supplement/mutinyinmarienburg/Fen%20Guard.pdf | 1-7 (text layer; page 2 as an image) | 6 Nov 2026 |

## Adding a warband

1. Read the PDF's text (`pdftotext`, in reading order); a profile or table the reading order runs together is
   usually whole in the `-layout` text. Open a page image only for what neither text has (a table of ticks, a
   heading set as an image), and say which in its flags.
2. Write `<type-slug>.json` in this shape, its `warbandType` that slug. Name each line's item as we name it or as
   one of its tags (an alias for a spelling of the PDF's own), give each item we lack a stub with the page of its
   rules (one another page declares too is one item, with a price for each), and flag every doubt with its page;
   leave a number you can't read empty and flag it. Check each special skill and item against all of ours, whatever
   its name (William, 6 Nov 2026: "keep checking for matching skills and items, just ask me going forward"):
   - both the name and the effect ours: link ours;
   - the effect ours under another name: keep it apart (an item: the line links a stub of its own), and list it in
     the vet file's decisions as a possible match;
   - a line or special equipment entry that shows our item under the PDF's name (its `alias`, shown as: the Tanto
     as a Dagger, the Power Squig as our Familiar) may stay linked, but list it as a decision too; a stub's `note`
     becomes its item's notes (the Sorcerous Society's Familiar names its four pets in the bestiary).
   - an item whose rules William gives: a stub carries them (`rules`: a shared item rule by its name where ours does
     the same, the Ratling Gun's Move or fire; else its own name and text), a rule several items carry is one of the
     page's `itemRules` (Experimental Technology), and one of our items the warband buys from its own row is a
     `priceRows` entry (the Low Kings' Spiked Gauntlet, 15 gc, Rare 7, Enforcer only). A line's `note` is said with it.

   Who of the warband may take a skill opens a new skill's description ("Gnoblars only."); a skill of ours is shared
   with other warbands, so the group's `note` says it instead (at most 200 characters, shown when learning from the
   group). Neither is a warband rule. A warband with no Special column has no `skillGroup` or `specialSkillsList`.
3. A race of the warband's own goes in `apps/races/data/races.json` and `template_answers.RACES_BY_PAGE` (one
   fighter's, `RACES_BY_FIGHTER`); a rule that is a shared special but does something else is kept apart in
   `apps/special/data/shared-specials.json`; a pre-battle roll goes in `apps/special/data/prebattle-rolls.json`; a
   spell lore we lack goes in `apps/spells/data/spells.json`, named "<lore> (<warband>)" when ours of its name has
   other spells or numbers.
4. Rebuild (`python -I catalogue_import/build.py`), run `check_pdf.py`, and read the import report's PDF warbands
   section.
