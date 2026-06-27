ALTER TABLE "SysUserTable" ADD COLUMN "AiQuotaTotal" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "SysUserTable" ADD COLUMN "AiQuotaUsed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "SysUserTable" ADD COLUMN "AiQuotaResetDate" timestamp with time zone;