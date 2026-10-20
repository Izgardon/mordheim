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
from .chat import CampaignMessagesView
from .content import (
    CampaignBulletinDetailView,
    CampaignBulletinView,
    CampaignCommonRulesView,
    CampaignEncampmentDetailView,
    CampaignEncampmentsView,
    CampaignHouseRuleDetailView,
    CampaignHouseRulesView,
    CampaignLocationDetailView,
    CampaignLocationsView,
)
from .members import (
    CampaignMemberPermissionsView,
    CampaignMemberRemovalPreviewView,
    CampaignMemberRemoveView,
    CampaignMemberRoleView,
    CampaignMembersView,
    CampaignMyPermissionsView,
    CampaignOwnershipView,
    CampaignPermissionsView,
)
from .overview import (
    CampaignActiveBattleCancelView,
    CampaignActiveBattlesView,
    CampaignBattleHistoryView,
    CampaignPivotalMomentsView,
    CampaignPlayersView,
    CampaignTopKillersView,
)

__all__ = [
    "CampaignActiveBattleCancelView",
    "CampaignActiveBattlesView",
    "CampaignArchiveView",
    "CampaignBattleHistoryView",
    "CampaignBulletinDetailView",
    "CampaignBulletinView",
    "CampaignCommonRulesView",
    "CampaignDetailView",
    "CampaignEncampmentDetailView",
    "CampaignEncampmentsView",
    "CampaignHouseRuleDetailView",
    "CampaignHouseRulesView",
    "CampaignJoinCodeView",
    "CampaignListCreateView",
    "CampaignLocationDetailView",
    "CampaignLocationsView",
    "CampaignMemberPermissionsView",
    "CampaignMemberRemovalPreviewView",
    "CampaignMemberRemoveView",
    "CampaignMemberRoleView",
    "CampaignMembersView",
    "CampaignMessagesView",
    "CampaignMyPermissionsView",
    "CampaignOwnershipView",
    "CampaignPermissionsView",
    "CampaignPivotalMomentsView",
    "CampaignPlayersView",
    "CampaignRestoreView",
    "CampaignTopKillersView",
    "JoinCampaignView",
]
