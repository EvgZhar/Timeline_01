CREATE TABLE "SysExternalLogin" (
	"Id" serial PRIMARY KEY NOT NULL,
	"UserId" integer NOT NULL,
	"Provider" varchar(50) NOT NULL,
	"ProviderId" varchar(255) NOT NULL,
	"CreatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "SysUserTable" ADD COLUMN "EmailConfirmationTokenHash" text;--> statement-breakpoint
ALTER TABLE "SysUserTable" ADD COLUMN "EmailTokenExpiresAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "SysUserTable" ADD COLUMN "PasswordResetTokenHash" text;--> statement-breakpoint
ALTER TABLE "SysUserTable" ADD COLUMN "PasswordResetExpiresAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "SysExternalLogin" ADD CONSTRAINT "SysExternalLogin_UserId_SysUserTable_Id_fk" FOREIGN KEY ("UserId") REFERENCES "public"."SysUserTable"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "SysExternalLogin_unique" ON "SysExternalLogin" USING btree ("Provider","ProviderId");