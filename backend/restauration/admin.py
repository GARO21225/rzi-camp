from django.contrib import admin
from .models import QRToken, RepasLog, AuditLog
admin.site.register(QRToken)
admin.site.register(RepasLog)
@admin.register(AuditLog)
class AuditAdmin(admin.ModelAdmin):
    list_display = ['timestamp','utilisateur','action','module','ip']
    list_filter = ['action','module']
