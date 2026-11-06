"""Checks every PDF warband source file (`sources/pdf-warbands/`) against its shape and our catalogue (pdf_check.py).

Run from ``backend/`` in the lint container: ``python -I catalogue_import/check_pdf.py``. It prints each file's
problems and what it found (lines and how they matched, stubs, flags) and exits 1 when any file has a problem. It reads
``out/``, so run build.py first when the catalogue changed.
"""

import sys
from pathlib import Path


def main() -> int:
    # -I leaves the script's directory off sys.path, so put backend/ on it to import the package
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from catalogue_import.common import load_json
    from catalogue_import.pdf_check import check_page, load_catalogue
    from catalogue_import.pdf_warbands import PDF_SOURCES
    from catalogue_import.templates import our_races_and_lores

    pages = {path.stem: load_json(path) for path in sorted(PDF_SOURCES.glob("*.json"))}
    catalogue = load_catalogue(pages, *our_races_and_lores())
    failed = 0
    for slug, page in pages.items():
        found = check_page(slug, page, catalogue)
        failed += bool(found.problems)
        how = ", ".join(f"{count} by {by}" for by, count in sorted(found.by.items()))
        print(f"{slug}: {'FAILED' if found.problems else 'ok'}")
        print(f"  {len(page.get('fighters') or [])} fighters; {found.lines} lines ({how})")
        print(f"  stubs: {', '.join(found.stubs) or 'none'}; flags: {len(page.get('flags') or [])}")
        for problem in found.problems:
            print(f"  problem: {problem}")
    print(f"{len(pages)} files, {failed} with problems")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
