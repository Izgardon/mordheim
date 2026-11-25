"""The random scenario (William, 24 Nov 2026): a weighted draw on the server among the campaign's whole list, whoever
plays (William, 25 Nov 2026: "just dont disregard multiplayer"), weight 0 never drawn."""

import random
from collections import Counter
from decimal import Decimal

from apps.scenarios.models import CampaignScenario
from apps.scenarios.services.draw import draw

from .scenario_support import ScenarioTestCase


class DrawTests(ScenarioTestCase):
    def test_a_draw_follows_the_weights(self) -> None:
        CampaignScenario.objects.filter(campaign=self.campaign).exclude(scenario__slug__in=["skirmish", "occupy"]).update(weight=0)  # fmt: skip
        self.row("skirmish").__class__.objects.filter(pk=self.row("skirmish").pk).update(weight=Decimal(3))
        rng = random.Random(7)

        drawn = Counter(draw(self.campaign.id, rng).scenario.slug for _ in range(2000))  # type: ignore[union-attr]

        self.assertEqual(set(drawn), {"skirmish", "occupy"})  # weight 0 never comes up
        self.assertAlmostEqual(drawn["skirmish"] / 2000, 3 / 8, delta=0.04)  # skirmish 3 against occupy's 5

    def test_1v1_and_multiplayer_scenarios_are_both_drawn(self) -> None:
        CampaignScenario.objects.create(campaign=self.campaign, scenario=self.book("ambush-tc5"), weight=Decimal(9))
        rng = random.Random(1)
        drawn = {draw(self.campaign.id, rng).scenario.players for _ in range(200)}  # type: ignore[union-attr]
        self.assertLessEqual({"1v1", "multiplayer"}, drawn)

    def test_any_member_draws_and_the_answer_is_the_row(self) -> None:
        response = self.post_as(self.rival, self.url("scenarios/random/"), {})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn(response.json()["scenario"]["players"], {"1v1", "multiplayer", "either"})
        self.assertEqual(self.post_as(self.outsider, self.url("scenarios/random/"), {}).status_code, 404)

    def test_nothing_to_draw_is_a_400_in_the_servers_words(self) -> None:
        CampaignScenario.objects.filter(campaign=self.campaign).update(weight=0)
        refused = self.post_as(self.player, self.url("scenarios/random/"), {})
        self.assertEqual(
            (refused.status_code, refused.json()["code"], refused.json()["detail"]),
            (400, "nothing_to_draw", "No scenario on the campaign's list has a weight above 0."),
        )
