from typing import Any

from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models

DEFAULT_DICE_COLOR = "#2e8555"
HEX_COLOR_REGEX = r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$"
HEX_COLOR_VALIDATOR = RegexValidator(
    regex=HEX_COLOR_REGEX,
    message="Dice color must be a valid hex color (e.g. #2e8555).",
)


class Warband(models.Model):
    campaign = models.ForeignKey("campaigns.Campaign", related_name="warbands", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="warbands", on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    faction = models.CharField(max_length=80)
    dice_color = models.CharField(
        max_length=9,
        default=DEFAULT_DICE_COLOR,
        validators=[HEX_COLOR_VALIDATOR],
    )
    wins = models.PositiveSmallIntegerField(null=True, blank=True)
    losses = models.PositiveSmallIntegerField(null=True, blank=True)
    backstory = models.TextField(max_length=5000, null=True, blank=True)
    warband_link = models.URLField(max_length=500, null=True, blank=True)
    max_units = models.PositiveSmallIntegerField(default=15)  # warband size: warn only (decision 12)
    show_loadout_on_mobile = models.BooleanField(default=False)
    # The sum of the ledger, changed only by services/ledger.py in the same transaction as each row (decision 4).
    gold = models.BigIntegerField(default=0, db_default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    items: models.ManyToManyField = models.ManyToManyField(
        "items.Item",
        through="WarbandItem",
        related_name="warbands",
        blank=True,
    )
    restrictions = models.ManyToManyField(
        "restrictions.Restriction",
        related_name="warbands",
        blank=True,
    )

    class Meta:
        db_table = "warband"
        constraints = [models.UniqueConstraint(fields=["campaign", "user"], name="unique_campaign_warband")]

    def __str__(self):
        return f"{self.name} ({self.campaign_id}:{self.user_id})"

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Saving a loaded warband never writes `gold`: a balance read earlier may be stale (the ledger changes it
        in the database). Name `gold` in `update_fields` to write it on purpose."""
        if not self._state.adding and kwargs.get("update_fields") is None:
            kwargs["update_fields"] = [
                field.name for field in self._meta.concrete_fields if not field.primary_key and field.name != "gold"
            ]
        super().save(*args, **kwargs)


class WarbandItem(models.Model):
    warband = models.ForeignKey(Warband, related_name="warband_items", on_delete=models.CASCADE)
    item = models.ForeignKey("items.Item", related_name="warband_items", on_delete=models.CASCADE)
    cost = models.PositiveIntegerField(null=True, blank=True)
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "warband_items"
        constraints = [models.UniqueConstraint(fields=["warband", "item"], name="unique_warband_item")]

    def __str__(self):
        return f"{self.warband_id}:{self.item_id} x{self.quantity}"


class WarbandLog(models.Model):
    warband = models.ForeignKey(Warband, related_name="logs", on_delete=models.CASCADE)
    parent = models.ForeignKey("self", null=True, blank=True, related_name="children", on_delete=models.CASCADE)
    feature = models.CharField(max_length=80)
    entry_type = models.CharField(max_length=80, db_column="type")
    payload = models.JSONField(db_column="json")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "warband_log"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.warband_id}:{self.feature}:{self.entry_type}"


class WarbandResource(models.Model):
    warband = models.ForeignKey(Warband, related_name="resources", on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    amount = models.IntegerField(default=0)

    class Meta:
        db_table = "warband_resources"
        constraints = [models.UniqueConstraint(fields=["warband", "name"], name="unique_warband_resource")]

    def __str__(self):
        return f"{self.warband_id}:{self.name}"


class LedgerAction(models.TextChoices):
    """What a ledger row records: one vocabulary for hand-entered and automatic rows (decision 4)."""

    BUY = "Buy"
    SELL = "Sell"
    RECRUIT = "Recruit"
    HIRE = "Hire"
    UPKEEP = "Upkeep"
    REWARD = "Reward"
    EXPLORATION = "Exploration"
    TRADE = "Trade"
    ADJUSTMENT = "Adjustment"
    STARTING_GOLD = "Starting gold"
    GROUP = "Group"  # a header the rows of one batch nest under; it moves no gold

    @property
    def is_expense(self) -> bool:
        """The action always spends gold: its rows are stored negative."""
        return self in EXPENSE_ACTIONS

    @property
    def is_signed(self) -> bool:
        """Gold may go either way (a trade sent or received, an adjustment up or down): the amount carries its sign."""
        return self in SIGNED_ACTIONS


EXPENSE_ACTIONS = frozenset({LedgerAction.BUY, LedgerAction.RECRUIT, LedgerAction.HIRE, LedgerAction.UPKEEP})
SIGNED_ACTIONS = frozenset({LedgerAction.TRADE, LedgerAction.ADJUSTMENT})


class WarbandTrade(models.Model):
    warband = models.ForeignKey(Warband, related_name="trades", on_delete=models.CASCADE)
    parent = models.ForeignKey("self", null=True, blank=True, related_name="children", on_delete=models.CASCADE)
    action = models.CharField(max_length=120, choices=LedgerAction.choices)
    description = models.CharField(max_length=500)
    price = models.IntegerField(default=0)
    notes = models.TextField(max_length=2000, blank=True, default="")
    # who entered a row by hand (decision 6); None for automatic rows and rows from before pass 2
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, related_name="+", on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "warband_trades"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.warband_id}:{self.action}"
