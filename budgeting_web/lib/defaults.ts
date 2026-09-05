/** Default categories created for every new user (spec #5). */

export const DEFAULT_CATEGORIES: { name: string; kind: "income" | "expense"; color: string }[] = [
  { name: "Salary", kind: "income", color: "#10b981" },
  { name: "Business", kind: "income", color: "#0ea5e9" },
  { name: "Freelance", kind: "income", color: "#6366f1" },
  { name: "Investments", kind: "income", color: "#8b5cf6" },
  { name: "Gifts", kind: "income", color: "#f59e0b" },
  { name: "Other income", kind: "income", color: "#64748b" },
  { name: "Housing", kind: "expense", color: "#ef4444" },
  { name: "Food", kind: "expense", color: "#f97316" },
  { name: "Transportation", kind: "expense", color: "#eab308" },
  { name: "Health", kind: "expense", color: "#ec4899" },
  { name: "Education", kind: "expense", color: "#3b82f6" },
  { name: "Entertainment", kind: "expense", color: "#8b5cf6" },
  { name: "Personal", kind: "expense", color: "#14b8a6" },
  { name: "Bills", kind: "expense", color: "#64748b" },
  { name: "Other", kind: "expense", color: "#94a3b8" },
];

export const CURRENCIES = ["UGX", "USD", "EUR", "GBP", "KES", "TZS", "SSP"] as const;

export const ACCOUNT_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank account" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "savings", label: "Savings account" },
  { value: "investment", label: "Investment account" },
  { value: "digital_wallet", label: "Digital wallet" },
] as const;
