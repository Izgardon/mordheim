from django.urls import path

from .views import (
    CampaignBountiesView,
    CampaignBountyCandidatesView,
    CampaignBountyClaimAcceptView,
    CampaignBountyClaimDeclineView,
    CampaignBountyClaimsView,
    CampaignBountyTargetsView,
    CampaignBountyWithdrawView,
)

BOUNTY = "campaigns/<int:campaign_id>/bounties/<int:bounty_id>/"
CLAIM = f"{BOUNTY}claims/<int:claim_id>/"

urlpatterns = [
    path("campaigns/<int:campaign_id>/bounties/", CampaignBountiesView.as_view(), name="campaigns-bounties"),
    path(
        "campaigns/<int:campaign_id>/bounties/targets/",
        CampaignBountyTargetsView.as_view(),
        name="campaigns-bounties-targets",
    ),
    path(f"{BOUNTY}withdraw/", CampaignBountyWithdrawView.as_view(), name="campaigns-bounties-withdraw"),
    path(f"{BOUNTY}candidates/", CampaignBountyCandidatesView.as_view(), name="campaigns-bounties-candidates"),
    path(f"{BOUNTY}claims/", CampaignBountyClaimsView.as_view(), name="campaigns-bounties-claims"),
    path(f"{CLAIM}accept/", CampaignBountyClaimAcceptView.as_view(), name="campaigns-bounties-claims-accept"),
    path(f"{CLAIM}decline/", CampaignBountyClaimDeclineView.as_view(), name="campaigns-bounties-claims-decline"),
]
