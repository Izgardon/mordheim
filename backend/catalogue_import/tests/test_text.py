from django.test import SimpleTestCase

from catalogue_import.text import clean_inline, clean_text, same_text


class CleanTextTests(SimpleTestCase):
    def test_tooltips_lose_their_wrapper_and_faq_markers_vanish(self) -> None:
        raw = 'Roll as for <Tooltip>Black Lotus</Tooltip>.<sup><Tooltip content="faq29">❓</Tooltip></sup> Done.'
        self.assertEqual(clean_inline(raw), "Roll as for Black Lotus. Done.")

    def test_breaks_become_newlines_and_inline_tags_go(self) -> None:
        raw = "First <em>stunned</em> line.<br /><br />Second <strong>line</strong> &amp; more"
        self.assertEqual(clean_inline(raw), "First stunned line.\n\nSecond line & more")

    def test_admonition_heading_is_dropped(self) -> None:
        raw = '<div class="admonition"><div class="admonition-heading"><h5>Note</h5></div><div><p>It is suggested.</p></div></div>'
        self.assertEqual(clean_inline(raw), "It is suggested.")

    def test_a_table_becomes_rows_and_leaves_a_marker(self) -> None:
        raw = (
            "Roll a D6:<table><thead><tr><th>D6</th><th>Result</th></tr></thead>"
            "<tbody><tr><td>1-2</td><td>Runner</td></tr><tr><td>6</td><td>Passenger<br />hit</td></tr></tbody></table>After."
        )
        text, tables = clean_text(raw)
        self.assertEqual(text, "Roll a D6:\n\n{{table:1}}\n\nAfter.")
        self.assertEqual(tables, [{"columns": ["D6", "Result"], "rows": [["1-2", "Runner"], ["6", "Passenger\nhit"]]}])

    def test_empty_input_is_empty(self) -> None:
        self.assertEqual(clean_text(None), ("", []))
        self.assertEqual(clean_inline(""), "")

    def test_same_text_ignores_spacing_and_case_only(self) -> None:
        self.assertTrue(same_text("A  warrior\nparries", "a warrior parries"))
        self.assertFalse(same_text("A warrior parries", "A rapier parries"))
