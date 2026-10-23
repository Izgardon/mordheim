"""A hireling is a hired sword or a dramatis persona (the bestiary rewrite step 2).

The unit says which (`kind`), which serious-injury table it rolls on (`injury_table`: henchman for hired swords, hero
for dramatis personae, editable for house rules), how long it stays (`stays`) and what it is paid in
(`payment_note`). A new hireling is a hired sword on the henchman table who stays. The hired-sword cap counts hired
swords only: a dramatis persona is added past it and never counts towards it, while its rating counts like a hired
sword's.
"""

from .roster_support import HIRELING, RosterTestCase, create_payload, make_unit, unit_url

DEFAULTS = {"kind": "hired_sword", "injury_table": "henchman", "stays": "always", "payment_note": ""}


class HirelingKindTests(RosterTestCase):
    def summary(self) -> dict:
        body: dict = self.client.get(f"/api/warbands/{self.warband.id}/summary/").json()
        return body

    def test_a_new_hireling_is_a_hired_sword_on_the_henchman_table_who_stays(self):
        response = self.client.post(unit_url(HIRELING, self.warband.id), create_payload(HIRELING), format="json")
        listed = self.client.get(unit_url(HIRELING, self.warband.id)).json()

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual({key: response.data[key] for key in DEFAULTS}, DEFAULTS)
        self.assertEqual({key: listed[0][key] for key in DEFAULTS}, DEFAULTS)

    def test_a_hand_typed_dramatis_persona_keeps_what_it_was_sent_and_a_house_rule_may_change_its_table(self):
        sent = {"kind": "dramatis_persona", "injury_table": "hero", "stays": "one_battle", "payment_note": "a favour"}
        created = self.client.post(
            unit_url(HIRELING, self.warband.id), {**create_payload(HIRELING), **sent}, format="json"
        )
        url = unit_url(HIRELING, self.warband.id, created.data["id"])

        edited = self.client.patch(url, {"injury_table": "henchman"}, format="json")

        self.assertEqual({key: created.data[key] for key in sent}, sent)
        self.assertEqual((edited.status_code, edited.data["injury_table"]), (200, "henchman"))

    def test_an_unknown_kind_table_or_stay_is_refused(self):
        hireling = make_unit(HIRELING, self.warband)
        url = unit_url(HIRELING, self.warband.id, hireling.id)
        for field in ("kind", "injury_table", "stays"):
            with self.subTest(field=field):
                response = self.client.patch(url, {field: "forever"}, format="json")
                self.assertEqual((response.status_code, list(response.data)), (400, [field]))

    def test_a_dramatis_persona_is_added_past_the_hired_sword_cap_and_never_counts_towards_it(self):
        self.campaign_settings.max_hired_swords = 1
        self.campaign_settings.save()
        url = unit_url(HIRELING, self.warband.id)
        self.assertEqual(self.client.post(url, create_payload(HIRELING, rating=10), format="json").status_code, 201)
        rating_with_one = self.summary()["rating"]

        persona = self.client.post(
            url, {**create_payload(HIRELING, rating=12), "kind": "dramatis_persona"}, format="json"
        )
        refused = self.client.post(url, create_payload(HIRELING), format="json")

        summary = self.summary()
        self.assertEqual((persona.status_code, refused.json()["code"]), (201, "hired_sword_cap_reached"))
        self.assertEqual((summary["hireling_count"], summary["max_hired_swords"]), (1, 1))
        self.assertEqual(len(summary["hirelings"]), 2)
        self.assertEqual(summary["rating"], rating_with_one + 12)  # its rating counts like a hired sword's
