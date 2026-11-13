# Warbands from their PDFs: nothing left

Every warband broheim serves is imported (12-13 Nov 2026). **151 templates across 19 settings.**

The last batches: Karak Azgal's eight, Lustria's four, Relics of the Crusades' six, Athel Loren's four and the
fourteen Grade 3 warbands, plus Mazzalupo and the Order of the Mare read from their mordheimer pages.

## What is deliberately not here

- **Karak Eight Peaks** — Clan Angrund, Crooked Moon and Slave Uprising. Their PDFs are scans with no text layer
  at all. William, 12 Nov: *"skip and remove the setting from options"*. The setting is gone and the three
  warband types are retired.
- **Relics of the Crusades, part 1** — `downloads/campaigns/relicsofthecrusades/` is an **empty directory** on
  broheim, so the Slave's profile, the Arabian Steed and the Holy skills cannot be read. They stay stubbed.
- **The Sealed City's Maidens of Dusk and Dawn and Pirates of the Great Ocean** — named inside the setting's own
  Ambitions and Stygian Mutations documents, but **no sheet exists** on broheim (its warband directory holds
  exactly the five we have) and both mordheimer URLs 404.
- **Snerik, the Shade Scout and the Halfling Cook** — hired swords our warband rules name. Karak Azgal names
  Snerik twice and gives no entry; the other two have no page anywhere in the 73 hireling PDFs or any campaign
  document.

## The campaign documents

A separate tree, `downloads/campaigns/<slug>/`, which `fetch.sh` does **not** cover. Mined so far: Mutiny in
Marienburg's main document, Khemri's, the Sealed City's, Sartosa's and the Nemesis Crown's. Unread: Albion,
Athel Loren, Border Town Burning, Karak Azgal, Lustria, Mousillon, Sylvania and Warpstones Belong To Us.

**Read `.pdf-sources/work/campaign-documents-scouting.md` before opening the Marienburg one**: its item names,
chapter headings and whole Bestiary chapter are set in fonts with no character map, so `pdftotext` emits
gibberish rather than failing.
