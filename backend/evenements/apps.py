from django.apps import AppConfig


class EvenementsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "evenements"

    def ready(self):
        from . import signals  # noqa: F401  (push téléphone sur notification / alerte)
