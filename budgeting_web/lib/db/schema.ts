import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Multi-user personal finance schema.
 * Money columns are numeric(18,2); application math uses integer cents
 * (lib/money.ts). Transfers use from/to account columns and never touch
 * income/expense totals (spec #36).
 */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("UGX"),
  country: varchar("country", { length: 60 }),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Opaque server-side sessions; httpOnly cookie holds the token only. */
export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    token: varchar("token", { length: 64 }).notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

export const accounts = pgTable(
  "accounts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 30 }).notNull().default("cash"),
    // opening balance; current balance is derived from transactions and
    // cached here for fast reads (maintained by lib/balances.ts)
    openingBalance: numeric("opening_balance", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    balanceCentsCache: integer("balance_cents_cache").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("UGX"),
    institution: varchar("institution", { length: 120 }),
    color: varchar("color", { length: 7 }).notNull().default("#0ea5e9"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)]
);

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    kind: varchar("kind", { length: 10 }).notNull().default("expense"), // income | expense
    parentId: integer("parent_id"),
    color: varchar("color", { length: 7 }).notNull().default("#64748b"),
    icon: varchar("icon", { length: 30 }),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("categories_user_name_kind_unique").on(t.userId, t.name, t.kind)]
);

export const budgets = pgTable(
  "budgets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // null categoryId = "overall" budget across all expense categories
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "cascade",
    }),
    // null accountId = budget applies to spending from any account
    accountId: integer("account_id").references(() => accounts.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 100 }).notNull().default(""),
    amountCents: integer("amount_cents").notNull(),
    // weekly | monthly | custom
    period: varchar("period", { length: 15 }).notNull().default("monthly"),
    // inclusive custom window; required when period = custom, ignored otherwise
    startDate: date("start_date"),
    endDate: date("end_date"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("budgets_user_idx").on(t.userId)]
);

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // income | expense | transfer | savings | debt_payment | investment
    type: varchar("type", { length: 15 }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    fromAccountId: integer("from_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    toAccountId: integer("to_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    date: date("date").notNull(),
    description: varchar("description", { length: 255 }).notNull().default(""),
    paymentMethod: varchar("payment_method", { length: 30 }),
    merchant: varchar("merchant", { length: 120 }),
    notes: text("notes"),
    recurring: boolean("recurring").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transactions_user_date_idx").on(t.userId, t.date),
    index("transactions_user_type_idx").on(t.userId, t.type),
    index("transactions_category_idx").on(t.categoryId),
    index("transactions_from_account_idx").on(t.fromAccountId),
    index("transactions_to_account_idx").on(t.toAccountId),
  ]
);
