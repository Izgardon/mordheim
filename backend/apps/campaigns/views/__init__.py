"""Campaign views, one module per concern; every view under campaigns/<id>/ derives from CampaignScopedView
(views/base.py) except the players list (PERF-41)."""

from .campaigns import (
    CampaignArchiveView,
    CampaignDetailView,
    CampaignJoinCodeView,
    CampaignListCreateView,
    CampaignRestoreView,
    JoinCampaignView,
)
from .chat import CampaignChatReadView, CampaignMessageDetailView, CampaignMessagesView
from .content import (
    CampaignCommonRulesView,
    CampaignEncampmentDetailView,
    CampaignEncampmentsView,
    CampaignHouseRuleDetailView,
    CampaignHouseRulesView,
    CampaignLocationDetailView,
    CampaignLocationsView,
)
from .members import (
    CampaignLeaveView,
    CampaignMemberPermissionsView,
    CampaignMemberRemovalPreviewView,
    CampaignMemberRemoveView,
    CampaignMemberRoleView,
    CampaignMembersView,
    CampaignOwnershipView,
    CampaignPermissionsView,
)
from .overview import (
    CampaignActiveBattleCancelView,
    CampaignActiveBattlesView,
    CampaignBattleHistoryView,
    CampaignChronicleView,
    CampaignPlayersView,
    CampaignSearchView,
    CampaignTopKillersView,
)

__all__ = [
    "CampaignActiveBattleCancelView",
    "CampaignActiveBattlesView",
    "CampaignArchiveView",
    "CampaignBattleHistoryView",
    "CampaignChronicleView",
    "CampaignChatReadView",
    "CampaignCommonRulesView",
    "CampaignDetailView",
    "CampaignEncampmentDetailView",
    "CampaignEncampmentsView",
    "CampaignHouseRuleDetailView",
    "CampaignHouseRulesView",
    "CampaignJoinCodeView",
    "CampaignLeaveView",
    "CampaignListCreateView",
    "CampaignLocationDetailView",
    "CampaignLocationsView",
    "CampaignMemberPermissionsView",
    "CampaignMemberRemovalPreviewView",
    "CampaignMemberRemoveView",
    "CampaignMemberRoleView",
    "CampaignMembersView",
    "CampaignMessageDetailView",
    "CampaignMessagesView",
    "CampaignOwnershipView",
    "CampaignPermissionsView",
    "CampaignPlayersView",
    "CampaignRestoreView",
    "CampaignSearchView",
    "CampaignTopKillersView",
    "JoinCampaignView",
]
