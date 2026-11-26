"""A workshop warband made with no list (William, 26 Nov 2026: "You should be able to make a warband without using a
list in workshop"): its type picked all the same, a budget and most warriors of its own, no template read at all (its
type's book list never stands in), every unit made by hand, the store's general catalogue, its cost against its
budget, and Settings changing its budget and type while it stays without a list."""

from typing import Any

from apps.core.testing import book_warband_type
from apps.warband_templates.services.resolve import list_item_ids, template_for_warband, templates_for_warbands
from apps.warbands.models import Hero, Warband
from apps.warbands.services.purchases import OVER_BUDGET

from .support import KIT_COST, WorkshopTestCase, kit_out
from .test_workshops import LIST_QUERIES


class NoListTestCase(WorkshopTestCase):
    def make_listless(self, user: Any = None, **body: Any) -> Any:
        return self.make_warband(user, no_list=True, **body)


class MakingTests(NoListTestCase):
    def test_a_warband_with_no_list_reads_none_on_its_budget_and_most_warriors(self) -> None:
        row = self.make_listless()
        picked = ("kind", "template_id", "cost", "budget", "warnings")
        self.assertEqual(
            {key: row[key] for key in picked},
            {"kind": "warband", "template_id": None, "cost": 0, "budget": 500, "warnings": []},
        )
        self.assertEqual(row["warband_type"], {"id": self.mercenaries.id, "name": "Mercenaries"})
        warband = self.warband_of(row)
        self.assertEqual(
            (warband.no_list, warband.budget, warband.max_units, warband.template_variant, warband.gold),
            (True, 500, 15, "", 500),
        )
        self.assertFalse(warband.rules.exists())  # the book list's rules never come
        own = self.make_listless(name="Lean", budget=300, max_units=10, template_variant="reikland")
        warband = self.warband_of(own)
        self.assertEqual((own["budget"], warband.max_units, warband.template_variant), (300, 10, ""))

    def test_a_warband_with_no_list_still_takes_a_type_and_names_no_list(self) -> None:
        url = "/api/workshop/warbands/"
        untyped = self.post_as(self.player, url, {"name": "X", "no_list": True})
        self.assertEqual(
            (untyped.status_code, untyped.json()["fields"]), (400, {"warband_type_id": ["Pick a warband type."]})
        )
        listed = self.make_list(name="Caravans A", copy_of_template_id=self.made.template.id)
        both = {"name": "X", "no_list": True, "list_id": listed["id"], "warband_type_id": self.mercenaries.id}
        refused = self.post_as(self.player, url, both)
        self.assertEqual(refused.status_code, 400)
        self.assertEqual(list(refused.data), ["no_list"])
        budget = self.post_as(self.player, url, {"name": "X", "warband_type_id": self.mercenaries.id, "budget": 300})
        self.assertEqual((budget.status_code, list(budget.data)), (400, ["budget"]))
        self.assertFalse(Warband.objects.filter(name="X").exists())


class ReadingTests(NoListTestCase):
    def test_no_template_is_read_for_it_whatever_its_type(self) -> None:
        row = self.make_listless()
        warband = self.warband_of(row)
        self.assertIsNone(template_for_warband(warband))
        self.assertEqual(templates_for_warbands([warband]), {warband.pk: None})
        self.assertEqual(list_item_ids(warband), frozenset())  # the store sells from the general catalogue
        body = self.get_as(self.player, f"/api/warbands/{row['id']}/template/").data
        self.assertEqual(
            {key: body[key] for key in ("template", "variant", "missing_rules", "no_list")},
            {"template": None, "variant": "", "missing_rules": 0, "no_list": True},
        )
        sheet = self.get_as(self.player, f"/api/warbands/{row['id']}/sheet/").data
        self.assertEqual(
            sheet["workshop"], {"cost": 0, "budget": 500, "share_code": row["share_code"], "no_list": True}
        )
        listed = self.make_warband(name="Listed", template_variant="reikland")
        self.assertFalse(self.get_as(self.player, f"/api/warbands/{listed['id']}/sheet/").data["workshop"]["no_list"])

    def test_my_workshop_reads_in_the_same_queries_with_warbands_of_no_list(self) -> None:
        self.make_warband()
        self.make_listless(name="No list 0")
        self.make_list()
        self.client.force_authenticate(user=self.player)
        with self.assertNumQueries(LIST_QUERIES):
            rows = self.client.get("/api/workshop/").data["warbands"]
        self.assertEqual([row["budget"] for row in rows], [500, 500])
        for index in range(1, 4):
            self.make_listless(name=f"No list {index}", budget=100 * index)
        self.client.force_authenticate(user=self.player)
        with self.assertNumQueries(LIST_QUERIES):
            rows = self.client.get("/api/workshop/").data["warbands"]
        self.assertEqual([row["budget"] for row in rows], [300, 200, 100, 500, 500])
        self.assertEqual([row["no_list"] for row in rows], [True, True, True, True, False])  # Home's card says so


class RecruitingTests(NoListTestCase):
    def test_units_are_made_by_hand_and_a_fighter_of_its_types_list_is_refused(self) -> None:
        row = self.make_listless()
        url = f"/api/warbands/{row['id']}/heroes/batch/"
        typed = {"name": "Grim", "unit_type": "Captain", "price": 70}
        made = self.post_as(self.player, url, {"create": [typed]})
        self.assertEqual(made.status_code, 200, made.data)
        hero = Hero.objects.get(warband_id=row["id"], name="Grim")
        self.assertEqual((hero.fighter_key, hero.price), ("", 70))
        keyed = self.post_as(self.player, url, {"create": [{"fighter_key": "captain", "name": "X"}]})
        self.assertEqual(keyed.status_code, 400)
        self.assertIn("create.0.fighter_key", keyed.json()["fields"])
        sheet = self.get_as(self.player, f"/api/warbands/{row['id']}/sheet/").data
        self.assertEqual((sheet["workshop"]["cost"], sheet["item_names"]), (70, {}))


class CostTests(NoListTestCase):
    def test_its_cost_is_against_its_own_budget(self) -> None:
        row = self.make_listless(budget=300)
        kit_out(
            self.warband_of(row),
            human=self.human,
            axe=self.book_axe,
            sword=self.book_sword,
            skill=self.infiltration[0],
            special=self.large,
            spell=self.lifestealer[0],
        )
        body = {"item_id": self.heavy_armour.id, "target_type": "stash", "quantity": 2, "price": 50}
        response = self.post_as(self.player, f"/api/warbands/{row['id']}/purchases/", body)
        self.assertEqual(response.status_code, 201, response.data)
        warning = next(found for found in response.data["warnings"] if found["code"] == OVER_BUDGET)
        self.assertEqual((warning["cost"], warning["budget"]), (KIT_COST + 100, 300))
        self.assertEqual(response.data["summary"]["workshop"], {"cost": KIT_COST + 100, "budget": 300})


class SettingsTests(NoListTestCase):
    def test_settings_change_its_budget_and_type_and_it_stays_without_a_list(self) -> None:
        row = self.make_listless()
        url = f"/api/warbands/{row['id']}/"
        changed = self.patch_as(self.player, url, {"name": "Renamed", "budget": 800, "max_units": 12})
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(self.get_as(self.player, f"{url}summary/").data["workshop"], {"cost": 0, "budget": 800})
        outlaws = book_warband_type("Outlaws")
        for type_id in (outlaws.id, self.mercenaries.id):  # back to a type the book has a list for: still none
            moved = self.patch_as(self.player, url, {"warband_type_id": type_id})
            self.assertEqual(moved.status_code, 200, moved.data)
            self.assertEqual(moved.data["rules_changed"]["words"], [])
            warband = self.warband_of(row)
            self.assertEqual((warband.warband_type_id, warband.template_id, warband.budget), (type_id, None, 800))
            self.assertFalse(warband.rules.exists())
        self.assertIsNone(self.get_as(self.player, f"{url}template/").data["template"])
        variant = self.patch_as(self.player, url, {"template_variant": "reikland"})
        self.assertEqual((variant.status_code, list(variant.data)), (400, ["template_variant"]))

    def test_only_a_warband_with_no_list_sets_its_budget(self) -> None:
        listed = self.make_warband(template_variant="reikland")
        refused = self.patch_as(self.player, f"/api/warbands/{listed['id']}/", {"budget": 800})
        self.assertEqual(refused.status_code, 400)
        self.assertEqual(
            refused.data["budget"],
            ["Only a warband with no list sets its own budget: a list's gold is its budget."],
        )
        in_campaign = self.patch_as(self.player, f"/api/warbands/{self.warband.id}/", {"budget": 800})
        self.assertEqual(in_campaign.status_code, 400)
        row = self.make_listless()
        negative = self.patch_as(self.player, f"/api/warbands/{row['id']}/", {"budget": -1})
        self.assertEqual(negative.status_code, 400)


class CopyingTests(NoListTestCase):
    def test_a_copy_into_a_workshop_keeps_no_list_and_its_budget_and_into_a_campaign_reads_its_types(self) -> None:
        row = self.make_listless(budget=350)
        copy = self.post_as(self.rival, "/api/workshop/import/", {"code": row["share_code"]})
        self.assertEqual(copy.status_code, 201, copy.data)
        self.assertEqual((copy.data["template_id"], copy.data["budget"]), (None, 350))
        copied = self.warband_of(copy.data)
        self.assertEqual((copied.no_list, copied.gold), (True, 350))
        Warband.objects.filter(campaign=self.elsewhere, user=self.outsider).delete()
        imported = self.post_as(
            self.outsider, f"/api/campaigns/{self.elsewhere.id}/warbands/import/", {"code": row["share_code"]}
        )
        self.assertEqual(imported.status_code, 201, imported.data)
        in_campaign = Warband.objects.get(pk=imported.data["warband_id"])
        self.assertEqual((in_campaign.budget, in_campaign.template_id), (None, None))
        self.assertEqual(template_for_warband(in_campaign), self.made.template)  # a campaign's reads its type's
