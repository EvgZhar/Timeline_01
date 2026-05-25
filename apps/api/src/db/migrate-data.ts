import { db } from "./index.js";
import {
  sysDataAreaTable,
  sysUserTable,
  sysUserDataArea,
  sysUserSettingsTable,
  timelineTable,
  eventTable,
  eventTimelineLink,
  tagTable,
  tagEventLink,
  documentTable,
  documentEventLink,
} from "./schema.js";
import { eq, isNull } from "drizzle-orm";
import { passwordService } from "../services/auth/password.js";

async function main() {
  // ── 1. Create Default DataArea ──
  let [defaultArea] = await db
    .select()
    .from(sysDataAreaTable)
    .where(eq(sysDataAreaTable.name, "Default"))
    .limit(1);

  if (!defaultArea) {
    [defaultArea] = await db
      .insert(sysDataAreaTable)
      .values({ name: "Default", description: "Основная область данных", isPersonal: false })
      .returning();
    console.log("+ DataArea: Default (id=%d)", defaultArea.id);
  } else {
    console.log("~ DataArea: Default already exists (id=%d)", defaultArea.id);
  }

  // ── 2. Create admin user ──
  let [adminUser] = await db
    .select()
    .from(sysUserTable)
    .where(eq(sysUserTable.login, "admin"))
    .limit(1);

  if (!adminUser) {
    const passwordHash = passwordService.hash("admin");
    [adminUser] = await db
      .insert(sysUserTable)
      .values({
        login: "admin",
        email: "admin@timeline.local",
        passwordHash,
        firstName: "Admin",
        lastName: "Administrator",
        isActive: true,
        emailConfirmed: true,
        defaultDataAreaId: defaultArea.id,
      })
      .returning();
    console.log("+ User: admin (id=%d)", adminUser.id);
  } else {
    console.log("~ User: admin already exists (id=%d)", adminUser.id);
  }

  // ── 3. Admin: full CRUD rights on Default DataArea ──
  const [existingPerm] = await db
    .select()
    .from(sysUserDataArea)
    .where(eq(sysUserDataArea.userId, adminUser.id))
    .limit(1);

  if (!existingPerm) {
    await db.insert(sysUserDataArea).values({
      userId: adminUser.id,
      dataAreaId: defaultArea.id,
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: true,
    });
    console.log("+ Permission: admin -> Default (full CRUD)");
  }

  // ── 4. Admin settings: current DataArea = Default ──
  const [existingSettings] = await db
    .select()
    .from(sysUserSettingsTable)
    .where(eq(sysUserSettingsTable.userId, adminUser.id))
    .limit(1);

  if (!existingSettings) {
    await db.insert(sysUserSettingsTable).values({
      userId: adminUser.id,
      currentDataAreaId: defaultArea.id,
    });
    console.log("+ Settings: admin -> Default");
  }

  // ── 5. Link existing records to Default DataArea ──
  const tables = [
    { name: "TimelineTable", table: timelineTable, idField: timelineTable.id },
    { name: "EventTable", table: eventTable, idField: eventTable.id },
    { name: "TagTable", table: tagTable, idField: tagTable.id },
    { name: "DocumentTable", table: documentTable, idField: documentTable.documentId },
  ];

  for (const { name, table, idField } of tables) {
    const rows = await db.select({ id: idField }).from(table).where(isNull(table.dataAreaId));
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      await db
        .update(table)
        .set({ dataAreaId: defaultArea.id })
        .where(isNull(table.dataAreaId));
      console.log("  ~ %s: %d records linked to Default", name, ids.length);
    }
  }

  // Link tables (EventTimelineLink, TagEventLink, DocumentEventLink)
  const linkTables = [
    { name: "EventTimelineLink", table: eventTimelineLink, idField: eventTimelineLink.eventId },
    { name: "TagEventLink", table: tagEventLink, idField: tagEventLink.eventId },
    { name: "DocumentEventLink", table: documentEventLink, idField: documentEventLink.eventId },
  ];

  for (const { name, table, idField } of linkTables) {
    const rows = await db.select({ id: idField }).from(table).where(isNull(table.dataAreaId));
    if (rows.length > 0) {
      await db
        .update(table)
        .set({ dataAreaId: defaultArea.id })
        .where(isNull(table.dataAreaId));
      console.log("  ~ %s: %d records linked to Default", name, rows.length);
    }
  }

  // ── 6. Admin: personal DataArea ──
  let [personalArea] = await db
    .select()
    .from(sysDataAreaTable)
    .where(eq(sysDataAreaTable.name, "admin-personal"))
    .limit(1);

  if (!personalArea) {
    [personalArea] = await db
      .insert(sysDataAreaTable)
      .values({ name: "admin-personal", description: "Личная область admin", isPersonal: true })
      .returning();
    console.log("+ DataArea: admin-personal (id=%d)", personalArea.id);

    await db.insert(sysUserDataArea).values({
      userId: adminUser.id,
      dataAreaId: personalArea.id,
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: true,
    });
    console.log("+ Permission: admin -> admin-personal (full CRUD)");
  }

  console.log("\nData migration complete!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
