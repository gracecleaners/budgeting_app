import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

import * as schema from "./schema";

let _db: ReturnType<typeof createDb> | null = null;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local (or your Netlify env vars)."
    );
  }
  // Pool (websocket) driver — required for db.transaction() support
  // (savings contributions and debt payments use atomic transactions).
  // Works locally and on Netlify functions.
  const pool = new Pool({ connectionString: url, max: 5 });
  return drizzle(pool, { schema });
}

export function db() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export { schema };
