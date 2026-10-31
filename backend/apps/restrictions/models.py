"""The old restriction table is gone (the items rebuild): who may buy, hire or learn now names warband types and
groups (`warbands.models.types.WarbandAccess`). This app only keeps its migrations, which the items' and hired
swords' first migrations depend on, until the next migration reset; its last one drops the table."""
