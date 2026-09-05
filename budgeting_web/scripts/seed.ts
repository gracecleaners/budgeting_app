import { eq } from "drizzle-orm";
import { config } from "dotenv";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

config({ path: ".env.local" });

import { db, schema } from "../lib/db";
import { DEFAULT_CATEGORIES } from "../lib/defaults";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

const DEMO_EMAIL = "demo@budget.local";
const DEMO_PASSWORD = "demo1234";

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateKey(d);
}

async function main() {
  // remove previous demo user if re-seeding
  const [existing] = await db().select().from(schema.users).where(eq(schema.users.email, DEMO_EMAIL));
  if (existing) {
    await db().delete(schema.users).where(eq(schema.users.id, existing.id));
    console.log("Removed previous demo user");
  }

  const [user] = await db()
    .insert(schema.users)
    .values({
      email: DEMO_EMAIL,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      name: "Demo User",
      currency: "UGX",
      country: "Uganda",
      onboardedAt: new Date(),
    })
    .returning();

  await db().insert(schema.categories).values(
    DEFAULT_CATEGORIES.map((c) => ({ userId: user.id, name: c.name, kind: c.kind, color: c.color }))
  );
  const cats = await db().select().from(schema.categories).where(eq(schema.categories.userId, user.id));
  const cat = (name: string) => cats.find((c) => c.name === name)!.id;

  const accounts = await db()
    .insert(schema.accounts)
    .values([
      { userId: user.id, name: "MTN Mobile Money", type: "mobile_money", openingBalance: "350000", currency: "UGX", color: "#facc15" },
      { userId: user.id, name: "Stanbic Bank", type: "bank", openingBalance: "2450000", currency: "UGX", institution: "Stanbic", color: "#0ea5e9" },
      { userId: user.id, name: "Cash", type: "cash", openingBalance: "120000", currency: "UGX", color: "#22c55e" },
      { userId: user.id, name: "Savings", type: "savings", openingBalance: "1500000", currency: "UGX", color: "#8b5cf6" },
    ])
    .returning();
  const acc = (name: string) => accounts.find((a) => a.name === name)!.id;

  const txs: (typeof schema.transactions.$inferInsert)[] = [];
  const toCents = (v: number) => Math.round(v * 100);

  // Two months of salary + rent + groceries + transport + utilities
  for (const monthsBack of [1, 0]) {
    txs.push({
      userId: user.id, type: "income", amountCents: toCents(2_000_000),
      toAccountId: acc("Stanbic Bank"), categoryId: cat("Salary"),
      date: daysAgo(monthsBack * 30 + 12), description: "Monthly salary", recurring: true,
    });
    txs.push({
      userId: user.id, type: "expense", amountCents: toCents(600_000),
      fromAccountId: acc("Stanbic Bank"), categoryId: cat("Housing"),
      date: daysAgo(monthsBack * 30 + 10), description: "Rent", merchant: "Landlord", recurring: true,
    });
    for (let i = 0; i < 6; i++) {
      txs.push({
        userId: user.id, type: "expense", amountCents: toCents(35_000 + i * 5_000),
        fromAccountId: acc("MTN Mobile Money"), categoryId: cat("Food"),
        date: daysAgo(monthsBack * 30 + i * 4 + 2), description: "Groceries", merchant: "Supermarket",
      });
    }
    txs.push({
      userId: user.id, type: "expense", amountCents: toCents(90_000),
      fromAccountId: acc("MTN Mobile Money"), categoryId: cat("Bills"),
      date: daysAgo(monthsBack * 30 + 8), description: "Electricity + water", recurring: true,
    });
    txs.push({
      userId: user.id, type: "expense", amountCents: toCents(150_000),
      fromAccountId: acc("Cash"), categoryId: cat("Transportation"),
      date: daysAgo(monthsBack * 30 + 5), description: "Fuel and taxi",
    });
    txs.push({
      userId: user.id, type: "expense", amountCents: toCents(45_000),
      fromAccountId: acc("MTN Mobile Money"), categoryId: cat("Entertainment"),
      date: daysAgo(monthsBack * 30 + 3), description: "Streaming + data bundles",
    });
    // monthly savings transfer into the savings account (not income/expense)
    txs.push({
      userId: user.id, type: "savings", amountCents: toCents(400_000),
      fromAccountId: acc("Stanbic Bank"), toAccountId: acc("Savings"),
      date: daysAgo(monthsBack * 30 + 11), description: "Monthly savings",
    });
  }
  // one transfer between wallets
  txs.push({
    userId: user.id, type: "transfer", amountCents: toCents(200_000),
    fromAccountId: acc("Stanbic Bank"), toAccountId: acc("MTN Mobile Money"),
    date: daysAgo(6), description: "Top up Mobile Money",
  });

  await db().insert(schema.transactions).values(txs);

  console.log(`Seeded demo user:
  email:    ${DEMO_EMAIL}
  password: ${DEMO_PASSWORD}
  accounts: ${accounts.length}, categories: ${cats.length}, transactions: ${txs.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
