"""Bounties under campaigns/<id>/bounties/: the open ones, posting, withdrawing, claiming and answering a claim.

Campaign members only (CampaignScopedView, so an archived campaign takes no writes); who may do what to a bounty is
the services' object check: only its poster withdraws it, and each side of a claim answers its own part. Each write
runs in one transaction under the bounty's row lock; its events go out after commit (services/notices.py). Writes
answer the bounty, plus `warnings` when there are any (events never carry them).
"""

from typing import Any

from django.db import transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.campaigns.views.base import CampaignScopedView
from apps.core.throttling import TRADE_WRITE_THROTTLE_CLASSES, MethodScopedThrottleMixin

from .candidates import claimable_units, his_battles, suggestions
from .payloads import bounty_payload
from .selectors import bounty_targets, live_bounties, locked_bounty, viewer_warband, warband_ref
from .services import notices
from .services.claims import accept_part, claim_bounty, decline, locked_claim, side_of
from .services.payment import pay
from .services.posting import BountyWarning, own_warband, post_bounty, withdraw_bounty


def _answer(payload: dict[str, Any], warnings: list[BountyWarning], code: int = status.HTTP_200_OK) -> Response:
    return Response({**payload, "warnings": warnings} if warnings else payload, status=code)


class BountyWriteView(MethodScopedThrottleMixin, CampaignScopedView):
    rules = {"POST": "view"}  # any member; then the object rule in the service
    throttle_classes = TRADE_WRITE_THROTTLE_CLASSES


class CampaignBountiesView(BountyWriteView):
    """GET: the open bounties, newest first, and the reader's own warband (its gold). POST {hero_id, amount, note}:
    post one."""

    rules = {"GET": "view", "POST": "view"}

    def get(self, request: Request, campaign_id: int) -> Response:
        bounties = [bounty_payload(bounty) for bounty in live_bounties(campaign_id)]
        return Response({"bounties": bounties, "my_warband": warband_ref(viewer_warband(campaign_id, request.user))})

    def post(self, request: Request, campaign_id: int) -> Response:
        with transaction.atomic():
            bounty, warnings = post_bounty(campaign_id, request.user, request.data)
            payload = notices.announce(request, bounty)
        return _answer(payload, warnings, status.HTTP_201_CREATED)


class CampaignBountyTargetsView(CampaignScopedView):
    """GET: the heroes a bounty can be posted on, by warband (every warband's but the reader's)."""

    def get(self, request: Request, campaign_id: int) -> Response:
        return Response(bounty_targets(campaign_id, viewer_warband(campaign_id, request.user)))


class CampaignBountyWithdrawView(BountyWriteView):
    def post(self, request: Request, campaign_id: int, bounty_id: int) -> Response:
        with transaction.atomic():
            bounty = locked_bounty(campaign_id, bounty_id)
            closed = withdraw_bounty(bounty, request.user)
            payload = notices.announce(request, bounty)
            notices.claims_answered(closed, payload)
        return Response(payload)


class CampaignBountyCandidatesView(CampaignScopedView):
    """GET: what the reader can put to a claim: his kills and out-of-actions of the target since the bounty was posted,
    his units and his battles since then."""

    def get(self, request: Request, campaign_id: int, bounty_id: int) -> Response:
        bounty = live_bounties(campaign_id).filter(id=bounty_id).first()
        if bounty is None:
            return Response({"detail": "Not found", "code": "not_found"}, status=404)
        warband = own_warband(campaign_id, request.user, "to claim a bounty")
        return Response(
            {
                "candidates": suggestions(bounty, warband.id),
                "units": claimable_units(warband.id),
                "battles": his_battles(bounty, warband.id),
            }
        )


class CampaignBountyClaimsView(BountyWriteView):
    """POST {unit: {kind, id}, kill_id, battle_id}: claim the bounty (a kill alone names its killer and battle)."""

    def post(self, request: Request, campaign_id: int, bounty_id: int) -> Response:
        with transaction.atomic():
            bounty = locked_bounty(campaign_id, bounty_id)
            claim, warnings = claim_bounty(bounty, request.user, request.data)
            notices.claim_made(bounty, claim)
            payload = notices.announce(request, bounty)
        return _answer(payload, warnings, status.HTTP_201_CREATED)


class CampaignBountyClaimAcceptView(BountyWriteView):
    """POST: the caller accepts his part of the claim; when both sides have, the gold moves."""

    def post(self, request: Request, campaign_id: int, bounty_id: int, claim_id: int) -> Response:
        warnings: list[BountyWarning] = []
        with transaction.atomic():
            bounty = locked_bounty(campaign_id, bounty_id)
            claim = locked_claim(bounty, claim_id)
            if accept_part(bounty, claim, side_of(bounty, claim, request.user)):
                warnings, closed = pay(bounty, claim)
                payload = notices.announce(request, bounty)
                notices.claims_answered([claim, *closed], payload)
                notices.gold_moved(request, bounty, claim)
            else:
                payload = notices.announce(request, bounty)
        return _answer(payload, warnings)


class CampaignBountyClaimDeclineView(BountyWriteView):
    """POST: the poster declines the claim, or the claimant takes it back."""

    def post(self, request: Request, campaign_id: int, bounty_id: int, claim_id: int) -> Response:
        with transaction.atomic():
            bounty = locked_bounty(campaign_id, bounty_id)
            claim = locked_claim(bounty, claim_id)
            side = side_of(bounty, claim, request.user)
            decline(bounty, claim, side)
            payload = notices.announce(request, bounty)
            if side == "poster":
                notices.claims_answered([claim], payload)
            else:
                notices.claim_withdrawn(bounty, claim)
        return Response(payload)
