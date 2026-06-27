import { db } from "./index.js";
import { eq } from "drizzle-orm";
import {
  appSettings,
  sysDataAreaTable,
  sysUserTable,
  sysUserDataArea,
  sysUserSettingsTable,
  timelineTable,
  eventTable,
  eventTimelineLink,
} from "./schema.js";
import { passwordService } from "../services/auth/password.js";

async function seed() {
  const [existing] = await db
    .select()
    .from(sysUserTable)
    .where(eq(sysUserTable.login, "admin"))
    .limit(1);

  if (existing) {
    console.log("DB already seeded");
    return;
  }

  // ── 1. Default DataArea ──
  const [defaultArea] = await db
    .insert(sysDataAreaTable)
    .values({ name: "Default", description: "Основная область данных", isPersonal: false })
    .returning();
  console.log("+ DataArea: Default");

  // ── 2. Admin user (admin / admin) ──
  const adminHash = await passwordService.hash("admin");
  const [adminUser] = await db
    .insert(sysUserTable)
    .values({
      login: "admin",
      email: "admin@timeline.local",
      passwordHash: adminHash,
      firstName: "Admin",
      lastName: "Administrator",
      isActive: true,
      emailConfirmed: true,
      defaultDataAreaId: defaultArea.id,
      aiQuotaTotal: 10000,
    })
    .returning();
  console.log("+ User: admin");

  await db.insert(sysUserDataArea).values({
    userId: adminUser.id,
    dataAreaId: defaultArea.id,
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
  });

  await db.insert(sysUserSettingsTable).values({
    userId: adminUser.id,
    currentDataAreaId: defaultArea.id,
  });

  // ── 3. Test user (testuser / test1234) ──
  const testHash = await passwordService.hash("test1234");
  const [testUser] = await db
    .insert(sysUserTable)
    .values({
      login: "testuser",
      email: "testuser@test.local",
      passwordHash: testHash,
      firstName: "Test",
      lastName: "User",
      isActive: true,
      emailConfirmed: true,
      defaultDataAreaId: defaultArea.id,
    })
    .returning();
  console.log("+ User: testuser");

  await db.insert(sysUserDataArea).values({
    userId: testUser.id,
    dataAreaId: defaultArea.id,
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
  });

  await db.insert(sysUserSettingsTable).values({
    userId: testUser.id,
    currentDataAreaId: defaultArea.id,
  });

  // ── 4. Demo data ──
  const [t1] = await db
    .insert(timelineTable)
    .values({ name: "Мировая история", description: "Основная шкала", sortIndex: 0 })
    .returning();
  const [t2] = await db
    .insert(timelineTable)
    .values({ name: "Наука и культура", sortIndex: 1 })
    .returning();

  const [e1] = await db
    .insert(eventTable)
    .values({
      name: "Высадка на Луну",
      startDate: "1969-07-20",
      endDate: "1969-07-20",
      notes: "Apollo 11",
    })
    .returning();

  const [e2] = await db
    .insert(eventTable)
    .values({
      name: "Вторая мировая война",
      startDate: "1939-09-01",
      endDate: "1945-09-02",
    })
    .returning();

  await db.insert(eventTimelineLink).values([
    { eventId: e1.id, timelineId: t1.id },
    { eventId: e2.id, timelineId: t1.id },
    { eventId: e1.id, timelineId: t2.id },
  ]);

  // ── 6. AI settings defaults ──
  await db.insert(appSettings).values({
    key: "AI_SYSTEM_PROMPT",
    value: "Ты — исторический ассистент. Напиши краткую справку о событии. Используй Markdown-разметку. Ответ должен быть на русском языке.",
    isSecret: false,
    updatedAt: new Date(),
  }).onConflictDoNothing({ target: appSettings.key });

  await db.insert(appSettings).values({
    key: "AI_USER_PROMPT_TEMPLATE",
    value: 'Напиши краткую историческую справку о событии "{eventName}".',
    isSecret: false,
    updatedAt: new Date(),
  }).onConflictDoNothing({ target: appSettings.key });

  console.log("Seed complete");
}

seed().catch(console.error);
