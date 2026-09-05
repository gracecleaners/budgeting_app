from django.urls import include, path
from rest_framework import routers

from . import views

router = routers.DefaultRouter()
router.register(r"categories", views.CategoryViewSet)
router.register(r"budgets", views.BudgetViewSet)
router.register(r"transactions", views.TransactionViewSet)
router.register(r"summary", views.SummaryViewSet, basename="summary")

urlpatterns = [
    path("", include(router.urls)),
]
