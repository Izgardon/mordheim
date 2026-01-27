"""
Utility functions for warband serializers.
"""


def get_prefetched_or_query(obj, prefetch_key, queryset_attr):
    """
    Get data from prefetched cache or fallback to querying.

    This pattern is common when serializers need to handle both prefetched
    and non-prefetched objects efficiently.

    Args:
        obj: The model instance
        prefetch_key: The key in _prefetched_objects_cache
        queryset_attr: The attribute name to query if not prefetched

    Returns:
        List of related objects (either from cache or fresh query)

    Example:
        items = get_prefetched_or_query(obj, "hero_items", "hero_items")
    """
    if hasattr(obj, "_prefetched_objects_cache") and prefetch_key in obj._prefetched_objects_cache:
        return obj._prefetched_objects_cache[prefetch_key]
    return list(getattr(obj, queryset_attr).all())
