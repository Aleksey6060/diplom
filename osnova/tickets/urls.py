from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import TicketTemplateViewSet, TicketViewSet

app_name = "tickets"

router = DefaultRouter()
router.register(r"templates", TicketTemplateViewSet, basename="ticket-templates")
router.register(r"requests", TicketViewSet, basename="ticket-requests")

urlpatterns = []
urlpatterns += router.urls

