import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

export const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:password@localhost:5432/myapp";

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
});

export const db = drizzle(pool, { schema });
