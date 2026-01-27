"""
View mixins for warband views.
"""

from rest_framework import status
from rest_framework.response import Response

from apps.warbands.models import Warband


class WarbandObjectMixin:
    """
    Mixin to handle getting warband objects with proper prefetching.
    Provides get_warband() method that returns warband or raises 404.
    """

    def get_warband(self, warband_id, extra_prefetch=None):
        """
        Get a warband with standard prefetching.

        Args:
            warband_id: The ID of the warband to retrieve
            extra_prefetch: Optional list of additional relations to prefetch

        Returns:
            Warband instance or None if not found
        """
        queryset = Warband.objects.select_related("campaign").prefetch_related("resources")

        if extra_prefetch:
            queryset = queryset.prefetch_related(*extra_prefetch)

        return queryset.filter(id=warband_id).first()

    def get_warband_or_404(self, warband_id, extra_prefetch=None):
        """
        Get a warband or return a 404 response.

        Returns:
            tuple: (warband, None) if found, (None, Response) if not found
        """
        warband = self.get_warband(warband_id, extra_prefetch)
        if not warband:
            return None, Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return warband, None
