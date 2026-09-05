from django.db import models
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Category, Budget, Transaction
from .serializers import (
    CategorySerializer,
    BudgetSerializer,
    TransactionSerializer,
    HighLevelSummarySerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class BudgetViewSet(viewsets.ModelViewSet):
    queryset = Budget.objects.all()
    serializer_class = BudgetSerializer


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer



class SummaryViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    def list(self, request):
        total_income = Transaction.objects.filter(type="income").aggregate(
            models.Sum("amount")
        )["amount__sum"] or 0
        total_expenses = Transaction.objects.filter(type="expense").aggregate(
            models.Sum("amount")
        )["amount__sum"] or 0
        months = Transaction.objects.values_list("date", flat=True).order_by()
        unique_months = set((dt.year, dt.month) for dt in months if dt)
        months_count = len(unique_months)
        average_monthly_expense = (
            round(float(total_expenses) / months_count, 2) if months_count else 0
        )
        return Response(
            HighLevelSummarySerializer(
                {
                    "total_income": float(total_income),
                    "total_expenses": float(total_expenses),
                    "net": float(total_income - total_expenses),
                    "months_tracked": months_count,
                    "average_monthly_expense": average_monthly_expense,
                }
            ).data
        )
