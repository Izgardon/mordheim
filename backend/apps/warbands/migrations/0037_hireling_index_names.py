# The hireling tables' indexes and sequences take their new names (bestiary rewrite step 2). Migration 0036 renamed
# the old hired_sword unit tables to hireling, but Postgres kept the old index and sequence names, which the new
# hired_sword catalogue tables (apps/hirelings) would collide with. Each name is the one Django gives the table now.

from django.db import migrations

TABLES = {  # old table -> its name since 0036
    "hired_sword": "hireling",
    "hired_sword_item": "hireling_item",
    "hired_sword_skill": "hireling_skill",
    "hired_sword_special": "hireling_special",
    "hired_sword_spell": "hireling_spell",
}
COLUMNS = {"hired_sword_id": "hireling_id"}  # the join tables' renamed foreign key
INDEXED = ("warband_id", "race_id", "hired_sword_id", "item_id", "skill_id", "special_id", "spell_id")


def _renames(schema_editor):
    """(kind, old name, new name) for every index and sequence of the renamed tables."""
    for old_table, table in TABLES.items():
        for column in INDEXED:
            old = schema_editor._create_index_name(old_table, [column], suffix="")
            yield "INDEX", old, schema_editor._create_index_name(table, [COLUMNS.get(column, column)], suffix="")
        yield "INDEX", f"{old_table}_pkey", f"{table}_pkey"
        yield "SEQUENCE", f"{old_table}_id_seq", f"{table}_id_seq"


def rename(apps, schema_editor, *, back=False):
    quote = schema_editor.quote_name
    for kind, old, new in _renames(schema_editor):
        source, target = (new, old) if back else (old, new)
        schema_editor.execute(f"ALTER {kind} IF EXISTS {quote(source)} RENAME TO {quote(target)}")


def rename_back(apps, schema_editor):
    rename(apps, schema_editor, back=True)


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0036_rename_hired_sword_to_hireling"),
    ]

    operations = [migrations.RunPython(rename, rename_back)]
