import { db } from "./index.js";
import { sysUserTable } from "./schema.js";
import { eq } from "drizzle-orm";
import { passwordService } from "../services/auth/password.js";

async function main() {
  const passwordHash = await passwordService.hash("admin");
  await db
    .update(sysUserTable)
    .set({ passwordHash })
    .where(eq(sysUserTable.login, "admin"));
  console.log("Admin password updated to bcrypt hash");
}

main().catch(console.error);
