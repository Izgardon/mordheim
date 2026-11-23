"""A preset's own wording of book skills (William, 23 Nov 2026, of the Marienburg Annual's errata Mighty Blow: "Can it
edit Mighty Blow for that campaign setting as if a human edited it").

A campaign taking the preset up gets its version of each skill, made exactly as a first edit in the campaign makes one
(`core.catalogue.versions.editable`): it stands in for the book skill everywhere in that campaign, shows as the
campaign's version, and Revert takes it back to the book's. A skill the campaign already has a version of is its own
and is left alone; a name we don't hold is passed over. Changing to another preset leaves a version where it is.
"""

from apps.core.catalogue.cache import bump
from apps.core.catalogue.kinds import SKILLS
from apps.core.catalogue.versions import editable
from apps.skills.models import Skill

from ..models import CampaignPreset


def apply_skill_wordings(campaign_id: int, preset: CampaignPreset | None) -> int:
    """Make the campaign's version of each skill the preset words its own way; how many were made."""
    made = 0
    for wording in (preset.skill_wordings if preset else None) or []:
        book = Skill.objects.filter(campaign=None, name__iexact=wording.get("skill", "")).first()
        if book is None or Skill.objects.filter(campaign_id=campaign_id, replaces=book).exists():
            continue
        version = editable(SKILLS, book, campaign_id)
        version.description = wording["description"]
        version.save(update_fields=["description"])
        made += 1
    if made:
        bump(campaign_id, "skills")
    return made
