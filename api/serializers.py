from django.db import models
from rest_framework import serializers
from .models import Category, Budget, Transaction


class CategorySerializer(serializers.ModelSerializer):
    spent = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "color", "created_at", "spent"]

    def get_spent(self, obj):
        qs = Transaction.objects.filter(category=obj, type="expense")
        return float(qs.aggregate(models.Sum("amount"))["amount__sum"] or 0)


class BudgetSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source="category", write_only=True
    )
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = ["id", "category", "category_id", "amount", "period", "created_at", "updated_at", "progress"]

    def get_progress(self, obj):
        expenses = Transaction.objects.filter(category=obj.category, type="expense")
        spent = expenses.aggregate(models.Sum("amount"))["amount__sum"] or 0
        return {
            "amount": float(obj.amount),
            "spent": float(spent),
            "remaining": float(obj.amount - spent),
            "percent": min(100, round((float(spent) / float(obj.amount)) * 100, 1)) if obj.amount else 0,
        }


class TransactionSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source="category", write_only=True
    )

    class Meta:
        model = Transaction
        fields = ["id", "category", "category_id", "amount", "type", "date", "note", "created_at"]


class HighLevelSummarySerializer(serializers.Serializer):
    total_income = serializers.FloatField()
    total_expenses = serializers.FloatField()
    net = serializers.FloatField()
    months_tracked = serializers.IntegerField()
    average_monthly_expense = serializers.FloatField()
