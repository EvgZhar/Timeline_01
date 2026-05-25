import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core";

// ── Multi-user / Data Area tables ──

export const sysDataAreaTable = sqliteTable("SysDataAreaTable", {
  id: integer("Id").primaryKey({ autoIncrement: true }),
  name: text("Name", { length: 100 }).notNull(),
  description: text("Description", { length: 255 }),
  isPersonal: integer("IsPersonal", { mode: "boolean" }).notNull().default(false),
  createdAt: text("CreatedAt")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const sysUserTable = sqliteTable("SysUserTable", {
  id: integer("Id").primaryKey({ autoIncrement: true }),
  login: text("Login", { length: 50 }).notNull().unique(),
  email: text("Email", { length: 255 }).notNull().unique(),
  passwordHash: text("PasswordHash").notNull(),
  firstName: text("FirstName", { length: 100 }),
  lastName: text("LastName", { length: 100 }),
  isActive: integer("IsActive", { mode: "boolean" }).notNull().default(true),
  emailConfirmed: integer("EmailConfirmed", { mode: "boolean" }).notNull().default(false),
  defaultDataAreaId: integer("DefaultDataAreaId")
    .notNull()
    .references(() => sysDataAreaTable.id),
  createdAt: text("CreatedAt")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const sysUserDataArea = sqliteTable(
  "SysUserDataArea",
  {
    userId: integer("UserId")
      .notNull()
      .references(() => sysUserTable.id, { onDelete: "cascade" }),
    dataAreaId: integer("DataAreaId")
      .notNull()
      .references(() => sysDataAreaTable.id, { onDelete: "cascade" }),
    canCreate: integer("CanCreate", { mode: "boolean" }).notNull().default(false),
    canRead: integer("CanRead", { mode: "boolean" }).notNull().default(false),
    canUpdate: integer("CanUpdate", { mode: "boolean" }).notNull().default(false),
    canDelete: integer("CanDelete", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.dataAreaId] })],
);

export const sysUserSettingsTable = sqliteTable("SysUserSettingsTable", {
  userId: integer("UserId")
    .notNull()
    .primaryKey()
    .references(() => sysUserTable.id, { onDelete: "cascade" }),
  currentDataAreaId: integer("CurrentDataAreaId")
    .notNull()
    .references(() => sysDataAreaTable.id),
  updatedAt: text("UpdatedAt")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── Domain tables (with DataAreaId) ──

export const timelineTable = sqliteTable("TimelineTable", {
  id: integer("Id").primaryKey({ autoIncrement: true }),
  name: text("Name", { length: 60 }).notNull(),
  description: text("Description", { length: 255 }),
  iconUrl: text("IconUrl"),
  sortIndex: integer("SortIndex").default(0),
  dataAreaId: integer("DataAreaId").references(() => sysDataAreaTable.id),
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
  dataAreaId: integer("DataAreaId").references(() => sysDataAreaTable.id),
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
    dataAreaId: integer("DataAreaId").references(() => sysDataAreaTable.id),
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
  previewUrl: text("PreviewUrl"),
  dataAreaId: integer("DataAreaId").references(() => sysDataAreaTable.id),
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
    dataAreaId: integer("DataAreaId").references(() => sysDataAreaTable.id),
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
  dataAreaId: integer("DataAreaId").references(() => sysDataAreaTable.id),
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
    isPrimary: integer("IsPrimary", { mode: "boolean" }).notNull().default(false),
    dataAreaId: integer("DataAreaId").references(() => sysDataAreaTable.id),
    createdDateTime: text("CreatedDateTime")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("DocumentEventLink_unique").on(t.eventId, t.documentId)],
);

export const userPreferences = sqliteTable("UserPreferences", {
  id: integer("Id").primaryKey({ autoIncrement: true }),
  userId: integer("UserId").references(() => sysUserTable.id, {
    onDelete: "cascade",
  }),
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
