"""Record the traders that open trades already spent, so they come back when those trades end.

Before this change a locked side's trader was spent and given back by reading the side's offer. Trades still
open ("accepted") when this runs keep that promise: a locked side whose offer names one of its warband's
heroes gets that hero recorded as spent. Finished trades are left alone. Reversing leaves the columns as
they are (the previous migration drops them).
"""

from django.db import migrations


def _trader_id(offer):
    if not isinstance(offer, dict) or offer.get("trader_id") in (None, ""):
        return None
    try:
        return int(offer["trader_id"])
    except (TypeError, ValueError):
        return None


def record_spent_traders(apps, schema_editor):
    TradeRequest = apps.get_model("trades", "TradeRequest")
    Hero = apps.get_model("warbands", "Hero")
    for trade in TradeRequest.objects.filter(status="accepted").iterator():
        changed = []
        for side in ("from", "to"):
            hero_id = _trader_id(getattr(trade, f"{side}_offer"))
            warband_id = getattr(trade, f"{side}_warband_id")
            if not getattr(trade, f"{side}_accepted") or hero_id is None:
                continue
            if Hero.objects.filter(id=hero_id, warband_id=warband_id).exists():
                setattr(trade, f"{side}_trader_spent_id", hero_id)
                changed.append(f"{side}_trader_spent")
        if changed:
            trade.save(update_fields=changed)


class Migration(migrations.Migration):
    dependencies = [
        ("trades", "0004_trade_request_trader_spent"),
    ]

    operations = [
        migrations.RunPython(record_spent_traders, migrations.RunPython.noop),
    ]
