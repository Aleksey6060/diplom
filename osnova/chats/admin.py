from django.contrib import admin

from .models import ChatRoom, ChatParticipant, ChatMessage

admin.site.register(ChatRoom)
admin.site.register(ChatParticipant)
admin.site.register(ChatMessage)
