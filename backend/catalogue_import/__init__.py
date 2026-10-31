"""First-pass catalogue import: mordheimer's items plus our Mutiny in Marienburg list, cleaned into seed files.

Run ``python -I catalogue_import/build.py`` from ``backend/``. It reads only the snapshots in ``sources/`` and the
repo's own item data, and writes ``out/`` (settings, warband types and groups, item rules, items and a report).
Nothing here touches the database or the app; later phases load these files.
"""
