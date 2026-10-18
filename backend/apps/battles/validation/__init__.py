"""What battle writes accept: the config save, unit keys and the postbattle draft.

Each normaliser returns the cleaned value or raises ValueError with the message the view answers as
`{"detail": message}` (400). Numbers outside their range are clamped rather than refused, as they always were;
unusual values in a draft come back as warnings (services/unusual.py).
"""
