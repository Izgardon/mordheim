"""The demo campaign for local dev (`manage.py seed_demo_campaign`): "The Shattered Crown", its four players (every
password "password") and their warbands after a few weeks of play.

Everything is built through the API, in process (`api.py`), so each write runs the view and the service a player's
click runs: ledgers and gold, XP and advances, battle_kill, pivotal moments, the chronicle and battle numbers all come
out as the app makes them. `guard.py` keeps it to DEBUG and a local database.
"""
