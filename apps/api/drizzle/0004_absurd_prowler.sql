CREATE TABLE "EventDependencyLink" (
	"EventId" integer NOT NULL,
	"DepEventId" integer NOT NULL,
	"DependencyType" varchar(20) NOT NULL,
	"DataAreaId" integer,
	"CreatedDateTime" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "EventDependencyLink" ADD CONSTRAINT "EventDependencyLink_EventId_EventTable_Id_fk" FOREIGN KEY ("EventId") REFERENCES "public"."EventTable"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EventDependencyLink" ADD CONSTRAINT "EventDependencyLink_DepEventId_EventTable_Id_fk" FOREIGN KEY ("DepEventId") REFERENCES "public"."EventTable"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EventDependencyLink" ADD CONSTRAINT "EventDependencyLink_DataAreaId_SysDataAreaTable_Id_fk" FOREIGN KEY ("DataAreaId") REFERENCES "public"."SysDataAreaTable"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "EventDependencyLink_unique" ON "EventDependencyLink" USING btree ("EventId","DepEventId");