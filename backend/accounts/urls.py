from django.urls import path
from .views import me, liste_users, toggle_user_active, delete_user, assigner_role

urlpatterns = [
    path("auth/me/", me),
    path("admin/users/", liste_users),
    path("admin/users/<int:user_id>/toggle-active/", toggle_user_active),
    path("admin/users/<int:user_id>/delete/", delete_user),
    path("admin/users/<int:user_id>/role/", assigner_role),
]
