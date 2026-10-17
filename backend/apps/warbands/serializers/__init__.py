from apps.warbands.units.kinds import UnitKindKey
from apps.warbands.units.serializers import UnitSerializers

from .henchmen import (
    HenchmenGroupCreateSerializer,
    HenchmenGroupDetailSerializer,
    HenchmenGroupSummarySerializer,
    HenchmenGroupUpdateSerializer,
    HenchmenLevelUpLogSerializer,
)
from .heroes import (
    HeroCreateSerializer,
    HeroDetailSerializer,
    HeroLevelUpLogSerializer,
    HeroSummarySerializer,
    HeroUpdateSerializer,
    ItemSummarySerializer,
    SpecialDetailSerializer,
    SpellDetailSerializer,
)
from .hired_swords import (
    HiredSwordCreateSerializer,
    HiredSwordDetailSerializer,
    HiredSwordLevelUpLogSerializer,
    HiredSwordSummarySerializer,
    HiredSwordUpdateSerializer,
)
from .warbands import (
    WarbandCreateSerializer,
    WarbandItemSaleSerializer,
    WarbandItemSummarySerializer,
    WarbandItemTransferSerializer,
    WarbandLogCreateSerializer,
    WarbandLogSerializer,
    WarbandResourceCreateSerializer,
    WarbandResourceSerializer,
    WarbandResourceUpdateSerializer,
    WarbandSerializer,
    WarbandSummarySerializer,
    WarbandTradeCreateSerializer,
    WarbandTradeSerializer,
    WarbandUpdateSerializer,
)

__all__ = [
    "HeroCreateSerializer",
    "HeroDetailSerializer",
    "HeroLevelUpLogSerializer",
    "HeroSummarySerializer",
    "HeroUpdateSerializer",
    "HenchmenGroupCreateSerializer",
    "HenchmenGroupDetailSerializer",
    "HenchmenLevelUpLogSerializer",
    "HenchmenGroupSummarySerializer",
    "HenchmenGroupUpdateSerializer",
    "HiredSwordCreateSerializer",
    "HiredSwordDetailSerializer",
    "HiredSwordLevelUpLogSerializer",
    "HiredSwordSummarySerializer",
    "HiredSwordUpdateSerializer",
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
    "WarbandResourceSerializer",
    "WarbandResourceUpdateSerializer",
    "WarbandSerializer",
    "WarbandSummarySerializer",
    "WarbandTradeCreateSerializer",
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
    "hired_sword": UnitSerializers(
        HiredSwordSummarySerializer, HiredSwordDetailSerializer, HiredSwordCreateSerializer, HiredSwordUpdateSerializer
    ),
}
