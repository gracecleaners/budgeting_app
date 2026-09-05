import { eq } from "drizzle-orm";
import { config } from "dotenv";

config({ path: ".env.local" });

import { db, schema } from "../lib/db";

const { budgets, categories, transactions } = schema;

const CATEGORIES = [
  { name: "Food", color: "#ff5f57" },
  { name: "Rent", color: "#2cb67d" },
  { name: "Transport", color: "#ffcb2b" },
  { name: "Salary", color: "#1e90ff" },
  { name: "Entertainment", color: "#9b51e0" },
  { name: "Utilities", color: "#5ac8fa" },
];

const BUDGETS: Record<string, number> = {
  Food: 600,
  Rent: 1200,
  Transport: 200,
  Entertainment: 150,
  Utilities: 300,
  Salary: 4000,
};

async function main() {
  const today = new Date().toISOString().split("T")[0];
  const depositDate = new Date();
  depositDate.setDate(Math.max(1, depositDate.getDate() - 5));
  const deposit = depositDate.toISOString().split("T")[0];

  const ids: Record<string, number> = {};
  for (const { name, color } of CATEGORIES) {
    const [existing] = await db().select().from(categories).where(eq(categories.name, name));
    if (existing) {
      ids[name] = existing.id;
      continue;
    }
    const [row] = await db().insert(categories).values({ name, color }).returning();
    ids[name] = row.id;
  }

  for (const [name, amount] of Object.entries(BUDGETS)) {
    const [existing] = await db()
      .select()
      .from(budgets)
      .where(eq(budgets.categoryId, ids[name]));
    if (existing) continue;
    await db()
      .insert(budgets)
      .values({ categoryId: ids[name], amount: amount.toFixed(2), period: "monthly" });
  }

  const foodId = ids["Food"];
  const [existingGroceries] = await db()
    .select()
    .from(transactions)
    .where(eq(transactions.categoryId, foodId));
  if (!existingGroceries) {
    await db()
      .insert(transactions)
      .values([
        { categoryId: foodId, amount: "45.00", type: "expense", date: today, note: "Groceries" },
        { categoryId: ids["Rent"], amount: "1200.00", type: "expense", date: today, note: "Rent" },
        {
          categoryId: ids["Salary"],
          amount: "4000.00",
          type: "income",
          date: deposit,
          note: "Salary deposit",
        },
      ]);
  }

  console.log("Seeded sample budgeting data");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
