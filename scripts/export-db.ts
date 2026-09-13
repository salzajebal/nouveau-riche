import { db } from "../server/db";
import { users, stockTransactions, transferRequests, withdrawRequests, chatMessages, unionCodes } from "../shared/schema";
import * as fs from "fs";

async function exportToSQL() {
  const tables = [
    { name: "union_codes", data: await db.select().from(unionCodes) },
    { name: "users", data: await db.select().from(users) },
    { name: "stock_transactions", data: await db.select().from(stockTransactions) },
    { name: "transfer_requests", data: await db.select().from(transferRequests) },
    { name: "withdraw_requests", data: await db.select().from(withdrawRequests) },
    { name: "chat_messages", data: await db.select().from(chatMessages) },
  ];

  let sql = "-- Production DB Seed\n\n";

  for (const { name, data } of tables) {
    sql += `-- ${name}\n`;
    for (const row of data) {
      const keys = Object.keys(row).join(", ");
      const vals = Object.values(row).map(v => {
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "boolean") return v ? "true" : "false";
        if (typeof v === "number") return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
      }).join(", ");
      sql += `INSERT INTO ${name} (${keys}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`;
    }
    sql += "\n";
    console.log(`${name}: ${data.length}건`);
  }

  fs.writeFileSync("db-seed.sql", sql, "utf8");
  console.log(`\ndb-seed.sql 생성 완료: ${sql.length} bytes`);
  process.exit(0);
}

exportToSQL().catch(e => { console.error(e); process.exit(1); });
