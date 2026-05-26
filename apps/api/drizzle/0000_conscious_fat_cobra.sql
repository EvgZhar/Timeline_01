CREATE TABLE "AppSettings" (
	"Key" text PRIMARY KEY NOT NULL,
	"Value" text NOT NULL,
	"IsSecret" boolean DEFAULT false NOT NULL,
	"UpdatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "DocumentEventLink" (
	"EventId" integer NOT NULL,
	"DocumentId" integer NOT NULL,
	"IsPrimary" boolean DEFAULT false NOT NULL,
	"DataAreaId" integer,
	"CreatedDateTime" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "DocumentTable" (
	"DocumentId" serial PRIMARY KEY NOT NULL,
	"Description" varchar(255) NOT NULL,
	"OriginalLink" varchar(1200),
	"StorageLink" varchar(1200),
	"ResourceType" varchar(100),
	"DataAreaId" integer,
	"CreatedDateTime" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EventTable" (
	"Id" serial PRIMARY KEY NOT NULL,
	"Name" varchar(255) NOT NULL,
	"StartDate" date NOT NULL,
	"EndDate" date,
	"Notes" text,
	"DataAreaId" integer,
	"CreatedDateTime" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EventTimelineLink" (
	"EventId" integer NOT NULL,
	"TimelineId" integer NOT NULL,
	"Description" varchar(60),
	"DataAreaId" integer,
	"CreatedDateTime" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SysDataAreaTable" (
	"Id" serial PRIMARY KEY NOT NULL,
	"Name" varchar(100) NOT NULL,
	"Description" varchar(255),
	"IsPersonal" boolean DEFAULT false NOT NULL,
	"CreatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SysUserDataArea" (
	"UserId" integer NOT NULL,
	"DataAreaId" integer NOT NULL,
	"CanCreate" boolean DEFAULT false NOT NULL,
	"CanRead" boolean DEFAULT false NOT NULL,
	"CanUpdate" boolean DEFAULT false NOT NULL,
	"CanDelete" boolean DEFAULT false NOT NULL,
	CONSTRAINT "SysUserDataArea_UserId_DataAreaId_pk" PRIMARY KEY("UserId","DataAreaId")
);
--> statement-breakpoint
CREATE TABLE "SysUserSettingsTable" (
	"UserId" integer PRIMARY KEY NOT NULL,
	"CurrentDataAreaId" integer NOT NULL,
	"UpdatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SysUserTable" (
	"Id" serial PRIMARY KEY NOT NULL,
	"Login" varchar(50) NOT NULL,
	"Email" varchar(255) NOT NULL,
	"PasswordHash" text NOT NULL,
	"FirstName" varchar(100),
	"LastName" varchar(100),
	"IsActive" boolean DEFAULT true NOT NULL,
	"EmailConfirmed" boolean DEFAULT false NOT NULL,
	"DefaultDataAreaId" integer NOT NULL,
	"CreatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "SysUserTable_Login_unique" UNIQUE("Login"),
	CONSTRAINT "SysUserTable_Email_unique" UNIQUE("Email")
);
--> statement-breakpoint
CREATE TABLE "TagEventLink" (
	"EventId" integer NOT NULL,
	"TagId" integer NOT NULL,
	"DataAreaId" integer,
	"CreatedDateTime" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TagTable" (
	"Id" serial PRIMARY KEY NOT NULL,
	"Name" varchar(40) NOT NULL,
	"Color" integer NOT NULL,
	"PreviewUrl" text,
	"DataAreaId" integer,
	"CreatedDateTime" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TimelineTable" (
	"Id" serial PRIMARY KEY NOT NULL,
	"Name" varchar(60) NOT NULL,
	"Description" varchar(255),
	"IconUrl" text,
	"SortIndex" integer DEFAULT 0,
	"DataAreaId" integer,
	"CreatedDateTime" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserPreferences" (
	"Id" serial PRIMARY KEY NOT NULL,
	"UserId" integer,
	"TimelineId" integer,
	"Visible" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "DocumentEventLink" ADD CONSTRAINT "DocumentEventLink_EventId_EventTable_Id_fk" FOREIGN KEY ("EventId") REFERENCES "public"."EventTable"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DocumentEventLink" ADD CONSTRAINT "DocumentEventLink_DocumentId_DocumentTable_DocumentId_fk" FOREIGN KEY ("DocumentId") REFERENCES "public"."DocumentTable"("DocumentId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DocumentEventLink" ADD CONSTRAINT "DocumentEventLink_DataAreaId_SysDataAreaTable_Id_fk" FOREIGN KEY ("DataAreaId") REFERENCES "public"."SysDataAreaTable"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DocumentTable" ADD CONSTRAINT "DocumentTable_DataAreaId_SysDataAreaTable_Id_fk" FOREIGN KEY ("DataAreaId") REFERENCES "public"."SysDataAreaTable"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EventTable" ADD CONSTRAINT "EventTable_DataAreaId_SysDataAreaTable_Id_fk" FOREIGN KEY ("DataAreaId") REFERENCES "public"."SysDataAreaTable"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EventTimelineLink" ADD CONSTRAINT "EventTimelineLink_EventId_EventTable_Id_fk" FOREIGN KEY ("EventId") REFERENCES "public"."EventTable"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EventTimelineLink" ADD CONSTRAINT "EventTimelineLink_TimelineId_TimelineTable_Id_fk" FOREIGN KEY ("TimelineId") REFERENCES "public"."TimelineTable"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EventTimelineLink" ADD CONSTRAINT "EventTimelineLink_DataAreaId_SysDataAreaTable_Id_fk" FOREIGN KEY ("DataAreaId") REFERENCES "public"."SysDataAreaTable"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SysUserDataArea" ADD CONSTRAINT "SysUserDataArea_UserId_SysUserTable_Id_fk" FOREIGN KEY ("UserId") REFERENCES "public"."SysUserTable"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SysUserDataArea" ADD CONSTRAINT "SysUserDataArea_DataAreaId_SysDataAreaTable_Id_fk" FOREIGN KEY ("DataAreaId") REFERENCES "public"."SysDataAreaTable"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SysUserSettingsTable" ADD CONSTRAINT "SysUserSettingsTable_UserId_SysUserTable_Id_fk" FOREIGN KEY ("UserId") REFERENCES "public"."SysUserTable"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SysUserSettingsTable" ADD CONSTRAINT "SysUserSettingsTable_CurrentDataAreaId_SysDataAreaTable_Id_fk" FOREIGN KEY ("CurrentDataAreaId") REFERENCES "public"."SysDataAreaTable"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SysUserTable" ADD CONSTRAINT "SysUserTable_DefaultDataAreaId_SysDataAreaTable_Id_fk" FOREIGN KEY ("DefaultDataAreaId") REFERENCES "public"."SysDataAreaTable"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TagEventLink" ADD CONSTRAINT "TagEventLink_EventId_EventTable_Id_fk" FOREIGN KEY ("EventId") REFERENCES "public"."EventTable"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TagEventLink" ADD CONSTRAINT "TagEventLink_TagId_TagTable_Id_fk" FOREIGN KEY ("TagId") REFERENCES "public"."TagTable"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TagEventLink" ADD CONSTRAINT "TagEventLink_DataAreaId_SysDataAreaTable_Id_fk" FOREIGN KEY ("DataAreaId") REFERENCES "public"."SysDataAreaTable"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TagTable" ADD CONSTRAINT "TagTable_DataAreaId_SysDataAreaTable_Id_fk" FOREIGN KEY ("DataAreaId") REFERENCES "public"."SysDataAreaTable"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TimelineTable" ADD CONSTRAINT "TimelineTable_DataAreaId_SysDataAreaTable_Id_fk" FOREIGN KEY ("DataAreaId") REFERENCES "public"."SysDataAreaTable"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_UserId_SysUserTable_Id_fk" FOREIGN KEY ("UserId") REFERENCES "public"."SysUserTable"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_TimelineId_TimelineTable_Id_fk" FOREIGN KEY ("TimelineId") REFERENCES "public"."TimelineTable"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "DocumentEventLink_unique" ON "DocumentEventLink" USING btree ("EventId","DocumentId");--> statement-breakpoint
CREATE UNIQUE INDEX "EventTimelineLink_unique" ON "EventTimelineLink" USING btree ("EventId","TimelineId");--> statement-breakpoint
CREATE UNIQUE INDEX "TagEventLink_unique" ON "TagEventLink" USING btree ("EventId","TagId");