from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/', include('residences.urls')),
    path('api/', include('maintenance.urls')),
    path('api/', include('restauration.urls')),
    path('api/', include('accounts.urls')),
    path('api/', include('voyages.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
