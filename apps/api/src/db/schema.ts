import { boolean, date, integer, pgTable, serial, text, timestamp, uniqueIndex, primaryKey, varchar } from "drizzle-orm/pg-core";

// ── Multi-user / Data Area tables ──

export const sysDataAreaTable = pgTable("SysDataAreaTable", {
  id: serial("Id").primaryKey(),
  name: varchar("Name", { length: 100 }).notNull(),
  description: varchar("Description", { length: 255 }),
  isPersonal: boolean("IsPersonal").notNull().default(false),
  createdAt: timestamp("CreatedAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sysUserTable = pgTable("SysUserTable", {
  id: serial("Id").primaryKey(),
  login: varchar("Login", { length: 50 }).notNull().unique(),
  email: varchar("Email", { length: 255 }).notNull().unique(),
  passwordHash: text("PasswordHash").notNull(),
  firstName: varchar("FirstName", { length: 100 }),
  lastName: varchar("LastName", { length: 100 }),
  isActive: boolean("IsActive").notNull().default(true),
  emailConfirmed: boolean("EmailConfirmed").notNull().default(false),
  emailConfirmationTokenHash: text("EmailConfirmationTokenHash"),
  emailTokenExpiresAt: timestamp("EmailTokenExpiresAt", { withTimezone: true }),
  passwordResetTokenHash: text("PasswordResetTokenHash"),
  passwordResetExpiresAt: timestamp("PasswordResetExpiresAt", { withTimezone: true }),
  defaultDataAreaId: integer("DefaultDataAreaId")
    .notNull()
    .references(() => sysDataAreaTable.id),
  aiQuotaTotal: integer("AiQuotaTotal").notNull().default(10),
  aiQuotaUsed: integer("AiQuotaUsed").notNull().default(0),
  aiQuotaResetDate: timestamp("AiQuotaResetDate", { withTimezone: true }),
  createdAt: timestamp("CreatedAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sysUserDataArea = pgTable(
  "SysUserDataArea",
  {
    userId: integer("UserId")
      .notNull()
      .references(() => sysUserTable.id, { onDelete: "cascade" }),
    dataAreaId: integer("DataAreaId")
      .notNull()
      .references(() => sysDataAreaTable.id, { onDelete: "cascade" }),
    canCreate: boolean("CanCreate").notNull().default(false),
    canRead: boolean("CanRead").notNull().default(false),
    canUpdate: boolean("CanUpdate").notNull().default(false),
    canDelete: boolean("CanDelete").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.dataAreaId] })],
);

export const sysUserSettingsTable = pgTable("SysUserSettingsTable", {
  userId: integer("UserId")
    .notNull()
    .primaryKey()
    .references(() => sysUserTable.id, { onDelete: "cascade" }),
  currentDataAreaId: integer("CurrentDataAreaId")
    .notNull()
    .references(() => sysDataAreaTable.id),
  updatedAt: timestamp("UpdatedAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sysExternalLoginTable = pgTable(
  "SysExternalLogin",
  {
    id: serial("Id").primaryKey(),
    userId: integer("UserId")
      .notNull()
      .references(() => sysUserTable.id, { onDelete: "cascade" }),
    provider: varchar("Provider", { length: 50 }).notNull(),
    providerId: varchar("ProviderId", { length: 255 }).notNull(),
    createdAt: timestamp("CreatedAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("SysExternalLogin_unique").on(t.provider, t.providerId)],
);

// ── Domain tables (with DataAreaId) ──

export const timelineTable = pgTable("TimelineTable", {
  id: serial("Id").primaryKey(),
  name: varchar("Name", { length: 60 }).notNull(),
  description: varchar("Description", { length: 255 }),
  iconUrl: text("IconUrl"),
  sortIndex: integer("SortIndex").default(0),
  dataAreaId: integer("DataAreaId").references(() => sysDataAreaTable.id),
  createdDateTime: timestamp("CreatedDateTime", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const eventTable = pgTable("EventTable", {
  id: serial("Id").primaryKey(),
  name: varchar("Name", { length: 255 }).notNull(),
  startDate: date("StartDate").notNull(),
  endDate: date("EndDate"),
  notes: text("Notes"),
  dataAreaId: integer("DataAreaId").references(() => sysDataAreaTable.id),
  createdDateTime: timestamp("CreatedDateTime", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const eventTimelineLink = pgTable(
  "EventTimelineLink",
  {
    eventId: integer("EventId")
      .notNull()
      .references(() => eventTable.id, { onDelete: "cascade" }),
    timelineId: integer("TimelineId")
      .notNull()
      .references(() => timelineTable.id, { onDelete: "cascade" }),
    description: varchar("Description", { length: 60 }),
    dataAreaId: integer("DataAreaId").references(() => sysDataAreaTable.id),
    createdDateTime: timestamp("CreatedDateTime", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("EventTimelineLink_unique").on(t.eventId, t.timelineId)],
);

export const tagTable = pgTable("TagTable", {
  id: serial("Id").primaryKey(),
  name: varchar("Name", { length: 40 }).notNull(),
  color: integer("Color").notNull(),
  previewUrl: text("PreviewUrl"),
  dataAreaId: integer("DataAreaId").references(() => sysDataAreaTable.id),
  createdDateTime: timestamp("CreatedDateTime", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tagEventLink = pgTable(
  "TagEventLink",
  {
    eventId: integer("EventId")
      .notNull()
      .references(() => eventTable.id, { onDelete: "cascade" }),
    tagId: integer("TagId")
      .notNull()
      .references(() => tagTable.id, { onDelete: "cascade" }),
    dataAreaId: integer("DataAreaId").references(() => sysDataAreaTable.id),
    createdDateTime: timestamp("CreatedDateTime", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("TagEventLink_unique").on(t.eventId, t.tagId)],
);

export const documentTable = pgTable("DocumentTable", {
  documentId: serial("DocumentId").primaryKey(),
  description: varchar("Description", { length: 255 }).notNull(),
  originalLink: varchar("OriginalLink", { length: 1200 }),
  storageLink: varchar("StorageLink", { length: 1200 }),
  resourceType: varchar("ResourceType", { length: 100 }),
  dataAreaId: integer("DataAreaId").references(() => sysDataAreaTable.id),
  createdDateTime: timestamp("CreatedDateTime", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const documentEventLink = pgTable(
  "DocumentEventLink",
  {
    eventId: integer("EventId")
      .notNull()
      .references(() => eventTable.id, { onDelete: "cascade" }),
    documentId: integer("DocumentId")
      .notNull()
      .references(() => documentTable.documentId, { onDelete: "cascade" }),
    isPrimary: boolean("IsPrimary").notNull().default(false),
    dataAreaId: integer("DataAreaId").references(() => sysDataAreaTable.id),
    createdDateTime: timestamp("CreatedDateTime", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("DocumentEventLink_unique").on(t.eventId, t.documentId)],
);

export const userPreferences = pgTable("UserPreferences", {
  id: serial("Id").primaryKey(),
  userId: integer("UserId").references(() => sysUserTable.id, {
    onDelete: "cascade",
  }),
  timelineId: integer("TimelineId").references(() => timelineTable.id, {
    onDelete: "cascade",
  }),
  visible: boolean("Visible").notNull().default(true),
});

export const sysCounterTable = pgTable("SysCounterTable", {
  name: varchar("Name", { length: 50 }).primaryKey(),
  value: integer("Value").notNull().default(0),
});

export const sysRefreshTokenTable = pgTable("SysRefreshToken", {
  id: serial("Id").primaryKey(),
  userId: integer("UserId")
    .notNull()
    .references(() => sysUserTable.id, { onDelete: "cascade" }),
  tokenHash: text("TokenHash").notNull(),
  expiresAt: timestamp("ExpiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("CreatedAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
  ipAddress: varchar("IpAddress", { length: 45 }),
  userAgent: text("UserAgent"),
  revokedAt: timestamp("RevokedAt", { withTimezone: true }),
});

export const sysAuditLogTable = pgTable("SysAuditLog", {
  id: serial("Id").primaryKey(),
  userId: integer("UserId").references(() => sysUserTable.id, { onDelete: "set null" }),
  eventType: varchar("EventType", { length: 50 }).notNull(),
  ipAddress: varchar("IpAddress", { length: 45 }),
  userAgent: text("UserAgent"),
  metadata: text("Metadata"),
  createdAt: timestamp("CreatedAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const eventDependencyTable = pgTable(
  "EventDependencyLink",
  {
    eventId: integer("EventId")
      .notNull()
      .references(() => eventTable.id, { onDelete: "cascade" }),
    depEventId: integer("DepEventId")
      .notNull()
      .references(() => eventTable.id, { onDelete: "cascade" }),
    dependencyType: varchar("DependencyType", { length: 20 }).notNull(),
    dataAreaId: integer("DataAreaId").references(() => sysDataAreaTable.id),
    createdDateTime: timestamp("CreatedDateTime", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("EventDependencyLink_unique").on(t.eventId, t.depEventId),
  ],
);

export const appSettings = pgTable("AppSettings", {
  key: text("Key").primaryKey(),
  value: text("Value").notNull(),
  isSecret: boolean("IsSecret").notNull().default(false),
  updatedAt: timestamp("UpdatedAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
