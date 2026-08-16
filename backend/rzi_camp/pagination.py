from rest_framework.pagination import PageNumberPagination


class RziPageNumberPagination(PageNumberPagination):
    """
    PageNumberPagination standard, mais qui respecte réellement le
    paramètre ?page_size=N envoyé par le frontend (ex: ?page_size=500,
    ?page_size=2000). Par défaut, DRF ignore ce paramètre tant que
    page_size_query_param n'est pas défini explicitement — ce qui faisait
    que toutes les listes plafonnaient silencieusement à 50 résultats.
    """
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 5000
