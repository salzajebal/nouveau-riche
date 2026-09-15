import pg from "pg";

const { Pool } = pg;
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:password@localhost:5432/myapp";

const pool = new Pool({ connectionString });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "stock_catalog" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "stock_name" text NOT NULL,
      "stock_code" text DEFAULT '' NOT NULL,
      "purchase_price" integer DEFAULT 0 NOT NULL,
      "ipo_price" integer DEFAULT 0 NOT NULL,
      "category" text DEFAULT '일반' NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  await pool.query(`
    ALTER TABLE "stock_catalog"
    DROP CONSTRAINT IF EXISTS "stock_catalog_stock_name_unique"
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "stock_catalog_stock_name_ci_unique"
    ON "stock_catalog" (lower("stock_name"))
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "stock_catalog_stock_code_ci_unique"
    ON "stock_catalog" (lower("stock_code"))
    WHERE "stock_code" <> ''
  `);
  await pool.query(`
    ALTER TABLE "transfer_requests"
    ADD COLUMN IF NOT EXISTS "category" text
  `);
  await pool.query(`
    ALTER TABLE "transfer_requests"
    ADD COLUMN IF NOT EXISTS "source_lot_id" varchar
  `);
  await pool.query(`
    ALTER TABLE "stock_transactions"
    ADD COLUMN IF NOT EXISTS "transfer_request_id" varchar
  `);
  await pool.query(`
    DROP INDEX IF EXISTS "stock_transactions_transfer_request_id_unique"
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "stock_transactions_transfer_request_id_idx"
    ON "stock_transactions" ("transfer_request_id")
    WHERE "transfer_request_id" IS NOT NULL
  `);
  console.log("stock_catalog table ready");
} finally {
  await pool.end();
}