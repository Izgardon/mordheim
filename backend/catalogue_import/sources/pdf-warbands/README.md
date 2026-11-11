# Warbands read from their PDFs

One file per warband, written by hand from its Broheim PDF (William, 5 Nov 2026: "lets begin adding warbands in via
their pdfs"), in the snapshot's page shape (`../testwarbands-2026-10-31/warbands/*.json`) plus the keys
`catalogue_import/pdf_warbands.py` describes: `warbandType`, `variants`, `aliases`, `stubs`, `itemRules`, `priceRows`,
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
| `call-of-the-night-haint.json` | call-of-the-night-haint (2b, Mutiny in Marienburg) | https://www.broheim.net/downloads/warbands/supplement/mutinyinmarienburg/Call%20Of%20The%20Night%20Haint.pdf | 1-6 (text layer) | 6 Nov 2026 |
| `channel-rats.json` | channel-rats (2b, Mutiny in Marienburg) | https://www.broheim.net/downloads/warbands/supplement/mutinyinmarienburg/Channel%20Rats.pdf | 1-8 (text layer; page 4 as an image) | 6 Nov 2026 |
| `guild-of-disgraced-engineers.json` | guild-of-disgraced-engineers (2b, Mutiny in Marienburg) | https://www.broheim.net/downloads/warbands/supplement/mutinyinmarienburg/Guild%20Of%20Disgraced%20Engineers.pdf | 1-6 (text layer) | 6 Nov 2026 |
| `knights-of-the-bitter-moors.json` | knights-of-the-bitter-moors (2b, Mutiny in Marienburg) | https://www.broheim.net/downloads/warbands/supplement/mutinyinmarienburg/Knights%20Of%20The%20Bitter%20Moors.pdf | 1-6 (text layer; the skill table from a page crop) | 6 Nov 2026 |
| `lords-of-the-marsh.json` | lords-of-the-marsh (2b, Mutiny in Marienburg) | https://www.broheim.net/downloads/warbands/supplement/mutinyinmarienburg/Lords%20Of%20The%20Marsh.pdf | 1-4 (text layer) | 6 Nov 2026 |
| `shallows-beasts.json` | shallows-beasts (2b, Mutiny in Marienburg) | https://www.broheim.net/downloads/warbands/supplement/mutinyinmarienburg/Shallows%20Beasts.pdf | 1-5 (text layer) | 6 Nov 2026 |
| `underworld-alliance.json` | underworld-alliance (2b, Mutiny in Marienburg) | https://www.broheim.net/downloads/warbands/supplement/mutinyinmarienburg/Underworld%20Alliance.pdf | 1-5 (text layer) | 6 Nov 2026 |
| `watchmen.json` | watchmen (2b, Mutiny in Marienburg) | https://www.broheim.net/downloads/warbands/supplement/mutinyinmarienburg/Watchmen.pdf | 1-5 (text layer) | 6 Nov 2026 |
| `sartosan-pirates.json` | sartosan-pirates (2b, Sartosa) | https://www.broheim.net/downloads/warbands/supplement/sartosa/Human%20Pirates.pdf | 1-5 (text layer; page 3 as an image) | 11 Nov 2026 |
| `estalian-corsairs.json` | estalian-corsairs (2b, Sartosa) | https://www.broheim.net/downloads/warbands/supplement/sartosa/Human%20Pirates.pdf | 1-5 (text layer; page 3 as an image) | 11 Nov 2026 |
| `wasteland-privateers.json` | wasteland-privateers (2b, Sartosa) | https://www.broheim.net/downloads/warbands/supplement/sartosa/Human%20Pirates.pdf | 1-5 (text layer; page 3 as an image) | 11 Nov 2026 |
| `bretonnian-buccaneers.json` | bretonnian-buccaneers (2b, Sartosa) | https://www.broheim.net/downloads/warbands/supplement/sartosa/Human%20Pirates.pdf | 1-5 (text layer; page 3 as an image) | 11 Nov 2026 |
| `araby-smugglers.json` | araby-smugglers (2b, Sartosa) | https://www.broheim.net/downloads/warbands/supplement/sartosa/Araby%20Smugglers.pdf | 1-4 (text layer; page 2 as an image) | 11 Nov 2026 |
| `khorne-raiders.json` | khorne-raiders (2b, Sartosa) | https://www.broheim.net/downloads/warbands/supplement/sartosa/Khorne%20Raiders.pdf | 1-3 (text layer) | 11 Nov 2026 |
| `slayer-pirates.json` | slayer-pirates (2b, Sartosa) | https://www.broheim.net/downloads/warbands/supplement/sartosa/Slayer%20Pirates.pdf | 1-4 (text layer) | 11 Nov 2026 |
| `ghost-pirates.json` | ghost-pirates (2b, Sartosa) | https://www.broheim.net/downloads/warbands/supplement/sartosa/Ghost%20Pirates.pdf | 1-5 (text layer; page 2 as an image) | 11 Nov 2026 |
| `lothern-sea-patrol.json` | lothern-sea-patrol (2b, Sartosa) | https://www.broheim.net/downloads/warbands/supplement/sartosa/Lothern%20Sea%20Patrol.pdf | 1-5 (text layer; page 2 as an image) | 11 Nov 2026 |
| `orc-pirates.json` | orc-pirates (2b, Sartosa) | https://www.broheim.net/downloads/warbands/supplement/sartosa/Orc%20Pirates%20&%20Savage%20Orcs.pdf | 1-4 (text layer; built on our Orc Mob template, which the PDF varies) | 11 Nov 2026 |
| `savage-orcs-sar.json` | savage-orcs-sar (2b, Sartosa) | https://www.broheim.net/downloads/warbands/supplement/sartosa/Orc%20Pirates%20&%20Savage%20Orcs.pdf | 5-7 (text layer; built on our Orc Mob template, which the PDF varies) | 11 Nov 2026 |
| `pirates-of-the-cathayan-sea.json` | pirates-of-the-cathayan-sea (2b, Sartosa) | https://www.broheim.net/downloads/warbands/supplement/sartosa/Pirates%20of%20the%20Cathayan%20Sea.pdf | 1-5 (text layer; page 2 as an image) | 11 Nov 2026 |
| `blood-dragons.json` | blood-dragons (2b, Mousillon) | https://www.broheim.net/downloads/warbands/supplement/mousillon/Blood%20Dragons.pdf | 1-7 (text layer) | 11 Nov 2026 |
| `bretonnian-brigands.json` | bretonnian-brigands (2b, Mousillon) | https://www.broheim.net/downloads/warbands/supplement/mousillon/Bretonnian%20Brigands.pdf | 1-6 (text layer) | 11 Nov 2026 |
| `bretonnian-knights-errant.json` | bretonnian-knights-errant (2b, Mousillon) | https://www.broheim.net/downloads/warbands/supplement/mousillon/Bretonnian%20Knights%20Errant.pdf | 1-5 (text layer) | 11 Nov 2026 |
| `dark-elf-corsairs.json` | dark-elf-corsairs (2b, Mousillon) | https://www.broheim.net/downloads/warbands/supplement/mousillon/Dark%20Elf%20Corsairs.pdf | 1-6 (text layer) | 11 Nov 2026 |
| `the-lost.json` | the-lost (2b, Mousillon) | https://www.broheim.net/downloads/warbands/supplement/mousillon/The%20Lost.pdf | 1-5 (text layer) | 11 Nov 2026 |
| `woodsmen-de-artois.json` | woodsmen-de-artois (2b, Mousillon) | https://www.broheim.net/downloads/warbands/supplement/mousillon/Woodsmen%20de%20Artois.pdf | 1-6 (text layer) | 11 Nov 2026 |
| `disciples-of-maldred.json` | disciples-of-maldred (2b, Mousillon) | https://www.broheim.net/downloads/warbands/supplement/mousillon/Disciples%20of%20Maldred.pdf | 1-9 (text layer) | 11 Nov 2026 |
| `necrarchs.json` | necrarchs (2b, Mousillon) | https://www.broheim.net/downloads/warbands/supplement/mousillon/Necrarchs.pdf | 1-8 (text layer) | 11 Nov 2026 |
| `skaven-of-clan-pestilens-mou.json` | skaven-of-clan-pestilens-mou (2b, Mousillon) | https://www.broheim.net/downloads/warbands/supplement/mousillon/Skaven%20of%20Clan%20Pestilens.pdf | 1-7 (text layer; p7 holds one rule only) | 11 Nov 2026 |
| `wood-elves-of-arden.json` | wood-elves-of-arden (2b, Mousillon) | https://www.broheim.net/downloads/warbands/supplement/mousillon/Wood%20Elves%20of%20Arden.pdf | 1-7 (text layer; page 2 as an image) | 11 Nov 2026 |
| `the-brood-of-ghurash.json` | the-brood-of-ghurash (2b, Sealed City) | https://www.broheim.net/downloads/warbands/supplement/sealedcity/Brood%20Of%20Ghurash.pdf | 1-4 (text layer; page 2 as an image) | 11 Nov 2026 |
| `clockworkers.json` | clockworkers (2b, Sealed City) | https://www.broheim.net/downloads/warbands/supplement/sealedcity/Clockworkers.pdf | 1-7 (text layer; pages 2 and 4 as images, page 7 a scan of a picture) | 11 Nov 2026 |
| `house-guard.json` | house-guard (2b, Sealed City) | https://www.broheim.net/downloads/warbands/supplement/sealedcity/House%20Guard.pdf | 1-5 (text layer; page 5 as an image) | 11 Nov 2026 |
| `silent-brotherhood.json` | silent-brotherhood (2b, Sealed City) | https://www.broheim.net/downloads/warbands/supplement/sealedcity/Silent%20Brotherhood.pdf | 1-6 (text layer; page 3 as an image) | 11 Nov 2026 |
| `skaven-of-clan-pristekk.json` | skaven-of-clan-pristekk (2b, Sealed City) | https://www.broheim.net/downloads/warbands/supplement/sealedcity/Clan%20Pristekk.pdf | 1-5 (text layer; page 1 as an image) | 11 Nov 2026 |
| `arabyan-nomads.json` | arabyan-nomads (3, Khemri) | https://www.broheim.net/downloads/warbands/supplement/khemri/Arabyan%20Nomads.pdf | 1-3 (text layer) | 11 Nov 2026 |
| `arabyan-theives.json` | arabyan-theives (3, Khemri) | https://www.broheim.net/downloads/warbands/supplement/khemri/Arabyan%20Theives.pdf | 1-4 (text layer) | 11 Nov 2026 |
| `cursed-dwarves.json` | cursed-dwarves (3, Khemri) | https://www.broheim.net/downloads/warbands/supplement/khemri/Cursed%20Dwarves.pdf | 1-5 (text layer) | 11 Nov 2026 |
| `hobgoblins.json` | hobgoblins (3, Khemri) | https://www.broheim.net/downloads/warbands/supplement/khemri/Hobgoblins.pdf | 1-5 (text layer; its skill table read from the page's own text columns) | 11 Nov 2026 |
| `lahmian.json` | lahmian (3, Khemri) | https://www.broheim.net/downloads/warbands/supplement/khemri/Lahmian.pdf | 1-6 (text layer) | 11 Nov 2026 |
| `mages.json` | mages (3, Khemri) | https://www.broheim.net/downloads/warbands/supplement/khemri/Mage.pdf | 1-4 (text layer) | 11 Nov 2026 |
| `necromancer.json` | necromancer (3, Khemri) | https://www.broheim.net/downloads/warbands/supplement/khemri/Necromancer.pdf | 1-4 (text layer) | 11 Nov 2026 |

The Sartosa warbands' Pirate skill column is the Pirate Skills list of the setting's campaign rules, not of any warband's PDF: it is read from
https://www.broheim.net/downloads/campaigns/sartosa/Sartosa%20Skills%2C%20Hired%20Swords%20%26%20Dramatis%20Personae.pdf (p1-2, text layer; 11 Nov 2026)
as the shared group `sharedSkillGroup` in `sartosan-pirates.json`. Its Hired Swords and Dramatis Personae are not imported.
The same setting's https://www.broheim.net/downloads/campaigns/sartosa/Sartosa%20Equipment.pdf (10 pages, text layer; 11 Nov 2026) gives the Sartosa
stubs their rules and settles their prices. The setting's other eight campaign PDFs are not read (William, 11 Nov 2026).

The Sealed City's own campaign PDFs (Ambitions, Lost And Found, Madness Rules, Stygian Mutations) are not read (William, 11 Nov 2026): what its
warbands point at - the Stygian Mutations, the moonstones and orichalcum they spend, and the Clockwork pistol's and rifle's rules - is stubbed or
flagged and filled when that batch comes.

The Khemri warbands' type rows carry Broheim's grade 3, while the grade that counts is their setting's: Khemri is graded 1b, because the
setting also holds the 1b Arabian Tomb Raiders and Tomb Guardians (flagged for William, 11 Nov 2026; nothing of ours was changed).
The Nehekhara Tomb Guards' PDF (https://www.broheim.net/downloads/warbands/supplement/khemri/Nehekhara%20Tomb%20Guards.pdf, 1-9, text layer; read 11 Nov 2026)
is the warband mordheimer's snapshot already holds as `testwarbands-2026-10-31/warbands/tomb-guardians-old.json`, so no source file was written for it:
its numbers match ours and its differences are flagged in the vet file instead.
Khemri's own campaign PDFs (Equipment, Elemental Magic, Dramatis Personae and a Town Cryer compilation) are not read (William, 11 Nov 2026): the Ankus,
Cutlass and Great Scimitar are stubs with no rules, and the Mage and Street Mage cast from our four Elemental Lores until it is.

## Adding a warband

1. Read the PDF's text (`pdftotext`, in reading order); a profile or table the reading order runs together is
   usually whole in the `-layout` text. Open a page image only for what neither text has (a table of ticks, a
   heading set as an image), and say which in its flags.
2. Write `<type-slug>.json` in this shape, its `warbandType` that slug. Name each line's item as we name it or as
   one of its tags (an alias for a spelling of the PDF's own), give each item we lack a stub with the page of its
   rules, carrying them and its profile rows (`statblock`) where the PDF prints them (one another page declares too
   is one item, with a price for each, made from the lower grade's), and flag every doubt with its page;
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
     page's `itemRules` (Experimental Technology; its `ours` our items whose own rule it becomes, the Mordheim Map's
     Map), and one of our items the warband buys from its own row is a `priceRows` entry (the Low Kings' Spiked
     Gauntlet, 15 gc, Rare 7, Enforcer only). A price row serves the page's own type, or every type its `types`
     names (its own among them), so a setting's shop list is declared once (Sartosa's, in `sartosan-pirates.json`,
     for the setting's eleven types). A price row and a stub both take a `diceMultiplier` beside their `dice`
     ("100 + D6x10": `dice` 1, `diceMultiplier` 10), which needs dice.
     One of our Mutiny in Marienburg items with no rules takes the PDF's in `apps/items/data/mim-items.json` (its
     `properties`, `needs_rules` false: the Armour of the Wildwood, the Stromfels Heart).

   A skill two pages share is one skill with the same
   words in both groups, so its limit moves to the group's note (the Slayer Cult's and the Channel Rats' Songster).
   A group several warband types learn from is declared once, as one page's `sharedSkillGroup` (its `types` the slugs
   it serves), and each hero who learns from it names it in his `skillGroups` (the Sartosa warbands' Pirate column,
   which a Khorne Raiders Quartermaster doesn't tick though he ticks Special).

   Who of the warband may take a skill opens a new skill's description ("Gnoblars only."); a skill of ours is shared
   with other warbands, so the group's `note` says it instead (at most 200 characters, shown when learning from the
   group). Neither is a warband rule. A warband with no Special column has no `skillGroup` or `specialSkillsList`.
   A warband whose book splits it into several (the House Guard's three houses) declares them as `variants`
   (`{key, name}`, with `startingGc`, `maxModels`, `rareBonus` and `rareBonusExcept` where one has its own): the
   player picks one when the warband is raised. A warband rule and an equipment list line name the one they belong
   to (`variant`), and a fighter's `variantChanges` holds what a variant changes about him (`skillAccess`, `skills`
   he starts with, `stats`, `maxCount`), his own keys being the first variant's. A rule that only names a skill a
   fighter starts with is that skill, not a rule (the Fierezza Commander's Web of Steel).

3. A race of the warband's own goes in `apps/races/data/races.json` and `template_answers.RACES_BY_PAGE` (one
   fighter's, `RACES_BY_FIGHTER`); a rule that is a shared special but does something else is kept apart in
   `apps/special/data/shared-specials.json`; a pre-battle roll goes in `apps/special/data/prebattle-rolls.json`; a
   spell lore we lack goes in `apps/spells/data/spells.json`, named "<lore> (<warband>)" when ours of its name has
   other spells or numbers.
4. Rebuild (`python -I catalogue_import/build.py`), run `check_pdf.py`, and read the import report's PDF warbands
   section.

## William's rulings (5-6 Nov 2026)

Each answers a question a batch raised; follow them without asking again.

- **Gold rounds up:** half of 35 gc is 18 ("always round up in mordheim for gold").
- **Profiles stand as printed,** a W2 or I2 included ("some units have 2 wounds"). Flag only what the PDF contradicts or
  leaves unreadable.
- **Counts the PDF prints two ways:** take the simpler reading, and flag it ("just keep 0-1 dont complicate it").
- **"Counts as" lines and "X/Y" pairs** are our item shown under the PDF's name, at the line's price. A cheaper price
  is only that line's: the Halfling Cook's Cooking Pot is our Helmet ("just a personal label").
- **An item named like ours that adds a little** is ours, with a `priceRows` row for the warband; flag what ours
  doesn't cover ("would prefer them being just one item").
- **Prices printed twice** (on the list and in the item's entry): the entry's, flagged (the Horn of the Wild Hunt,
  "use 120").
- **List prices are starting prices.** The app opens them only until the warband's first battle
  (`list_prices_open`), so a PDF's "starting only" price needs no note or rule. A rule saying list prices hold
  later (the Bitter Moors' Peasant Labour) stays a rule.
- **A rule several items carry** is one shared item rule (`itemRules`), never a warband rule (Experimental
  Technology, the maps' Map).
- **Item rules:** a stub carries its printed rules, broken into rules. An item of ours with no rules takes the
  PDF's. Never bring flavour in.
- **Animals bought through an item** go in the bestiary as `pet`s (the Sorcerous Society's Familiar).
- **Every "1st free" line** gives one of its item free at hire, not only the dagger.
- **A shared skill William renames** is renamed at its source (Sign of Sigmar became Righteous Aura).
- **A warband's minimum of 3 models** is not imported.
- **A skill list goes to the warbands whose own entry grants it.** A cross-warband grant that holds only while the
  campaign is set somewhere is not imported (William, 11 Nov 2026, of the ~60 warbands the Sartosa skills PDF lets
  learn Pirate skills: "ignore the rule that everyone can use those skills, just give them to the warbands that
  explicitly say they can").
- **A skill of one setting carries that setting even inside a general group,** so the pickers offer it only where
  the setting is ticked (the Sartosa Axe Thrower, in the Shooting group). A skill with no setting counts as
  Mordheim's and shows everywhere, so never leave one blank.
- **A setting's campaign PDFs are read when its own batch comes,** not up front (William, 11 Nov 2026: "we will
  scrape the rest of the campaign setting pdfs further down the line as I think warband pdfs actually give item
  details which is what we want"). A warband PDF's item details stand, and a stub it leaves bare is filled when
  that PDF is read.
- **A setting's shop list re-prices our items for that setting only:** price rows on the warband types of that
  setting (`priceRows`, one row naming them all in `types`, declared on one page), with our global prices and
  rarities untouched (William, 11 Nov 2026; Sartosa's Equipment shop list).
- **One entry for a weapon we already hold under another name** (William, 11 Nov 2026: "there should only be one
  entry for throwing axes and its this one Throwing Knives/Stars/Axes 15 gc Rare 5 it includes all of them ... this
  item is available to all just gated by its setting"). The PDF warbands' Throwing Axes stub was our Throwing
  Knives/Stars at the same price and rarity, so the two are one item, renamed through `item_names` in
  `overrides.json` and kept in the earlier of the two settings (Mordheim 1a); every line names it and shows it
  under its own list's wording. A stub that is ours under another name is a question for William, not a new item.
  Four more stubs were judged the same way on 11 Nov 2026: the Fen Guard's **Whip** is our Steel Whip (10 gc both),
  the Druchii's **Darksteel blade** our Dark Elf Blade (Rare 9, and the same Critical Damage and Wicked Edge) and
  the Snotlings' **Slingshot** our Sling (2 gc, 18", S3, fire twice at half range), each merged, its line shown
  under its own name and its own price kept in a price row where it differs from ours. The Nipponese **Kanabo**
  stays its own item: it is 15 gc like our Double-handed weapon, but its lists sell both, and it is As user +1 with
  Two-Handed and Concussion where ours is +2 and strikes last. A matching price is not a match.
- **A setting's shop sells an item no warband list does:** its stub names the types its row serves (`types`, as a
  price row's), so the shop list declares it once for the whole setting and no list line need name it (William,
  11 Nov 2026, of the eighteen Sartosa shop items we lacked: "add them in as stubs if you dont have the rules for
  them yet, we will populate later but good to know they exist"; the rules the Equipment PDF prints went in with
  them). The Sartosa Greatcoat is "Based on 'Raincoat' from Border Town Burning" at our own 10 gc, so it is our
  Rain Coat under another name: a tag on ours through `item_names`, never a new item.
- **Never fetch a setting's own PDFs to fill a gap** (William, 11 Nov 2026). Read the warband PDFs, stub whatever is
  missing, a fighter left with no skill list included, and fill it when that setting's batch comes. The Sartosa
  skills and equipment PDFs already read stay as they are.
- **A warband whose book gives it no fixed leader stays leaderless** (William, 11 Nov 2026), with a warband rule
  saying how the leader is worked out each game (the Knights-Errant's highest D6+7, The Lost's highest Leadership).
  The template check's "no leader" warning is expected.
- **One PDF is two warbands where it prints two lists** (William, 11 Nov 2026: "i prefer separate warbands as
  different settings and all"). The Orc Pirates & Savage Orcs PDF is two warbands, each "the exact same rules as the
  Da Mob Warband with the following changes": each is its own source file, warband type and template, with only its
  own half's rules, lists, fighters and skills. A Broheim type the split replaces is left out through
  `drop_warband_types` in `overrides.json` and the two new ones are `extra_warband_types` entries, so the seeder
  archives the old type and warbands raised as it keep it. A name two settings already share keeps the house
  convention of its source code in the slug (`savage-orcs-sar`, beside `savage-orcs-kaz` and `savage-orcs-ath`).
- **A fighter's buyable extra rules are template upgrades** (`mutations`: the Blood Dragon Vampire's bloodline
  abilities), **and a fighter who brings another model is a hired sword** (the Dark Elf Corsairs' Specialists);
  neither stays a warband rule (William, 11 Nov 2026).
