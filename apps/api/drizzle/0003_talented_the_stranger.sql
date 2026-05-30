CREATE TABLE "SysAuditLog" (
	"Id" serial PRIMARY KEY NOT NULL,
	"UserId" integer,
	"EventType" varchar(50) NOT NULL,
	"IpAddress" varchar(45),
	"UserAgent" text,
	"Metadata" text,
	"CreatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SysRefreshToken" (
	"Id" serial PRIMARY KEY NOT NULL,
	"UserId" integer NOT NULL,
	"TokenHash" text NOT NULL,
	"ExpiresAt" timestamp with time zone NOT NULL,
	"CreatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"IpAddress" varchar(45),
	"UserAgent" text,
	"RevokedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "SysAuditLog" ADD CONSTRAINT "SysAuditLog_UserId_SysUserTable_Id_fk" FOREIGN KEY ("UserId") REFERENCES "public"."SysUserTable"("Id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SysRefreshToken" ADD CONSTRAINT "SysRefreshToken_UserId_SysUserTable_Id_fk" FOREIGN KEY ("UserId") REFERENCES "public"."SysUserTable"("Id") ON DELETE cascade ON UPDATE no action;