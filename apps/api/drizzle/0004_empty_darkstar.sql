CREATE TABLE `SysDataAreaTable` (
	`Id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`Name` text(100) NOT NULL,
	`Description` text(255),
	`IsPersonal` integer DEFAULT false NOT NULL,
	`CreatedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `SysUserDataArea` (
	`UserId` integer NOT NULL,
	`DataAreaId` integer NOT NULL,
	`CanCreate` integer DEFAULT false NOT NULL,
	`CanRead` integer DEFAULT false NOT NULL,
	`CanUpdate` integer DEFAULT false NOT NULL,
	`CanDelete` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`UserId`, `DataAreaId`),
	FOREIGN KEY (`UserId`) REFERENCES `SysUserTable`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`DataAreaId`) REFERENCES `SysDataAreaTable`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `SysUserSettingsTable` (
	`UserId` integer PRIMARY KEY NOT NULL,
	`CurrentDataAreaId` integer NOT NULL,
	`UpdatedAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`UserId`) REFERENCES `SysUserTable`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`CurrentDataAreaId`) REFERENCES `SysDataAreaTable`(`Id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `SysUserTable` (
	`Id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`Login` text(50) NOT NULL,
	`Email` text(255) NOT NULL,
	`PasswordHash` text NOT NULL,
	`FirstName` text(100),
	`LastName` text(100),
	`IsActive` integer DEFAULT true NOT NULL,
	`EmailConfirmed` integer DEFAULT false NOT NULL,
	`DefaultDataAreaId` integer NOT NULL,
	`CreatedAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`DefaultDataAreaId`) REFERENCES `SysDataAreaTable`(`Id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `SysUserTable_Login_unique` ON `SysUserTable` (`Login`);--> statement-breakpoint
CREATE UNIQUE INDEX `SysUserTable_Email_unique` ON `SysUserTable` (`Email`);--> statement-breakpoint
ALTER TABLE `DocumentEventLink` ADD `DataAreaId` integer REFERENCES SysDataAreaTable(Id);--> statement-breakpoint
ALTER TABLE `DocumentTable` ADD `DataAreaId` integer REFERENCES SysDataAreaTable(Id);--> statement-breakpoint
ALTER TABLE `EventTable` ADD `DataAreaId` integer REFERENCES SysDataAreaTable(Id);--> statement-breakpoint
ALTER TABLE `EventTimelineLink` ADD `DataAreaId` integer REFERENCES SysDataAreaTable(Id);--> statement-breakpoint
ALTER TABLE `TagEventLink` ADD `DataAreaId` integer REFERENCES SysDataAreaTable(Id);--> statement-breakpoint
ALTER TABLE `TagTable` ADD `DataAreaId` integer REFERENCES SysDataAreaTable(Id);--> statement-breakpoint
ALTER TABLE `TimelineTable` ADD `DataAreaId` integer REFERENCES SysDataAreaTable(Id);--> statement-breakpoint
ALTER TABLE `UserPreferences` ADD `UserId` integer REFERENCES SysUserTable(Id);