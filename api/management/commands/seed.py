from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from api.models import Category, Budget, Transaction


class Command(BaseCommand):
    help = "Seed sample budgeting data (categories, budgets, transactions)"

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true", help="Clear existing data first")

    def handle(self, *args, **options):
        if options["clear"]:
            Category.objects.all().delete()
            Budget.objects.all().delete()
            Transaction.objects.all().delete()

        with transaction.atomic():
            food = Category.objects.get_or_create(name="Food", color="#ff5f57")[0]
            rent = Category.objects.get_or_create(name="Rent", color="#2cb67d")[0]
            transport = Category.objects.get_or_create(name="Transport", color="#ffcb2b")[0]
            income_cat = Category.objects.get_or_create(name="Salary", color="#1e90ff")[0]
            entertainment = Category.objects.get_or_create(name="Entertainment", color="#9b51e0")[0]
            utilities = Category.objects.get_or_create(name="Utilities", color="#5ac8fa")[0]

            Budget.objects.get_or_create(category=food, period="monthly", defaults={"amount": 600})
            Budget.objects.get_or_create(category=rent, period="monthly", defaults={"amount": 1200})
            Budget.objects.get_or_create(category=transport, period="monthly", defaults={"amount": 200})
            Budget.objects.get_or_create(category=entertainment, period="monthly", defaults={"amount": 150})
            Budget.objects.get_or_create(category=utilities, period="monthly", defaults={"amount": 300})
            Budget.objects.get_or_create(category=income_cat, period="monthly", defaults={"amount": 4000})

            today = timezone.localdate()
            for _ in range(14):
                Transaction.objects.get_or_create(
                    category=food,
                    date=today,
                    amount=45.00,
                    type="expense",
                    note="Groceries",
                    defaults={"date": today},
                )
            Transaction.objects.get_or_create(
                category=rent,
                date=today,
                amount=1200.00,
                type="expense",
                note="Rent",
            )

            deposit_date = today.replace(day=max(1, today.day - 5))
            Transaction.objects.get_or_create(
                category=income_cat,
                date=deposit_date,
                amount=4000.00,
                type="income",
                note="Salary deposit",
            )

        self.stdout.write(self.style.SUCCESS("Seeded sample budgeting data"))
