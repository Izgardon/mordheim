"""The bounties' shared fixture: the campaign of `CampaignTestCase` with a hero or two in each warband, and a third and
fourth warband to claim with.

Pia ("Monks", Abbess) posts; Rex ("Rats", Grey Seer and Skrit) is the target's owner; Ada ("Crows", Kreech, and the
Night Runners) and Olga ("Ravens", Hawk) claim. Every warband starts with the campaign's 500 gc. Realtime sends are
recorded, never made.
"""

from datetime import UTC, datetime
from typing import Any
from unittest import mock

from apps.battles.models import Battle, BattleEvent, BattleKill, BattleParticipant
from apps.campaigns.tests.campaign_support import CampaignTestCase
from apps.warbands.models import HenchmenGroup, Hero, Warband

from ..models import Bounty, BountyClaim

NOTICES = "apps.bounties.services.notices"


class BountyTestCase(CampaignTestCase):
    abbess: Hero
    seer: Hero
    skrit: Hero
    kreech: Hero
    hawk: Hero
    runners: HenchmenGroup
    crows: Warband
    ravens: Warband

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        client = cls.client_class()
        cls.crows = cls._create_warband(client, cls.admin, "Crows")
        cls.ravens = cls._create_warband(client, cls.owner, "Ravens")
        cls.abbess = Hero.objects.create(warband=cls.warband, name="Abbess", unit_type="Matriarch", is_leader=True)
        cls.seer = Hero.objects.create(warband=cls.rival_warband, name="Grey Seer", unit_type="Seer", is_leader=True)
        cls.skrit = Hero.objects.create(warband=cls.rival_warband, name="Skrit", unit_type="Assassin")
        cls.kreech = Hero.objects.create(warband=cls.crows, name="Kreech", unit_type="Assassin Adept")
        cls.runners = HenchmenGroup.objects.create(warband=cls.crows, name="Night Runners", unit_type="Night Runner")
        cls.hawk = Hero.objects.create(warband=cls.ravens, name="Hawk", unit_type="Captain", is_leader=True)

    def setUp(self) -> None:
        super().setUp()
        self.user_events = self._patch("send_user_notification")
        self.bounty_events = self._patch("send_bounty_changed")
        self.warband_events = self._patch("send_warband_changed")

    def _patch(self, name: str) -> mock.MagicMock:
        patcher = mock.patch(f"{NOTICES}.{name}")
        self.addCleanup(patcher.stop)
        return patcher.start()

    # requests

    def bounties_url(self, suffix: str = "") -> str:
        return self.url(f"bounties/{suffix}")

    def post_bounty(self, user: Any = None, hero: Hero | None = None, amount: Any = 40, note: str = "") -> Any:
        body = {"hero_id": (hero or self.seer).id, "amount": amount, "note": note}
        return self.post_as(user or self.player, self.bounties_url(), body)

    def posted(self, **kwargs: Any) -> Bounty:
        response = self.post_bounty(**kwargs)
        self.assertEqual(response.status_code, 201, response.content)
        return Bounty.objects.get(id=response.json()["id"])

    def claim(self, user: Any, bounty: Bounty, body: dict[str, Any] | None = None) -> Any:
        body = body if body is not None else {"unit": {"kind": "hero", "id": self.kreech.id}}
        return self.post_as(user, self.bounties_url(f"{bounty.id}/claims/"), body)

    def claimed(self, user: Any, bounty: Bounty, body: dict[str, Any] | None = None) -> BountyClaim:
        response = self.claim(user, bounty, body)
        self.assertEqual(response.status_code, 201, response.content)
        return BountyClaim.objects.filter(bounty=bounty).latest("id")

    def answer(self, user: Any, claim: BountyClaim, verb: str) -> Any:
        return self.post_as(user, self.bounties_url(f"{claim.bounty_id}/claims/{claim.id}/{verb}/"))

    def withdraw(self, user: Any, bounty: Bounty) -> Any:
        return self.post_as(user, self.bounties_url(f"{bounty.id}/withdraw/"))

    def gold(self, warband: Warband) -> int:
        return Warband.objects.get(id=warband.id).gold

    def user_event_types(self) -> list[tuple[int, str]]:
        return [(call.args[0], call.args[1]) for call in self.user_events.call_args_list]

    # battles

    def battle(self, *warbands: Warband, status: str = Battle.STATUS_ENDED, ooa: Hero | None = None) -> Battle:
        """An ended battle between the warbands; `ooa` ends it out of action."""
        battle = Battle.objects.create(
            campaign=self.campaign,
            created_by_user=warbands[0].user,
            scenario="Street Fight",
            status=status,
            ended_at=datetime(2030, 1, 1, tzinfo=UTC) if status == Battle.STATUS_ENDED else None,
        )
        for warband in warbands:
            info = {f"hero:{ooa.id}": {"out_of_action": True}} if ooa and ooa.warband_id == warband.id else {}
            BattleParticipant.objects.create(
                battle=battle, user=warband.user, warband=warband, unit_information_json=info
            )
        return battle

    def kill(self, battle: Battle, killer: Hero, victim: Hero, *, voided: bool = False, round: int = 2) -> BattleKill:
        voided_at = datetime(2030, 1, 1, tzinfo=UTC) if voided else None
        event = BattleEvent.objects.create(
            battle=battle, type=BattleEvent.TYPE_UNIT_KILL_RECORDED, payload_json={}, voided_at=voided_at
        )
        return BattleKill.objects.create(
            battle=battle,
            campaign_id=battle.campaign_id,
            event=event,
            phase="fight",
            round=round,
            how="shooting",
            voided_at=voided_at,
            killer_warband_id=killer.warband_id,
            killer_kind="hero",
            killer_hero=killer,
            killer_name=killer.name,
            victim_kind="hero",
            victim_warband_id=victim.warband_id,
            victim_hero=victim,
            victim_name=victim.name,
        )
