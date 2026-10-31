"""Builds the first-pass catalogue files into ``catalogue_import/out/``.

Run from ``backend/`` in the lint container: ``python -I catalogue_import/build.py``. It reads only repo files and
writes the same bytes every time, so the diff of ``out/`` is the review.
"""

import sys
from pathlib import Path


def main() -> int:
    # -I leaves the script's directory off sys.path, so put backend/ on it to import the package
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from catalogue_import.pipeline import build
    from catalogue_import.sources import OUT

    OUT.mkdir(exist_ok=True)
    for name, content in build().items():
        (OUT / name).write_text(content, encoding="utf-8", newline="\n")
        print(f"wrote out/{name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
