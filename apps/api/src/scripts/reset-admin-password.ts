import { db } from "../db/index.js";
import { eq } from "drizzle-orm";
import { sysUserTable } from "../db/schema.js";
import { passwordService } from "../services/auth/password.js";

async function main() {
  const hash = await passwordService.hash("admin");
  await db.update(sysUserTable).set({ passwordHash: hash }).where(eq(sysUserTable.login, "admin"));
  console.log("Admin password reset to admin/admin");
  process.exit(0);
}

main();
