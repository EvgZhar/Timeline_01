import { db } from "./index.js";
import { sysRefreshTokenTable } from "./schema.js";
import { lt, and, isNotNull } from "drizzle-orm";

async function main() {
  const expired = await db
    .delete(sysRefreshTokenTable)
    .where(lt(sysRefreshTokenTable.expiresAt, new Date()))
    .returning({ id: sysRefreshTokenTable.id });

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const oldRevoked = await db
    .delete(sysRefreshTokenTable)
    .where(
      and(
        isNotNull(sysRefreshTokenTable.revokedAt),
        lt(sysRefreshTokenTable.revokedAt, dayAgo),
      ),
    )
    .returning({ id: sysRefreshTokenTable.id });

  console.log(`Очистка SysRefreshToken завершена`);
  console.log(`  Удалено истёкших: ${expired.length}`);
  console.log(`  Удалено старых revoked: ${oldRevoked.length}`);
}

main().catch(console.error);
