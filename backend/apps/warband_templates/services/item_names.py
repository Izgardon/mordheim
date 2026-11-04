"""The list's own name for an item (the templates plan, question 12): a unit recruited from the template whose lists
name an item another way shows it so on his card and in the Edit form ("Jambiya (Dagger)"). Read from the warband's
template when the sheet is read, never stored on the unit or the item, so a later template edit shows at once."""

from apps.warbands.models import Warband

from ..models import TemplateListItem
from .resolve import template_id_for


def template_item_names(warband: Warband) -> dict[str, dict[str, str]]:
    """Fighter key -> item id -> the name his lists give it, where they give it one other name (one query). A fighter
    whose lists name an item two ways (the Mace and the Hammer of "Club, Mace or Hammer") gets neither."""
    if warband.warband_type_id is None:
        return {}
    rows = (
        TemplateListItem.objects.filter(equipment_list__template_id=template_id_for(warband))
        .exclude(shown_as="")
        .values_list("equipment_list__fighter_links__fighter__key", "item_id", "shown_as")
    )
    found: dict[str, dict[int, set[str]]] = {}
    for key, item_id, shown_as in rows:
        if key:
            found.setdefault(key, {}).setdefault(item_id, set()).add(shown_as)
    return {
        key: {str(item_id): next(iter(names)) for item_id, names in items.items() if len(names) == 1}
        for key, items in found.items()
    }
