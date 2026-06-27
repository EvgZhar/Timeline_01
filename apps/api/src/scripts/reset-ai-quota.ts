import "dotenv/config";
import { lt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { sysUserTable } from "../db/schema.js";

async function main() {
  const result = await db
    .update(sysUserTable)
    .set({
      aiQuotaUsed: 0,
      aiQuotaResetDate: sql`NOW()`,
    })
    .where(
      sql`${sysUserTable.aiQuotaUsed} > 0
        AND (${sysUserTable.aiQuotaResetDate} IS NULL
          OR ${sysUserTable.aiQuotaResetDate} < NOW() - INTERVAL '1 month')`,
    )
    .returning({ id: sysUserTable.id, login: sysUserTable.login });

  console.log(`Сброшены AI-квоты для ${result.length} пользователей:`);
  for (const u of result) {
    console.log(`  #${u.id} ${u.login}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("Ошибка сброса AI-квот:", e);
  process.exit(1);
});
