import { db } from "./index.js";
import { eventTable, eventTimelineLink, timelineTable } from "./schema.js";

async function seed() {
  const existing = await db.select().from(timelineTable);
  if (existing.length > 0) {
    console.log("DB already seeded");
    return;
  }

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

  console.log("Seed complete");
}

seed().catch(console.error);
