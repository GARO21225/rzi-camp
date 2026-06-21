from django.apps import AppConfig


class ResidencesConfig(AppConfig):
    name = 'residences'

    def ready(self):
        import residences.signals
