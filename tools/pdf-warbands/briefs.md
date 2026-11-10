# What the earlier briefs settled

The briefs for the pilot and batches 2-6 (5-6 Nov 2026), condensed to what still governs the work. Their data rules,
William's answers on each batch, are in `backend/catalogue_import/sources/pdf-warbands/README.md` under "Adding a
warband" and "William's rulings", and aren't repeated here.

**The pilot (3 warbands):** built the way in.
- William, 5 Nov 2026: "lets begin adding warbands in via their pdfs, will cross reference missing items/skills
  after the case … make sure we can extract this data cheaply … start in small batches so we can vet."
- One source file per warband in the mordheimer snapshot's page shape
  (`sources/testwarbands-2026-10-31/warbands/*.json`), loaded beside the snapshot by the same code path as book
  templates, mapped to its type by our type slug (in the file or `template_answers`), never by fuzzy name. Grade and
  setting come from the type.
- The warband's own special skills become its skill group; a missing item is a stub (William: "yes to stubs") that
  the vet file lists with the page of its rules; a missing race is created, with the PDF's maximum profile, else the
  fighter's own (the Kroxigor precedent).
- A check script, not a second read: shape, stats in range (or a written stat like "D6"), prices as numbers, counts
  and group sizes, starting gold and maximum models, and every item, skill group, race and lore matched or listed as
  unmatched. It runs as a test over every file.
- Rule text in our own words with every number, roll, range, modifier, test and condition exact; no flavour; never
  guess (leave a number empty and flag its page). The books are copyrighted, and William knows why.

**Batch 2: cheaper than the pilot.**
- One commit for the whole batch, with one run of each gate before it. Rebuild `out/` and run `check_pdf` as often
  as needed; they're cheap.
- Find image-only tables up front (`pdfimages -list` against the text layer), render only those pages at `-r 110`,
  and never open an image for something the text gives.
- Read each PDF once, in reading order (`pdftotext` without `-layout`), and write its file straight from that.
- Tail the gate output; never read a whole gate log.
- QA by text reads: the templates on the Warbands page, and for each one raise a warband and hire one hero with an
  item from his list. Sign in only with the demo seed's accounts.

**Batch 4: the slips to avoid.** An agent ran python on William's Windows host and wrote scratch files to `/tmp`
there; both are on his PC's never list (`docs/working-notes.md`). In a cloud session, scratch output goes in
`.pdf-sources/work/`.

**Batch 5: running beside another agent.**
- Keep edits to the shared files small and in place; add, don't reorder (the list is in `PROCESS.md`).
- Where our data (much of Mutiny in Marienburg was already ours) and a PDF disagree, flag it with the page and leave
  ours unchanged.

**Combining batches 5 and 6:** the lesson in `PROCESS.md`. Both had built the same mechanisms (stub rules,
`itemRules`, `priceRows`, line notes, `needs_rules`); batch 5's were kept and batch 6's data moved onto them, at
about 130k extra tokens. Since then only one agent changes import code at a time. A rebase keeps both sides of the
shared data files, takes the pinned counts from a fresh seed and rebuilds `out/`.
