"""A campaign's encampments (William, 24 Nov 2026): groups of places a warband holds, written by `manage_encampments`
holders, taken by any warband whoever holds them (a warning names the scenario the book has you play first), razed or
given up by the holder's player or a manager, each change logged on the warbands it touched."""

from typing import Any
from unittest import mock

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.campaigns.models import CampaignEncampment, CampaignEncampmentGroup, CampaignRule
from apps.warbands.models import WarbandLog

from .campaign_support import CampaignTestCase

VIEWS = "apps.campaigns.views.encampments"


class EncampmentTestCase(CampaignTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enable_features()
        self.group = CampaignEncampmentGroup.objects.create(campaign=self.campaign, name="Marienburg city")
        self.tavern = self.camp("Tavern")
        self.events = self.patched("send_encampments_changed")
        self.warband_events = self.patched("send_warband_changed")

    def patched(self, name: str) -> mock.MagicMock:
        patcher = mock.patch(f"{VIEWS}.{name}")
        self.addCleanup(patcher.stop)
        return patcher.start()

    def camp(self, name: str, **fields: Any) -> CampaignEncampment:
        return CampaignEncampment.objects.create(campaign=self.campaign, group=self.group, name=name, **fields)

    def act(self, user: Any, action: str, camp: CampaignEncampment | None = None, **body: Any) -> Any:
        return self.post_as(user, self.url(f"encampments/{(camp or self.tavern).id}/{action}/"), body)

    def take(self, user: Any, warband: Any, camp: CampaignEncampment | None = None) -> Any:
        return self.act(user, "take", camp, warband_id=warband.id)

    def logs(self, warband: Any) -> list[tuple[str, str]]:
        rows = WarbandLog.objects.filter(warband=warband, feature="encampment").order_by("id")
        return [(row.entry_type, row.payload["message"]) for row in rows]

    def listed(self, user: Any = None) -> dict[str, Any]:
        response = self.get_as(user or self.player, self.url("encampment-groups/"))
        self.assertEqual(response.status_code, 200)
        data: dict[str, Any] = response.json()
        return data


class EncampmentListTests(EncampmentTestCase):
    def test_the_list_is_the_rules_the_groups_and_the_warbands_he_may_take_one_for(self):
        CampaignRule.objects.create(campaign=self.campaign, kind="encampment", title="Encampments", body="Hold them.")
        CampaignRule.objects.create(campaign=self.campaign, title="Plots")
        self.camp("Old Fort", fortified=True, gained_by="Exploration 11111", holder=self.rival_warband)

        data = self.listed()

        self.assertEqual([rule["title"] for rule in data["rules"]], ["Encampments"])
        self.assertEqual(data["takers"], [{"id": self.warband.id, "name": "Monks", "mine": True}])
        [group] = data["groups"]
        self.assertEqual(group["name"], "Marienburg city")
        tavern, fort = group["encampments"]
        self.assertEqual(
            (tavern["holder"], tavern["capabilities"]), (None, {"take": True, "raze": False, "give_up": False})
        )
        self.assertEqual(
            {key: fort[key] for key in ("name", "gained_by", "fortified", "holder", "razed")},
            {
                "name": "Old Fort",
                "gained_by": "Exploration 11111",
                "fortified": True,
                "holder": {"id": self.rival_warband.id, "name": "Rats", "player": "Rex"},
                "razed": False,
            },
        )
        self.assertEqual(fort["capabilities"], {"take": True, "raze": False, "give_up": False})
        # his only warband holds it already: nothing to take it for
        rival = self.listed(self.rival)["groups"][0]["encampments"][1]["capabilities"]
        self.assertEqual(rival, {"take": False, "raze": True, "give_up": True})

    def test_a_manager_may_take_one_for_every_warband_his_own_first(self):
        self.grant(self.rival, "manage_encampments")

        takers = self.listed(self.rival)["takers"]

        self.assertEqual(
            takers,
            [
                {"id": self.rival_warband.id, "name": "Rats", "mine": True},
                {"id": self.warband.id, "name": "Monks", "mine": False},
            ],
        )

    def test_the_list_does_not_grow_with_rows(self):
        CampaignRule.objects.create(campaign=self.campaign, kind="encampment", title="Encampments")
        self.client.force_authenticate(user=self.player)
        with CaptureQueriesContext(connection) as few:
            self.client.get(self.url("encampment-groups/"))
        for index in range(4):
            group = CampaignEncampmentGroup.objects.create(campaign=self.campaign, name=f"Ward {index}")
            CampaignEncampment.objects.create(campaign=self.campaign, group=group, name=f"Tower {index}")
            self.camp(f"Camp {index}", holder=self.rival_warband)
            CampaignRule.objects.create(campaign=self.campaign, kind="encampment", title=f"Rule {index}")

        with self.assertNumQueries(len(few)):
            self.client.get(self.url("encampment-groups/"))

    def test_the_rules_page_leaves_out_the_encampment_rules_and_each_list_orders_alone(self):
        first = CampaignRule.objects.create(campaign=self.campaign, title="Plots", order=0)
        holding = CampaignRule.objects.create(campaign=self.campaign, kind="encampment", title="Holding", order=1)
        razing = CampaignRule.objects.create(campaign=self.campaign, kind="encampment", title="Razing", order=2)

        page = self.get_as(self.player, self.url("campaign-rules/")).json()
        self.assertEqual([rule["title"] for rule in page], ["Plots"])
        order = self.url("campaign-rules/order/")
        self.assertEqual(self.put_as(self.owner, order, {"ids": [first.id]}).status_code, 200)
        moved = self.put_as(self.owner, order, {"ids": [razing.id, holding.id], "kind": "encampment"})
        self.assertEqual([rule["title"] for rule in moved.json()], ["Razing", "Holding"])
        self.assertEqual(self.put_as(self.owner, order, {"ids": [razing.id, holding.id]}).status_code, 400)
        self.assertEqual([rule["title"] for rule in self.listed()["rules"]], ["Razing", "Holding"])


class EncampmentWriteTests(EncampmentTestCase):
    def test_a_manager_writes_groups_and_encampments_and_a_removed_group_takes_them_with_it(self):
        group = self.post_as(self.owner, self.url("encampment-groups/"), {"name": "Outside the city"}).json()
        body = {"group_id": group["id"], "name": "Windmill", "gained_by": "Exploration 66", "text": "Flour."}
        made = self.post_as(self.owner, self.url("encampments/"), body)
        self.assertEqual(made.status_code, 201, made.content)
        self.assertEqual((made.json()["fortified"], made.json()["holder"]), (False, None))
        moved = self.patch_as(self.owner, self.url(f"encampments/{made.json()['id']}/"), {"group_id": self.group.id})
        self.assertEqual(moved.json()["group_id"], self.group.id)
        self.assertEqual(self.post_as(self.player, self.url("encampment-groups/"), {"name": "Mine"}).status_code, 403)

        self.assertEqual(self.delete_as(self.owner, self.url(f"encampment-groups/{self.group.id}/")).status_code, 204)

        self.assertEqual([g["name"] for g in self.listed()["groups"]], ["Outside the city"])
        self.assertTrue(CampaignEncampment.objects.get(name="Windmill").removed_at)
        self.assertTrue(self.events.called)

    def test_an_unknown_group_is_refused(self):
        response = self.post_as(self.owner, self.url("encampments/"), {"group_id": 999999, "name": "Windmill"})
        self.assertEqual((response.status_code, response.json()["code"]), (400, "encampment_group_unknown"))

    def test_a_patch_never_writes_who_holds_it(self):
        self.patch_as(
            self.owner, self.url(f"encampments/{self.tavern.id}/"), {"holder": self.warband.id, "razed": True}
        )
        self.tavern.refresh_from_db()
        self.assertEqual((self.tavern.holder_id, self.tavern.razed), (None, False))


class EncampmentHoldingTests(EncampmentTestCase):
    def test_taking_one_nobody_holds_logs_it_on_the_taker(self):
        response = self.take(self.player, self.warband)

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["warnings"], [])
        self.assertEqual(response.json()["encampment"]["holder"]["id"], self.warband.id)
        self.assertEqual(self.logs(self.warband), [("taken", "Took Tavern")])
        self.warband_events.assert_called_once_with(self.campaign.id, self.warband.id, None)
        sheet = self.get_as(self.player, f"/api/warbands/{self.warband.id}/sheet/").json()
        self.assertEqual(sheet["encampments"], [{"id": self.tavern.id, "name": "Tavern", "fortified": False}])

    def test_taking_one_another_holds_warns_of_the_scenario_and_changes_hands(self):
        fort = self.camp("Old Fort", fortified=True)
        for camp, scenario in ((self.tavern, "The Sting"), (fort, "Stockade")):
            camp.holder = self.rival_warband
            camp.save()
            with self.subTest(camp.name):
                response = self.take(self.player, self.warband, camp)

                [warning] = response.json()["warnings"]
                self.assertEqual(warning["code"], "encampment_taken_from")
                self.assertEqual(
                    warning["message"], f"Rats held {camp.name}: the book has you play {scenario} for it first."
                )
                camp.refresh_from_db()
                self.assertEqual(camp.holder_id, self.warband.id)
        self.assertEqual(
            self.logs(self.warband), [("taken", "Took Tavern from Rats"), ("taken", "Took Old Fort from Rats")]
        )
        self.assertEqual(
            self.logs(self.rival_warband), [("lost", "Lost Tavern to Monks"), ("lost", "Lost Old Fort to Monks")]
        )

    def test_taking_a_razed_one_warns_and_marks_it_standing(self):
        self.tavern.razed = True
        self.tavern.save()

        response = self.take(self.player, self.warband)

        self.assertEqual(
            response.json()["warnings"],
            [{"code": "encampment_razed", "message": "Tavern was razed: its rules say how it is rebuilt."}],
        )
        self.assertEqual(response.json()["encampment"]["razed"], False)

    def test_taking_one_he_holds_already_changes_nothing(self):
        self.take(self.player, self.warband)
        again = self.take(self.player, self.warband)
        self.assertEqual([w["code"] for w in again.json()["warnings"]], ["encampment_held_already"])
        self.assertEqual(len(self.logs(self.warband)), 1)

    def test_only_his_own_warband_unless_he_manages(self):
        self.assertEqual(self.take(self.player, self.rival_warband).status_code, 403)
        self.grant(self.player, "manage_encampments")
        self.assertEqual(self.take(self.player, self.rival_warband).status_code, 200)
        elsewhere = self.take(self.player, type("W", (), {"id": 999999})())
        self.assertEqual(elsewhere.status_code, 404)

    def test_razing_frees_it_and_logs_on_the_former_holder(self):
        self.take(self.rival, self.rival_warband)
        self.assertEqual(self.act(self.player, "raze").status_code, 403)

        response = self.act(self.rival, "raze")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            (response.json()["encampment"]["holder"], response.json()["encampment"]["razed"]), (None, True)
        )
        self.assertEqual(self.logs(self.rival_warband)[-1], ("razed", "Tavern was razed"))
        self.assertEqual(
            [w["code"] for w in self.act(self.owner, "raze").json()["warnings"]], ["encampment_razed_already"]
        )

    def test_giving_it_up_frees_it_and_logs_it(self):
        self.take(self.player, self.warband)
        self.assertEqual(self.act(self.rival, "give-up").status_code, 403)

        response = self.act(self.player, "give-up")

        self.assertEqual(response.json()["encampment"]["holder"], None)
        self.assertEqual(self.logs(self.warband)[-1], ("given_up", "Gave up Tavern"))
        self.assertEqual(
            [w["code"] for w in self.act(self.owner, "give-up").json()["warnings"]], ["encampment_not_held"]
        )

    def test_the_sheet_lists_nothing_while_the_page_is_off(self):
        self.take(self.player, self.warband)
        self.enable_features(encampments=False)
        sheet = self.get_as(self.player, f"/api/warbands/{self.warband.id}/sheet/").json()
        self.assertEqual(sheet["encampments"], [])
        self.assertEqual(self.take(self.player, self.warband).status_code, 404)

    def test_a_deleted_warband_leaves_it_held_by_nobody(self):
        self.take(self.player, self.warband)
        self.warband.delete()
        self.tavern.refresh_from_db()
        self.assertIsNone(self.tavern.holder_id)
