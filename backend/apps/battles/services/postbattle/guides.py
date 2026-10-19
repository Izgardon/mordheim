"""What a player needs to start his postbattle, sent with the write that puts him there (item 8).

The write that ends a player's fight (`finish-mine/`, a manager's End) or changes the winners (`results/`) answers
the acting player's `suggested_postbattle` and `rules`, and its broadcast carries every player's suggestions who is
in his own postbattle (finished his battle, not finalised yet), so no postbattle page needs an extra read (the
frontend showed 0 exploration dice when it came straight from End battle).
"""

from dataclasses import dataclass

from apps.campaigns.models import CampaignSettings

from ...models import Battle, BattleParticipant
from .suggested import rules_for, suggestions_for


def settings_of(battle: Battle) -> CampaignSettings | None:
    if Battle.campaign.is_cached(battle):  # read with the battle (BattleScopedView.battle_related)
        return getattr(battle.campaign, "settings", None)
    return CampaignSettings.objects.filter(campaign_id=battle.campaign_id).first()


@dataclass
class Guides:
    rules: dict
    suggested: dict[int, dict]  # by user id

    def answer_for(self, user_id: int) -> dict:
        """The keys `state/?view=postbattle` has, for the acting player (nothing when he isn't in postbattle)."""
        if user_id not in self.suggested:
            return {}
        return {"suggested_postbattle": self.suggested[user_id], "rules": self.rules}

    def broadcast(self) -> dict | None:
        if not self.suggested:
            return None
        return {"rules": self.rules, "suggested": {str(user_id): entry for user_id, entry in self.suggested.items()}}


def postbattle_guides(battle: Battle, *, user_id: int | None = None) -> Guides:
    """For every player in his own postbattle (or only `user_id`): those players with their battle rosters, the live
    kill events and their units' XP (up to five reads; the campaign's settings come with the battle when the view
    reads them with it, else one more)."""
    settings = settings_of(battle)
    players = BattleParticipant.objects.filter(battle_id=battle.id, status=BattleParticipant.STATUS_FINISHED_BATTLE)
    if user_id is not None:
        players = players.filter(user_id=user_id)
    return Guides(rules_for(settings), suggestions_for(battle, list(players.order_by("id")), settings))
