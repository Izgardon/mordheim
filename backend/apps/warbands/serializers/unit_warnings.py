"""A unit payload's `warnings`: what the server warns of on his card, in its words (heroes and hired swords, the kinds
with a caster). Today a wizard in armour (units/caster_armour.py), read from the item rows loaded with him."""

from typing import Any, ClassVar

from apps.warbands.units.caster_armour import wizard_armour_warnings
from apps.warbands.units.kinds import UnitKindSpec
from apps.warbands.units.serializers import get_prefetched_or_query


class UnitWarningsMixin:
    """Each payload declares `warnings = serializers.SerializerMethodField()` itself, as DRF collects fields from
    serializer classes only."""

    kind: ClassVar[UnitKindSpec]

    def get_warnings(self, unit: Any) -> list[dict[str, Any]]:
        relation = self.kind.items.relation
        rows = get_prefetched_or_query(unit, relation, relation)
        return wizard_armour_warnings(unit, [row.item for row in rows if row.item_id])
