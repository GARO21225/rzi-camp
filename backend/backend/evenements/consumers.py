import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close(); return
        self.group_name = f'notif_{user.id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        count = await self.get_count(user)
        await self.send(text_data=json.dumps({'type':'count','count':count}))
    async def disconnect(self, code):
        if hasattr(self,'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
    async def receive(self, text_data):
        pass
    async def notification_push(self, event):
        await self.send(text_data=json.dumps({'type':'notification','titre':event['titre'],'message':event['message'],'type_notif':event.get('type_notif','systeme')}))
    async def count_update(self, event):
        await self.send(text_data=json.dumps({'type':'count','count':event['count']}))
    @database_sync_to_async
    def get_count(self, user):
        try:
            from evenements.models import Notification
            if hasattr(user,'personnel'): return Notification.objects.filter(personnel=user.personnel,lu=False).count()
        except: pass
        return 0
