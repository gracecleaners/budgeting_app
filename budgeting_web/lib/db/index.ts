import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

let _db: ReturnType<typeof createDb> | null = null;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local (or your Netlify env vars)."
    );
  }
  return drizzle(neon(url), { schema });
}

export function db() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export { schema };
