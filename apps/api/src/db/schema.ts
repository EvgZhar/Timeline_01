import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const timelineTable = sqliteTable("TimelineTable", {
  id: integer("Id").primaryKey({ autoIncrement: true }),
  name: text("Name", { length: 60 }).notNull(),
  description: text("Description", { length: 255 }),
  sortIndex: integer("SortIndex").default(0),
  createdDateTime: text("CreatedDateTime")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const eventTable = sqliteTable("EventTable", {
  id: integer("Id").primaryKey({ autoIncrement: true }),
  name: text("Name", { length: 255 }).notNull(),
  startDate: text("StartDate").notNull(),
  endDate: text("EndDate"),
  notes: text("Notes"),
  createdDateTime: text("CreatedDateTime")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const eventTimelineLink = sqliteTable(
  "EventTimelineLink",
  {
    eventId: integer("EventId")
      .notNull()
      .references(() => eventTable.id, { onDelete: "cascade" }),
    timelineId: integer("TimelineId")
      .notNull()
      .references(() => timelineTable.id, { onDelete: "cascade" }),
    description: text("Description", { length: 60 }),
    createdDateTime: text("CreatedDateTime")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("EventTimelineLink_unique").on(t.eventId, t.timelineId)],
);

export const tagTable = sqliteTable("TagTable", {
  id: integer("Id").primaryKey({ autoIncrement: true }),
  name: text("Name", { length: 40 }).notNull(),
  color: integer("Color").notNull(),
  createdDateTime: text("CreatedDateTime")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const tagEventLink = sqliteTable(
  "TagEventLink",
  {
    eventId: integer("EventId")
      .notNull()
      .references(() => eventTable.id, { onDelete: "cascade" }),
    tagId: integer("TagId")
      .notNull()
      .references(() => tagTable.id, { onDelete: "cascade" }),
    createdDateTime: text("CreatedDateTime")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("TagEventLink_unique").on(t.eventId, t.tagId)],
);

export const documentTable = sqliteTable("DocumentTable", {
  documentId: integer("DocumentId").primaryKey({ autoIncrement: true }),
  description: text("Description", { length: 255 }).notNull(),
  originalLink: text("OriginalLink", { length: 1200 }),
  storageLink: text("StorageLink", { length: 1200 }),
  resourceType: text("ResourceType", { length: 100 }),
  createdDateTime: text("CreatedDateTime")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const documentEventLink = sqliteTable(
  "DocumentEventLink",
  {
    eventId: integer("EventId")
      .notNull()
      .references(() => eventTable.id, { onDelete: "cascade" }),
    documentId: integer("DocumentId")
      .notNull()
      .references(() => documentTable.documentId, { onDelete: "cascade" }),
    createdDateTime: text("CreatedDateTime")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("DocumentEventLink_unique").on(t.eventId, t.documentId)],
);

export const userPreferences = sqliteTable("UserPreferences", {
  id: integer("Id").primaryKey({ autoIncrement: true }),
  timelineId: integer("TimelineId").references(() => timelineTable.id, {
    onDelete: "cascade",
  }),
  visible: integer("Visible", { mode: "boolean" }).notNull().default(true),
});

export const appSettings = sqliteTable("AppSettings", {
  key: text("Key").primaryKey(),
  value: text("Value").notNull(),
  isSecret: integer("IsSecret", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("UpdatedAt")
    .notNull()
    .default(sql`(datetime('now'))`),
});
