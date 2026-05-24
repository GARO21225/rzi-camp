from django.urls import path
from . import views
from .views import ping,  me, liste_users, toggle_user_active, delete_user, assigner_role

urlpatterns = [
    path("forgot-password/", views.forgot_password, name="forgot_password"),
    path("reset-password-confirm/", views.reset_password_confirm, name="reset_password_confirm"),
    path("diagnostic/", views.diagnostic_status, name="diagnostic"),
    path("force-seed/", views.force_seed, name="force_seed"),
    path("change-password/", views.change_password, name="change_password"),
    path("reset-password/<int:user_id>/", views.reset_user_password, name="reset_user_password"),
    path("auth/me/", me),
    path("admin/users/", liste_users),
    path("admin/users/<int:user_id>/toggle-active/", toggle_user_active),
    path("admin/users/<int:user_id>/delete/", delete_user),
    path("admin/users/<int:user_id>/role/", assigner_role),
]

urlpatterns += [path('ping/', ping, name='ping')]