"""The campaign the end-to-end tests run against (`manage.py seed_e2e`): "E2E Shards", its six players and the
states a test needs, built fresh every run.

It is the demo seeder's machinery with test data instead of a story: `demo/api.py` calls the app's own API in
process, `demo/raising.py` raises each warband from its template, `demo/battles.py` plays a plan, `demo/guard.py`
keeps it to DEBUG and a local database. Only what the seeds differ in lives here: who plays (`cast.py`), what they
fought (`plans.py`) and which battle is left at which stage (`build.py`).

Why a command of its own rather than a flag on seed_demo_campaign: the two want opposite things. The demo is a story
to look at, and it is free to change whenever the story reads better; an e2e fixture is an interface a test suite
pins (fixed emails, a fixed join code, a known gold, a battle parked at each stage), and every change to it breaks
tests. A flag would tie them together. No machinery is copied: everything but the data is imported from `demo/`.
"""
