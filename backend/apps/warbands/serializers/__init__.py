from apps.warbands.units.catalogue import ItemSummarySerializer, SpecialDetailSerializer, SpellDetailSerializer
from apps.warbands.units.kinds import UnitKindKey
from apps.warbands.units.serializers import UnitSerializers

from .henchmen import (
    HenchmenGroupCreateSerializer,
    HenchmenGroupDetailSerializer,
    HenchmenGroupSummarySerializer,
    HenchmenGroupUpdateSerializer,
)
from .heroes import (
    HeroCreateSerializer,
    HeroDetailSerializer,
    HeroSummarySerializer,
    HeroUpdateSerializer,
)
from .hirelings import (
    HirelingCreateSerializer,
    HirelingDetailSerializer,
    HirelingSummarySerializer,
    HirelingUpdateSerializer,
)
from .ledger import (
    WarbandLogCreateSerializer,
    WarbandLogSerializer,
    WarbandTradeCreateSerializer,
    WarbandTradeEditSerializer,
    WarbandTradeSerializer,
)
from .warbands import (
    WarbandCreateSerializer,
    WarbandItemSaleSerializer,
    WarbandItemSummarySerializer,
    WarbandItemTransferSerializer,
    WarbandResourceCreateSerializer,
    WarbandResourceSaleSerializer,
    WarbandResourceSerializer,
    WarbandResourceUpdateSerializer,
    WarbandSerializer,
    WarbandSummarySerializer,
    WarbandUpdateSerializer,
)

__all__ = [
    "HeroCreateSerializer",
    "HeroDetailSerializer",
    "HeroSummarySerializer",
    "HeroUpdateSerializer",
    "HenchmenGroupCreateSerializer",
    "HenchmenGroupDetailSerializer",
    "HenchmenGroupSummarySerializer",
    "HenchmenGroupUpdateSerializer",
    "HirelingCreateSerializer",
    "HirelingDetailSerializer",
    "HirelingSummarySerializer",
    "HirelingUpdateSerializer",
    "ItemSummarySerializer",
    "SpecialDetailSerializer",
    "SpellDetailSerializer",
    "WarbandCreateSerializer",
    "WarbandItemSaleSerializer",
    "WarbandItemSummarySerializer",
    "WarbandItemTransferSerializer",
    "WarbandLogCreateSerializer",
    "WarbandLogSerializer",
    "WarbandResourceCreateSerializer",
    "WarbandResourceSaleSerializer",
    "WarbandResourceSerializer",
    "WarbandResourceUpdateSerializer",
    "WarbandSerializer",
    "WarbandSummarySerializer",
    "WarbandTradeCreateSerializer",
    "WarbandTradeEditSerializer",
    "WarbandTradeSerializer",
    "WarbandUpdateSerializer",
    "UNIT_SERIALIZERS",
]

UNIT_SERIALIZERS: dict[UnitKindKey, UnitSerializers] = {
    "hero": UnitSerializers(HeroSummarySerializer, HeroDetailSerializer, HeroCreateSerializer, HeroUpdateSerializer),
    "henchmen_group": UnitSerializers(
        HenchmenGroupSummarySerializer,
        HenchmenGroupDetailSerializer,
        HenchmenGroupCreateSerializer,
        HenchmenGroupUpdateSerializer,
    ),
    "hireling": UnitSerializers(
        HirelingSummarySerializer, HirelingDetailSerializer, HirelingCreateSerializer, HirelingUpdateSerializer
    ),
}
