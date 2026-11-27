from django.db import models
from rest_framework.utils.encoders import JSONEncoder

MAX_REQUEST_KEY = 64


class WarbandRequestKey(models.Model):
    """A gold-moving write's request key and the answer it got (services/request_keys.py): the client sends one key per
    attempt and the same key again on a retry, so a write whose answer was lost on weak signal is answered again
    instead of buying, hiring or recruiting twice. Written in the write's own transaction; kept a day."""

    warband = models.ForeignKey("Warband", related_name="+", on_delete=models.CASCADE)
    key = models.CharField(max_length=MAX_REQUEST_KEY)
    action = models.CharField(max_length=40)  # the write it answered ("purchase", "hero.batch", "hireling.hire")
    status = models.PositiveSmallIntegerField()
    answer = models.JSONField(encoder=JSONEncoder)  # as DRF renders it (a decimal is a number)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "warband_request_key"
        constraints = [models.UniqueConstraint(fields=["warband", "key"], name="unique_warband_request_key")]

    def __str__(self) -> str:
        return f"{self.action} {self.key}"
