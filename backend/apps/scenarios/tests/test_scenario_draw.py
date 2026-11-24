"""The random scenario (William, 24 Nov 2026): a weighted draw on the server among the campaign's list, only the
scenarios that fit the battle (1v1 for two warbands, multiplayer for three or more), weight 0 never drawn."""

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

        drawn = Counter(draw(self.campaign.id, 2, rng).scenario.slug for _ in range(2000))  # type: ignore[union-attr]

        self.assertEqual(set(drawn), {"skirmish", "occupy"})  # weight 0 never comes up
        self.assertAlmostEqual(drawn["skirmish"] / 2000, 3 / 8, delta=0.04)  # skirmish 3 against occupy's 5

    def test_two_warbands_draw_a_1v1_scenario_and_three_a_multiplayer_one(self) -> None:
        rng = random.Random(1)
        two = {draw(self.campaign.id, 2, rng).scenario.players for _ in range(50)}  # type: ignore[union-attr]
        three = {draw(self.campaign.id, 3, rng).scenario.players for _ in range(50)}  # type: ignore[union-attr]
        self.assertEqual((two, three), ({"1v1"}, {"multiplayer"}))

    def test_any_member_draws_and_the_answer_is_the_row(self) -> None:
        response = self.post_as(self.rival, self.url("scenarios/random/"), {"players": 4})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.json()["scenario"]["players"], "multiplayer")
        self.assertEqual(self.post_as(self.outsider, self.url("scenarios/random/"), {"players": 2}).status_code, 404)
        self.assertEqual(self.post_as(self.player, self.url("scenarios/random/"), {"players": 1}).status_code, 400)

    def test_nothing_to_draw_is_a_400_in_the_servers_words(self) -> None:
        CampaignScenario.objects.filter(campaign=self.campaign, scenario__players="multiplayer").update(weight=0)
        refused = self.post_as(self.player, self.url("scenarios/random/"), {"players": 3})
        self.assertEqual(
            (refused.status_code, refused.json()["code"], refused.json()["detail"]),
            (
                400,
                "no_scenario_fits",
                "No scenario on the campaign's list is for three or more warbands with a weight above 0.",
            ),
        )
