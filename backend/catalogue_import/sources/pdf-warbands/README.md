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
| `orc-pirates.json` | orc-pirates (2b, Sartosa) | https://www.broheim.net/downloads/warbands/supplement/sartosa/Orc%20Pirates%20&%20Savage%20Orcs.pdf | 1-4 (text layer; a variant of our Orc Mob template, which the PDF varies) | 11 Nov 2026 |
| `savage-orcs-sar.json` | savage-orcs-sar (2b, Sartosa) | https://www.broheim.net/downloads/warbands/supplement/sartosa/Orc%20Pirates%20&%20Savage%20Orcs.pdf | 5-7 (text layer; a variant of our Orc Mob template, which the PDF varies) | 11 Nov 2026 |
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
| `forest-goblins-lus.json` | forest-goblins-lus (2b, Lustria) | https://www.broheim.net/downloads/warbands/supplement/lustria/Forest%20Goblins.pdf | 1-6 (text layer; no images) | 11 Nov 2026 |
| `high-elves.json` | high-elves (2b, Lustria) | https://www.broheim.net/downloads/warbands/supplement/lustria/High%20Elves.pdf | 1-6 (text layer; no images) | 11 Nov 2026 |
| `lizardmen-lus.json` | lizardmen-lus (2b, Lustria) | https://www.broheim.net/downloads/warbands/supplement/lustria/Lizardmen.pdf | 1-6 (text layer; no images) | 11 Nov 2026 |
| `skaven-of-clan-pestilens-lus.json` | skaven-of-clan-pestilens-lus (2b, Lustria) | https://www.broheim.net/downloads/warbands/supplement/lustria/Clan%20Pestilens.pdf | 1-4 (text layer; no images) | 11 Nov 2026 |
| `adventurers.json` | adventurers (2b, Karak Azgal) | https://www.broheim.net/downloads/campaigns/karakazgal/Karak%20Azgal.pdf#page=19 | 19-24 of Karak Azgal (text layer) | 11 Nov 2026 |
| `dwarf-guildsmen.json` | dwarf-guildsmen (2b, Karak Azgal) | https://www.broheim.net/downloads/campaigns/karakazgal/Karak%20Azgal.pdf#page=25 | 25-28 of Karak Azgal (text layer) | 11 Nov 2026 |
| `dwarf-slayers.json` | dwarf-slayers (2b, Karak Azgal) | https://www.broheim.net/downloads/campaigns/karakazgal/Karak%20Azgal.pdf#page=32 | 32-35 of Karak Azgal (text layer) | 11 Nov 2026 |
| `skaven-of-clan-mors.json` | skaven-of-clan-mors (2b, Karak Azgal) | https://www.broheim.net/downloads/campaigns/karakazgal/Karak%20Azgal.pdf#page=36 | 36-39 of Karak Azgal (text layer) | 11 Nov 2026 |
| `skaven-of-clan-skryre-kaz.json` | skaven-of-clan-skryre-kaz (2b, Karak Azgal) | https://www.broheim.net/downloads/campaigns/karakazgal/Karak%20Azgal.pdf#page=40 | 40-43 of Karak Azgal (text layer) | 11 Nov 2026 |
| `night-goblins-kaz.json` | night-goblins-kaz (2b, Karak Azgal) | https://www.broheim.net/downloads/campaigns/karakazgal/Karak%20Azgal.pdf#page=44 | 44-48 of Karak Azgal (text layer) | 11 Nov 2026 |
| `strigoi.json` | strigoi (2b, Karak Azgal) | https://www.broheim.net/downloads/campaigns/karakazgal/Karak%20Azgal.pdf#page=50 | 50-55 of Karak Azgal (text layer) | 11 Nov 2026 |
| `savage-orcs-kaz.json` | savage-orcs-kaz (2b, Karak Azgal) | https://www.broheim.net/downloads/campaigns/karakazgal/Karak%20Azgal.pdf#page=56 | 56-61 of Karak Azgal (text layer) | 11 Nov 2026 |
| `ghutani.json` | ghutani (2b, Relics of the Crusades) | https://www.broheim.net/downloads/fo/97RelicsoftheCrusadesPt2.pdf | 2-4 (text layer; page 3 as an image) | 11 Nov 2026 |
| `muzil.json` | muzil (2b, Relics of the Crusades) | https://www.broheim.net/downloads/fo/97RelicsoftheCrusadesPt2.pdf | 2-4 (text layer; page 3 as an image) | 11 Nov 2026 |
| `turjuk.json` | turjuk (2b, Relics of the Crusades) | https://www.broheim.net/downloads/fo/97RelicsoftheCrusadesPt2.pdf | 2-4 (text layer; page 3 as an image) | 11 Nov 2026 |
| `skaven-of-clan-skryre-rel.json` | skaven-of-clan-skryre-rel (2b, Relics of the Crusades) | https://www.broheim.net/downloads/fo/97RelicsoftheCrusadesPt2.pdf | 5-8 (text layer; no images) | 11 Nov 2026 |
| `slavers.json` | slavers (2b, Relics of the Crusades) | https://www.broheim.net/downloads/fo/97RelicsoftheCrusadesPt2.pdf | 9-11 (text layer; no images) | 11 Nov 2026 |
| `the-fallen.json` | the-fallen (2b, Relics of the Crusades) | https://www.broheim.net/downloads/fo/97RelicsoftheCrusadesPt2.pdf | 12-14 (text layer; no images) | 11 Nov 2026 |
| `albion-barbarians.json` | albion-barbarians (3, Grade 3) | https://www.broheim.net/downloads/warbands/experimental/Albion%20Barbarians.pdf | 1-5 (text layer) | 11 Nov 2026 |
| `altdorf-expeditionary-party.json` | altdorf-expeditionary-party (3, Grade 3) | https://www.broheim.net/downloads/warbands/experimental/Altdorf%20Expeditionary%20Party.pdf | 1-10 (text layer; page 1 as an image for its skill table) | 11 Nov 2026 |
| `assassin-squad-knives-from-the-dark.json` | assassin-squad-knives-from-the-dark (3, Grade 3) | https://www.broheim.net/downloads/warbands/experimental/Assassin%20Squad.pdf | 1-8 (text layer) | 11 Nov 2026 |
| `circus-extraordinare.json` | circus-extraordinare (3, Grade 3) | https://www.broheim.net/downloads/warbands/experimental/Circus%20Extraordinaire.pdf | 1-7 (text layer) | 11 Nov 2026 |
| `drowned-dead.json` | drowned-dead (3, Grade 3) | https://www.broheim.net/downloads/warbands/facebook/Drowned%20Dead.pdf | 1-11 (text layer; 1-4 story, 10-11 modelling notes) | 11 Nov 2026 |
| `dwarf-grudgebearers.json` | dwarf-grudgebearers (3, Grade 3) | https://www.broheim.net/downloads/warbands/experimental/Dwarf%20Grudgebearers.pdf | 1-6 (text layer; its skill table read from the page's own text columns) | 11 Nov 2026 |
| `goblin-raiders.json` | goblin-raiders (3, Grade 3) | https://www.broheim.net/downloads/warbands/web/Goblin%20Raiders.pdf | 1-8 (text layer; page 2 as an image for its skill table) | 11 Nov 2026 |
| `hobgoblin-horde.json` | hobgoblin-horde (3, Grade 3) | https://www.broheim.net/downloads/warbands/web/Hobgoblin%20Horde.pdf | 1-6 (text layer; page 1 as an image for its skill table) | 12 Nov 2026 |
| `mordheimers-fanatics.json` | mordheimers-fanatics (3, Grade 3) | https://www.broheim.net/downloads/warbands/experimental/Mordheimer%20Fanatics.pdf | 1-7 (text layer; no images) | 12 Nov 2026 |
| `ostermark-roadwardens.json` | ostermark-roadwardens (3, Grade 3) | https://www.broheim.net/downloads/warbands/facebook/Ostermark%20Roadwardens.pdf | 1-10 (text layer, the data on 1-3; no images) | 12 Nov 2026 |
| `the-innocents.json` | the-innocents (3, Grade 3) | https://www.broheim.net/downloads/warbands/facebook/The%20Innocents.pdf | 1-12 (text layer; pages 4 and 11 as images, 1 and 12 cover and credits) | 12 Nov 2026 |
| `tilean-thespian-troupe.json` | tilean-thespian-troupe (3, Grade 3) | https://www.broheim.net/downloads/warbands/facebook/Tilean%20Thespian%20Troupe.pdf | 1-7 (text layer; no images) | 12 Nov 2026 |
| `werewolf-hunting-pack.json` | werewolf-hunting-pack (3, Grade 3) | https://www.broheim.net/downloads/warbands/web/Werewolf%20Hunting%20Pack.pdf | 1-7 (text layer; no images) | 12 Nov 2026 |
| `wood-elves-the-asrai-way-farers.json` | wood-elves-the-asrai-way-farers (3, Grade 3) | https://www.broheim.net/downloads/warbands/experimental/Wood%20Elves,%20the%20Asrai%20Way-farers.pdf | 1-8 (its text layer holds no profiles or skill table; pages 2, 6 and 7 as images) | 12 Nov 2026 |
| `savage-orcs-ath.json` | savage-orcs-ath (3, Athel Loren) | https://www.broheim.net/downloads/campaigns/athelloren/Athel%20Loren%20Campaign%20Rules.pdf#page=46 | 46-52 of the Athel Loren campaign rules (text layer; no images) | 11 Nov 2026 |
| `wood-elf-scouts.json` | wood-elf-scouts (3, Athel Loren) | https://www.broheim.net/downloads/campaigns/athelloren/Athel%20Loren%20Campaign%20Rules.pdf#page=52 | 52-56 (text layer; no images) | 11 Nov 2026 |
| `dwarf-troll-slayers.json` | dwarf-troll-slayers (3, Athel Loren) | https://www.broheim.net/downloads/campaigns/athelloren/Athel%20Loren%20Campaign%20Rules.pdf#page=56 | 56-65 (text layer; no images) | 11 Nov 2026 |
| `skaven-of-clan-skryre-ath.json` | skaven-of-clan-skryre-ath (3, Athel Loren) | https://www.broheim.net/downloads/campaigns/athelloren/Athel%20Loren%20Campaign%20Rules.pdf#page=66 | 66-77 (text layer; no images) | 11 Nov 2026 |
| `mazzalupo.json` | mazzalupo (2a, Mordheim 2a) | https://mordheimer.net/docs/warbands/grade-2a-warbands/mazzalupo | the whole page (a web page, not a PDF) | 11 Nov 2026 |
| `order-of-the-mare.json` | order-of-the-mare (2a, Mordheim 2a) | https://mordheimer.net/docs/warbands/grade-2a-warbands/order-of-the-mare | the whole page (a web page, not a PDF) | 11 Nov 2026 |

The six Relics of the Crusades warbands are one 16-page PDF (its pages 1 and 15-16 are the setting's other warbands, its hired swords
and its dramatis persona, none of them imported). Its pages 2-4 are one Arabian Tribes warband list with three tribes - Ghutani, Muzil and Turjuk -
that share every fighter, price and equipment list and differ only in their Special Rules and their skill table; our data holds the three as three
warband types, so each is a source file of its own. The Clan Skryre template carries its setting in brackets, because Karak Azgal and Athel Loren
hold a warband of that name too. The setting's own campaign PDFs (its part 1, which holds the slave rules, the Arabian Steed and the Holy skills its
pages point at) are not read, so what they would fill is stubbed or flagged.

The four Athel Loren warbands above are all in one 77-page campaign PDF, each read from its own pages only; the setting's shop price charts (pages 38 to 46)
re-price and re-rarify our items per shop location rather than per warband, so they are not imported, and the stubs' rarities are each warband's own shop's.
Three of the four share a name with a warband of another setting, so their skill groups and templates carry the setting in brackets: `Savage Orcs (Athel Loren)`
beside `savage-orcs-sar` and `savage-orcs-kaz`, `Skaven of Clan Skryre (Athel Loren)` beside `-kaz` and `-rel`, and `Slayer Skills (Athel Loren)` because our
`Dwarf Troll Slayers` skill group is mordheimer's list for the Dwarf Treasure Hunters, Dwarf Rangers and Pit Fighters, not this warband's.

The last two rows are the only ones read from a web page rather than a PDF (William, 11 Nov 2026, who gave the two
mordheimer links): broheim.net serves no PDF for either warband, and neither is in the mordheimer snapshot, whose
grade 2a pages carry no structured JSON. They are written in this directory's shape because it is the shape for a
warband read by hand from a document, whatever the document is, and `check_pdf.py` and `tests/test_pdf_warbands.py`
check it; each file's first flag says it came from a web page, and every flag's `page` is 1, the page itself. A
later batch that renames the directory should take them with it.

The four Lustria warbands above are the supplement's own, not Town Cryer's: Lustria also holds a grade 1b Lizardmen warband
(`lizardmen-tc11`) and the setting is a mixed-grade one (19 entries at 1b, 4 at 2b), left as one setting at its majority grade
(William, 11 Nov 2026), unlike Khemri, which was split. Their skill groups, templates and the Forest Goblins' race carry the
setting's name in brackets, because another warband of each name already holds the plain one.

The Sartosa warbands' Pirate skill column is the Pirate Skills list of the setting's campaign rules, not of any warband's PDF: it is read from
https://www.broheim.net/downloads/campaigns/sartosa/Sartosa%20Skills%2C%20Hired%20Swords%20%26%20Dramatis%20Personae.pdf (p1-2, text layer; 11 Nov 2026)
as the shared group `sharedSkillGroup` in `sartosan-pirates.json`. Its Hired Swords and Dramatis Personae are not imported.
The same setting's https://www.broheim.net/downloads/campaigns/sartosa/Sartosa%20Equipment.pdf (10 pages, text layer; 11 Nov 2026) gives the Sartosa
stubs their rules and settles their prices. The setting's other eight campaign PDFs are not read (William, 11 Nov 2026).

The Sealed City's own campaign PDFs were read on 12 Nov 2026, for what its warbands point at. Its Stygian Mutations
(https://www.broheim.net/downloads/campaigns/sealedcity/Stygian%20Mutations.pdf, 1-7, text layer) prints the D66 chart the Brood of Ghurash's Accelerated
evolution, the Clockworkers' Experimental enhancements and Clan Pristekk's Mutating Experiment roll on: sixteen of its thirty results are specials of ours
already, three of those under another name (Emaciated Appearance is our Extremely Thin, Shrink our Stunted, Poisonous Fangs our Poisonous Bite, each now an
alias) and Moronic our Stupidity by an alias it held; the other fourteen are the setting's own mutations, among them Brightly Patterned Skin (The Sealed
City) and Spiked Tail (The Sealed City), which share a name with ours and do something else, so ours keep the plain name as the earlier setting's. The
chart itself is a second D66 table and is not imported. Its Lost And Found (1-5, text layer) is the setting's equipment chapter and price chart, read as
Khemri's Equipment page was: ten items we lacked (Krakensilver Weapon, Clockwork Lenses, Clockwork Prosthesis, Quarter Map, Lurking Fear, Moonshine,
Stardust, Gaveleers, Shredders, Splinters) are stubs for the setting's five warband types, the Beast of Burden is a clockwork mount in the bestiary, and the
Clockwork pistol and Clockwork rifle, read as our Pistol and Handgun under other names in batch 11, are their own items now: the chapter gives each a range,
Strength and two rules of its own and the price chart sells all four as separate lines. Seven of the chart's lines differ from our own price or rarity and
take a row for the setting's types. Its Ambitions (1-7, the campaign-point ambitions and their achievement charts) and Madness Rules (1-3, Insanity
Points on a reversed experience track and a 2D6 Insanity table) are campaign mechanisms and carry no catalogue rows; both name warbands of the
setting we do not hold (Maidens of Dusk and Dawn, Pirates of the Great Ocean) and Ambitions names the hired sword Henrik Bramstetter. The moonstones and orichalcum tokens the
Clockworkers and Clan Pristekk spend are priced in neither document, so the Orichalcum token stub still carries no rules and no moonstone item exists.

The Khemri warbands' type rows carry Broheim's grade 3, while the grade that counts is their setting's: Khemri is graded 1b, because the
setting also holds the 1b Arabian Tomb Raiders and Tomb Guardians (flagged for William, 11 Nov 2026; nothing of ours was changed).
The Nehekhara Tomb Guards' PDF (https://www.broheim.net/downloads/warbands/supplement/khemri/Nehekhara%20Tomb%20Guards.pdf, 1-9, text layer; read 11 Nov 2026)
is the warband mordheimer's snapshot already holds as `testwarbands-2026-10-31/warbands/tomb-guardians-old.json`, so no source file was written for it:
its numbers match ours and its differences are flagged in the vet file instead.
Khemri's Equipment PDF gave the Ankus, Cutlass and Great Scimitar their rules (11 Nov 2026), and its Elemental Magic
(https://www.broheim.net/downloads/campaigns/khemri/Elemental%20Magic.pdf, 1-2, text layer; read 12 Nov 2026) holds the setting's own four lores of six
spells each - Ice Magic, Fire Magic, Wind Magic and Earth Magic, all Khemri 3's - which the Mages' Arch Mage and Mage and the Arabyan Nomads' Street Mage
now cast from, in place of our Elemental Lores of Air, Earth, Fire and Water, the Sorcerous Society's Mordheim 2a lores they pointed at while the PDF went
unread. Khemri 1b's Arabian Elemental Magic, a six-spell list of mordheimer's that the Arabian Tomb Raiders' Mystic casts, is none of the four and is left
alone. Its Campaign Rules (https://www.broheim.net/downloads/campaigns/khemri/Khemri%20Campaign%20Rules.pdf, 1-22, text layer; read 12 Nov 2026) are the
setting's own mechanisms - weather, tombs, traps, perception in darkness, concealed movement, water and a post-battle resupply table - and carry one
catalogue row between them: p8 prints the Spot/Disarm trap and Set Trap skills in full, both halves of our Trap Expert at the same rolls, and only their
limit of four takes was missing from its description (`skill_descriptions` in `overrides.json`). Its pages 19-20 are the Elemental Magic above; its
Torch and Lantern are ours reworded for the optional perception rules and its Water is a warband counter, neither imported. The setting's Dramatis
Personae PDF goes with Broheim's `downloads/dramatispersonae/` section (William, 12 Nov 2026), and its Town Cryer compilation is read only for what a gap
points at.

Karak Azgal's eight warbands share one 76-page PDF, and only each warband's own pages were read; its campaign material (pages 1-18 and 62-76, the hired swords, exploration chart, runic artefacts and scenarios among them) is not imported. Four of them point at warbands we already hold for their lists, rules or skills ("all of the equipment lists from Town Crier 6 (or Best of Town Crier) apply", "the Orc special skills from TC6"): those were taken from our own Dwarf Treasure Hunters, Skaven and Mercenaries warbands and our Dwarves, Dwarf Troll Slayers and Orcs skill groups, never from another PDF.

The fourteen grade 3 warbands above belong to no supplement and share the existing `grade-3` setting, which turns all fourteen of
them on at once (William, 11 Nov 2026): Albion Barbarians, Altdorf Expeditionary Party, Assassin Squad, Circus Extraordinaire, Drowned
Dead, Dwarf Grudgebearers and Goblin Raiders, then Hobgoblin Horde, Mordheimers' Fanatics, Ostermark Roadwardens, The Innocents, Tilean
Thespian Troupe, Werewolf Hunting Pack and the Wood Elves, the Asrai Way-farers. They share no content with one another: each brings its
own skill group, and only the Dwarf Grudgebearers join a group of ours (the Dwarves list, which is their own skill table word for word).
The Goblin Raiders' and the Hobgoblin Horde's Leather Whip is one item both pages declare, with a price row each at 7 gc.
Four of the last seven sit near warbands we already hold and are none of them: the Hobgoblin Horde is not Khemri's Hobgoblins (its own
skills, items and Hobgoblin maximum), the Werewolf Hunting Pack is not our Undead, the Strigoi or the Drowned Dead (its own Werewolf and
Wulfmaeg races), the Asrai Way-farers are not Athel Loren's Wood Elf Scouts, which share five of their items at our prices and no skill
or race, and the Ostermark Roadwardens are not the Mercenaries' Ostermarkers variant, whose Ostermark rule is untouched.

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
- **A setting's equipment page William sends is read** (11 Nov 2026, of the Khemri Equipment PDF,
  https://www.broheim.net/downloads/campaigns/khemri/Equipment.pdf): it gives the setting's bare stubs their rules
  and its own weapons their items, declared once on the first page of the setting that sells them. An item of ours
  under another name is linked (the Jambiya is our Dagger, "just a nicknamed dagger"); one of ours whose rules
  differ is its own item named for the setting (**Scythe (Khemri)**, "in this list scythe is something unique so
  give it the 'khemri' treatment"), and a tag that made a list sell ours twice is dropped (`drop_tags` in
  `item_names`: our Sword's "scimitar", now that the Khemri Scimitar is its own item). Which half of a split setting
  an item belongs to follows the warbands that sell it. A mount goes in the bestiary with its profile and its rules
  as writing, and its item is the Animal item of that beast (the Magic Carpet). An item the page prints that no
  warband list sells and no page prices takes a row with no price (`cost` null) for the setting's types.
- **Never fetch a setting's own PDFs to fill a gap** (William, 11 Nov 2026), unless he sends one. Read the warband PDFs, stub whatever is
  missing, a fighter left with no skill list included, and fill it when that setting's batch comes. The Sartosa
  skills and equipment PDFs already read stay as they are.
- **A warband whose book gives it no fixed leader stays leaderless** (William, 11 Nov 2026), with a warband rule
  saying how the leader is worked out each game (the Knights-Errant's highest D6+7, The Lost's highest Leadership).
  The template check's "no leader" warning is expected.
- **A PDF that varies another warband's list is that list's variants** (William, 11 Nov 2026: "Orc Pirates & Savage
  Orcs should just be 2 variants of the orc mob if that still works, correctly pointing at their settings"). Each
  half of the Orc Pirates & Savage Orcs PDF is "the exact same rules as the Da Mob Warband with the following
  changes", so each is a source file of its own that folds into the Orc Mob's template (`variantOf`: the snapshot
  page and the variant key) and builds no template of its own. The variants themselves and the types that preset
  them are `template_answers` (`VARIANTS`, `TEMPLATE_TYPES`), where the snapshot's variants already live; the fold
  makes its rules the variant's, names the variant on every line of its lists (the base warband's lines take the
  first variant), and folds its fighters: one the base holds takes the page's skill groups and counts as
  `variantChanges`, one it lacks joins the roster with no other variant allowing any of him, and one the page lacks
  is allowed none in this variant. **A fighter a variant allows none of is not offered in it**, and a list with no
  line in the variant is not shown, so a Mordheim Orc Mob never sees a Sartosa Goblin Swabbie. Each type keeps its
  own setting and presets its own variant, so nobody picks another setting's warband. A Broheim type the change
  replaces is left out through `drop_warband_types` in `overrides.json` and the new ones are `extra_warband_types`
  entries, so the seeder archives the old type and warbands raised as it keep it. A name two settings already share
  keeps the house convention of its source code in the slug (`savage-orcs-sar`, beside `savage-orcs-kaz` and
  `savage-orcs-ath`).
- **A fighter's buyable extra rules are template upgrades** (`mutations`: the Blood Dragon Vampire's bloodline
  abilities), **and a fighter who brings another model is a hired sword** (the Dark Elf Corsairs' Specialists);
  neither stays a warband rule (William, 11 Nov 2026).

## William's review (12 Nov 2026)

The answers to the questions the fifteen vetting documents left open. They are standing decisions: don't raise them
again.

- **Where only the name differs, merge into ours and drop the other name.** Blending into the Sands is our Sand
  worm; No Pain and Numb are our Ignore Pain, whose "only with the Resilient Strength skill" condition goes with
  them; Fear and Rotten Body (Mousillon) are our Fearsome; "Savage" is one of the shared Frenzy's names; the
  Mazzalupo's Bearcloak is our Wolfcloak, reworded away from the wolf and from Middenheim; the Masters of Horror's
  Repeater Pistol is ours, with a price row at its entry's 25+3D6; there is one Savage Fury ("keep as 1 add charm"),
  reworded away from the Amazon, which the Albion Barbarians learn too; and the Mutiny in Marienburg Lamp of the
  Djinn, which had no rules at all, folds into Khemri's. Expert Explorer, Silent Strike, Sword Master, Combat
  Charge, Thinglash, Scourge, Leather Whip, Longsword, Kanabo, Cutlass, Great Scimitar and Scythe (Khemri) stay
  apart, confirmed.
- **Where the rules really differ, separate them: the earliest keeps the true name and the later ones take their
  setting or warband in brackets.** Poison Wind Globe (Athel Loren) and Sea Dragon Cloak (Druchii) are items of
  their own. The Altdorf Quarterstaff is "just a mace", so it is our Club, Mace or Hammer under the page's name;
  the House Guard's pike is our one Pike; Khemri's Strength 1 Tufenk stays out, ours Strength 2; and our Magic
  Carpet takes the Khemri page's fire rule.
- **A separated item serves only the warband whose page prints it.** The +2/+1 cloak that stacks with other armour
  is the Druchii's alone, at their page's 30+2D6, Rare 10, because the page's "Corsairs may wear Sea Dragon Cloaks
  though they are not Heroes" names that warband's own henchman unit, a Corsair, and not the Mousillon Dark Elf
  Corsairs, whose own page prints the cloak at 50 gc with no rules. So the Corsairs buy our standard Sea Dragon
  Cloak, 50+2D6 Rare 10 in the store and 50 on their list (William, 12 Nov 2026: "corsairs should point at the
  other sea dragon cloak i think which is 50+2d6 in store, and starting price of just 50 on their list"), which
  changes their cloak's rules as well as its price: they take our flat 4+ save against missiles and 5+ in close
  combat rather than the Druchii's +2 and +1. A warband a separated item was pointed at on a guess goes back to
  ours, it does not keep a row of its own.
- **One of our own numbers may be the wrong one,** and then the book for its warband wins: the Nehekharan Javelins
  throw 12", Merneptah's Scroll of the Scarab Song reaches 12" and does 1D6 hits, and the Assassin Squad's Master
  of Poisons brews D3-1 portions.
- **A Mutiny in Marienburg item of a Mordheim grade belongs to that Mordheim setting** (`grading.mim_setting`), and
  the grades above the supplement's own 2b, which the system has no part for, are 2b: "2c should move to 2b", "put
  all those 3a items in 2b MiM as well".
- **A warband whose own list sells an item joins the price row that holds its price** rather than take one of its
  own, where the price is the same (the Nehekhara Tomb Guards' three Khemri items, the Sea Ghosts' cloak).
- **Spelling is aligned across the catalogue** ("fix all spelling and keep it aligned"), with a book's own wording
  left alone and flagged (the Karak Azgal Savage Orcs' Wierdo and Spottaz).
- **One template may serve several warband types that share a page** (`template_answers.TEMPLATE_TYPES`), rather
  than one of them going without: both Norse Explorers types point at the one mordheimer page, and the Border Town
  Burning type has no page of its own, so the template serves both and the Norse stay raisable in a Border Town
  Burning campaign, where deleting the type would have taken them out of it. Neither type presets a variant (the
  page has none) and the template keeps Lustria, the first type's and the earlier setting. The two PDFs may differ -
  the Lustria one is the errata'd Town Cryer 13 printing - and if the Border Town Burning version turns out to
  differ materially it wants a template of its own; its 206-page book was not read to find out.
- **A warband type the importer invented from a restriction in brackets is deleted, and the restriction stays the
  item's note.** The Albion Commandos had no grade, no source code, no mordheimer page and no PDF, and existed
  only because one line of the Marienburg weapons list reads "Caber (Albion Commandos only)"; the name is in the
  whole corpus exactly once, in that bracket. The Caber is for everyone now, noted "Albion Commandos only".
- **A repeated equipment line is not a duplicate** unless one list holds it twice over with nothing to tell the two
  apart. A book printing "Mace" and "Hammer" as two lines of our one Club, Mace or Hammer keeps both, each under
  its own name (60 such pairs), and an item on two of a template's lists is one line per list, each list a
  different fighter's: the Druchii sell the Sea Dragon Cloak on the Heroes list and on the Corsairs list, which is
  what their rule "Corsairs may wear Sea Dragon Cloaks though they are not Heroes" is for. No list anywhere holds a
  line twice over, and a test guards that.
