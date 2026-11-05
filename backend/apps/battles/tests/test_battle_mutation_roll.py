"""The D100 serious injury result 100, Mutation (William, 5 Nov 2026): its own effect kind, a follow-up D66 on the
random mutation table kept on the roll and described by the server (the result's name, the special it gives, the *),
and at finalise the unit gains that special, as a rule-granting injury gives his, logged with the injury. A result he
has already, or no follow-up roll, never refuses the draft."""

from io import StringIO
from typing import Any

from django.core.management import call_command

from apps.battles.services.injuries import describe_roll
from apps.battles.services.postbattle.suggested import broadcast_rules, postbattle_rules
from apps.battles.services.random_mutations import describe_mutation, random_mutation_table
from apps.special.categories import MUTATION
from apps.special.models import Special
from apps.warbands.models import HeroSpecial, WarbandLog

from .battle_support import BattleTestCase, draft, unit_result

MUTATION_ROLL = {"roll_type": "d100", "rolls": [100], "result_label": "Mutation"}


def mutation(rolls: list[int] | None = None, **fields: Any) -> dict[str, Any]:
    return {**MUTATION_ROLL, **({"mutation": {"rolls": rolls, **fields}} if rolls else {})}


class MutationTableTests(BattleTestCase):
    def test_result_100_is_a_mutation_and_the_follow_up_names_the_special_it_gives(self):
        self.assertEqual(describe_roll("d100", [100])["effect"], {"kind": "mutation"})
        self.assertEqual(
            describe_mutation([1, 1]),
            {"rolls": [1, 1], "result_code": "11", "name": "Acid Spray", "special": "Spit Acid",
             "special_type": "Bounty of Arkhar"},
        )  # fmt: skip
        table = random_mutation_table()
        self.assertEqual([row["roll"] for row in table], [t * 10 + u for t in range(1, 7) for u in range(1, 7)])
        self.assertTrue(all(row["text"] for row in table))  # each special's wording

    def test_the_rules_carry_the_table_in_a_d100_campaign_and_never_in_a_broadcast(self):
        self.assertNotIn("random_mutations", postbattle_rules("d66"))
        rules = postbattle_rules("d100")
        self.assertEqual(len(rules["random_mutations"]), 36)
        self.assertNotIn("random_mutations", broadcast_rules(rules))


class MutationFinaliseTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.campaign_settings.hero_death_roll = "d100"
        self.campaign_settings.save()
        call_command("seed_spells_and_special", stdout=StringIO())
        self.heroes = [self.warband.heroes.create(name=name, unit_type="Mutant") for name in ("Ana", "Bea", "Cy")]
        self.keys = [f"hero:{hero.id}" for hero in self.heroes]
        self.rat = f"hero:{self.rival.heroes.create(name='Rat', unit_type='Assassin').id}"

    def test_the_follow_up_is_kept_as_the_server_reads_it_and_its_special_is_gained_at_ready(self):
        ana, bea, cy = self.keys
        fangs = Special.objects.get(name="Fangs", campaign=None)
        HeroSpecial.objects.create(hero=self.heroes[1], special=fangs)  # he has it already: warned, never refused
        rolls = {ana: [mutation([4, 4], name="Wrong")], bea: [mutation([3, 4])], cy: [mutation()]}
        results = {key: unit_result(key, rolls=rolls[key], name=key) for key in self.keys}
        battle_id = self.to_postbattle({self.player: self.keys, self.viewer: [self.rat]})

        saved = self.ok(
            self.post_as(self.player, self.url(battle_id, "postbattle"), {"postbattle_json": draft(results)})
        )
        stored = saved.data["participants"][0]["postbattle_json"]["unit_results"]
        kept = stored[ana]["serious_injury_rolls"][-1]
        self.assertEqual(kept["effect"], {"kind": "mutation"})
        self.assertEqual(
            kept["mutation"],
            {"rolls": [4, 4], "result_code": "44", "name": "Mace Tail", "special": "Spiked Tail",
             "special_type": "Bounty of Arkhar"},
        )  # fmt: skip
        self.assertNotIn("mutation", stored[cy]["serious_injury_rolls"][-1])

        self.ok(self.finalize(self.player, battle_id, draft(results)))

        held = sorted(HeroSpecial.objects.values_list("hero__name", "special__name"))
        self.assertEqual(held, [("Ana", "Spiked Tail"), ("Bea", "Fangs")])  # Bea's once; Cy rolled no follow-up
        spiked = Special.objects.get(name="Spiked Tail")
        self.assertEqual((spiked.campaign_id, spiked.type, spiked.category), (None, "Bounty of Arkhar", MUTATION))
        logs = {log.payload["unit_name"]: log.payload for log in WarbandLog.objects.filter(entry_type="serious_injury")}
        self.assertEqual((logs[ana]["applied"], logs[ana]["apply_by_hand"]), (True, False))
        self.assertEqual(
            logs[ana]["mutation"],
            {"rolls": [4, 4], "result_code": "44", "name": "Mace Tail", "special": "Spiked Tail"},
        )
        self.assertEqual((logs[cy]["applied"], logs[cy]["apply_by_hand"]), (False, True))

    def test_a_follow_up_on_another_result_is_dropped_and_its_dice_are_a_d66s(self):
        ana = self.keys[0]
        battle_id = self.to_postbattle({self.player: [ana], self.viewer: [self.rat]})
        chest = {"roll_type": "d100", "rolls": [30], "result_label": "Chest Wound", "mutation": {"rolls": [1, 1]}}
        url = self.url(battle_id, "postbattle")

        def kept(rolls: list[dict[str, Any]]) -> Any:
            saved = self.ok(self.post_as(self.player, url, {"postbattle_json": draft({ana: unit_result(ana, rolls=rolls)})}))  # fmt: skip
            return saved.data["participants"][0]["postbattle_json"]["unit_results"][ana]["serious_injury_rolls"][-1]

        self.assertNotIn("mutation", kept([chest]))
        self.assertEqual(
            kept([mutation([7, 1])])["mutation"]["result_code"], "61"
        )  # a face held to a D6's, as rolls are
        one = draft({ana: unit_result(ana, rolls=[mutation([3])])})
        self.assertEqual(self.post_as(self.player, url, {"postbattle_json": one}).status_code, 400)
